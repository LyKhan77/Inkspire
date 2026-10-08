/**
 * Real Caddy HTTPS gate for the LAN proxy path. Standalone on purpose: `npm test`
 * must not require the Caddy executable. Everything here stays on loopback, uses
 * its own temporary PKI/storage, and talks to the repository mock MaPic.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { request } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkServerIdentity } from 'node:tls';
import { setTimeout as delay } from 'node:timers/promises';
import { startApp } from '../server/app';
import { readConfig } from '../server/config';
import { caddyEnvironment, renderCaddyfile } from '../server/lan';
import { startMock, TEST_TOKEN } from './mock-mapic';

const TLS_FAILURES = ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN',
  'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_SIGNATURE_FAILURE'];

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

async function stop(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>(resolve => {
    const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}

const root = await mkdtemp(join(tmpdir(), 'inkspire lan tls-'));
const mock = await startMock();
let child: ChildProcess | undefined;
let app: Awaited<ReturnType<typeof startApp>> | undefined;

try {
  const version = spawnSync('caddy', ['version'], { encoding: 'utf8', env: caddyEnvironment(process.env, root) });
  assert.equal(version.status, 0, 'Caddy executable required for test:lan');
  console.log(version.stdout.trim());

  const port = await freePort();
  const origin = `https://localhost:${port}`;
  const lanOrigin = `https://192.168.50.20:${port}`;
  const config = readConfig({ INKSPIRE_PUBLIC_ORIGIN: lanOrigin });
  // The internal fixture uses localhost solely to keep every TLS listener on loopback.
  app = await startApp({ ...config, origin, port: 0, mapicBaseURL: mock.origin,
    mapicServiceToken: TEST_TOKEN, generationTimeoutMs: 3000 });
  assert.equal(app.origin, origin);
  const upstreamPort = (app.server.address() as AddressInfo).port;

  const generated = renderCaddyfile({ ...config, port: upstreamPort }, root);
  assert(generated.includes('bind 192.168.50.20'), 'renderer must bind the explicit LAN IP');
  const fixture = generated.replace(lanOrigin, origin).replace('bind 192.168.50.20', 'bind 127.0.0.1');
  const file = join(root, 'Caddyfile');
  await writeFile(file, fixture, { mode: 0o600 });

  const env = caddyEnvironment(process.env, root);
  const adapted = spawnSync('caddy', ['adapt', '--config', file, '--adapter', 'caddyfile'], { env, encoding: 'utf8' });
  assert.equal(adapted.status, 0, adapted.stderr);
  const json = JSON.parse(adapted.stdout) as { admin?: { disabled?: boolean }, apps?: { http?: { servers?: Record<string, { listen: string[], protocols?: string[] }> } } };
  assert.equal(json.admin?.disabled, true, 'admin API must be disabled');
  const servers = Object.values(json.apps?.http?.servers ?? {}) as { listen: string[] }[];
  assert.deepEqual(servers.flatMap(server => server.listen), [`127.0.0.1:${port}`],
    'only the fixture listener may be configured');
  const validated = spawnSync('caddy', ['validate', '--config', file, '--adapter', 'caddyfile'], { env, encoding: 'utf8' });
  assert.equal(validated.status, 0, validated.stderr);

  child = spawn('caddy', ['run', '--config', file, '--adapter', 'caddyfile'], { env, stdio: 'pipe' });
  child.stdout?.resume();
  child.stderr?.resume();
  let spawnError: Error | undefined;
  child.once('error', error => { spawnError = error; });

  const ca = await readFile(join(root, '.inkspire-lan/data/pki/authorities/local/root.crt'), 'utf8');
  function send(method: string, path: string, patch: Record<string, string> = {}, trust: string | undefined = ca) {
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', port, servername: 'localhost',
        checkServerIdentity: (_host, cert) => checkServerIdentity('localhost', cert),
        rejectUnauthorized: true, ca: trust, method, path, headers: {
          Host: new URL(origin).host, Origin: origin, 'Content-Type': 'application/json',
          'X-Inkspire-Client': '1', ...patch,
        } }, res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode!, body }));
      });
      req.setTimeout(5000, () => req.destroy(new Error('TLS fixture timeout')));
      req.on('error', reject);
      req.end(method === 'POST' ? JSON.stringify({ prompt: 'mock ink' }) : undefined);
    });
  }

  const deadline = Date.now() + 15_000;
  for (;;) {
    if (spawnError || child.exitCode !== null) throw new Error(`Caddy fixture startup failed: ${spawnError?.message ?? child.exitCode}`);
    try {
      if ((await send('GET', '/')).status === 200) break;
      throw new Error('frontend not served yet');
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await delay(50);
    }
  }

  // An untrusted CA must fail verification, not silently succeed or time out.
  await assert.rejects(send('GET', '/', {}, ''), (error: unknown) => {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    assert(TLS_FAILURES.includes(code), `expected TLS verification failure, received ${code || (error as Error).message}`);
    return true;
  });

  const invalidHeaders: Record<string, string>[] = [
    { Origin: 'https://evil.example' }, { Host: 'evil.example' },
    { Origin: 'http://localhost:' + port },
  ];
  for (const patch of invalidHeaders) {
    const response = await send('POST', '/api/ai/generate', patch);
    assert([403, 404, 421].includes(response.status), `invalid origin guard returned ${response.status}`);
  }
  assert.equal(mock.calls.length, 0, 'rejected requests must never reach MaPic');

  assert.equal((await send('GET', '/.inkspire-lan/data/pki/authorities/local/root.key')).status, 404);
  assert.equal((await send('GET', '/.inkspire-lan/Caddyfile')).status, 404);
  assert.equal((await send('GET', '/api/missing', {}, ca)).status, 404);
  const asset = await send('GET', '/fonts/space-grotesk.ttf');
  assert.equal(asset.status, 200, 'frontend static asset must be served through TLS');

  const response = await send('POST', '/api/ai/generate');
  assert.equal(response.status, 200);
  assert((JSON.parse(response.body) as { data: { b64_json: string }[] }).data[0]!.b64_json);
  assert.equal(mock.calls.length, 1);
  assert(!response.body.includes(TEST_TOKEN), 'service token must never reach the client');
  console.log('PASS: Caddy config, verified TLS, origin guards, private paths and mock generation');
} finally {
  if (child) await stop(child);
  await app?.close();
  await mock.close();
  await rm(root, { recursive: true, force: true });
}