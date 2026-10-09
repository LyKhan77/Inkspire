/**
 * Real Caddy HTTPS gate for the LAN proxy path. Standalone on purpose: `npm test`
 * must not require the Caddy executable. Everything here stays on loopback, uses
 * its own temporary PKI/storage, and talks to the repository mock MaPic.
 */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
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
// Caddy must have no certificate to offer for an unrelated SNI, so the handshake
// aborts before any HTTP response exists. A resolved response is a failure here.
const HANDSHAKE_FAILURES = ['EPROTO', 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', 'ERR_SSL_UNKNOWN_CA',
  'ERR_SSL_NO_APPLICATION_PROTOCOL', 'ERR_SSL_WRONG_VERSION_NUMBER', 'ECONNRESET'];

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
  // The fixture keeps every listener on loopback but keeps the production shape:
  // an IPv4 literal origin. Browsers do not send SNI for IP literals, so the
  // certificate path exercised here is the one a real LAN device uses.
  const origin = `https://127.0.0.1:${port}`;
  const lanOrigin = `https://192.168.50.20:${port}`;
  const config = readConfig({ INKSPIRE_PUBLIC_ORIGIN: lanOrigin });
  app = await startApp({ ...config, origin, port: 0, mapicBaseURL: mock.origin,
    mapicServiceToken: TEST_TOKEN, generationTimeoutMs: 3000 });
  assert.equal(app.origin, origin);
  const upstreamPort = (app.server.address() as AddressInfo).port;

  const generated = renderCaddyfile({ ...config, port: upstreamPort }, root);
  assert(generated.includes('bind 192.168.50.20'), 'renderer must bind the explicit LAN IP');

  const env = caddyEnvironment(process.env, root);

  // The operator config keeps both sites on one explicit LAN address, so the
  // fallback must not introduce a second listener.
  const lanFile = join(root, 'Caddyfile.lan');
  await writeFile(lanFile, generated, { mode: 0o600 });
  const lanAdapted = spawnSync('caddy', ['adapt', '--config', lanFile, '--adapter', 'caddyfile'], { env, encoding: 'utf8' });
  assert.equal(lanAdapted.status, 0, lanAdapted.stderr);
  const lanJson = JSON.parse(lanAdapted.stdout) as { apps?: { http?: { servers?: Record<string, { listen: string[] }> } } };
  const lanListeners = Object.values(lanJson.apps?.http?.servers ?? {}).flatMap(server => server.listen);
  assert.deepEqual(lanListeners, [`192.168.50.20:${port}`],
    'canonical site and fallback must share one LAN listener');

  const fixture = generated.replaceAll(lanOrigin, origin).replaceAll('bind 192.168.50.20', 'bind 127.0.0.1');
  const file = join(root, 'Caddyfile');
  await writeFile(file, fixture, { mode: 0o600 });

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
  // Optional operator aid: INKSPIRE_LAN_DEBUG=<dir> keeps the Caddy log outside
  // the fixture so a failing gate can be inspected after cleanup.
  const debugDir = process.env.INKSPIRE_LAN_DEBUG;
  if (debugDir) {
    await mkdir(debugDir, { recursive: true });
    child.stderr?.pipe(createWriteStream(join(debugDir, 'caddy.log')));
  } else child.stderr?.resume();
  let spawnError: Error | undefined;
  child.once('error', error => { spawnError = error; });
  const caddyChild = child;
  // Read through a function so the two poll loops share one check and TypeScript
  // keeps the callback-assigned `spawnError` at its declared type.
  function assertCaddyAlive(): void {
    if (spawnError || caddyChild.exitCode !== null) {
      throw new Error(`Caddy fixture startup failed: ${spawnError?.message ?? caddyChild.exitCode}`);
    }
  }

  // Caddy creates its local CA asynchronously; reading too early once produced ENOENT.
  const caPath = join(root, '.inkspire-lan/data/pki/authorities/local/root.crt');
  const caDeadline = Date.now() + 15_000;
  for (;;) {
    assertCaddyAlive();
    try { await access(caPath); break; } catch {
      if (Date.now() >= caDeadline) throw new Error('Caddy never created its local CA');
      await delay(50);
    }
  }
  const ca = await readFile(caPath, 'utf8');
  let step = 0;
  const mark = (label: string) => { if (debugDir) console.log(`[gate ${++step}] ${label}`); };
  function send(method: string, path: string, patch: Record<string, string> = {}, trust: string | undefined = ca, servername = '') {
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      // `servername: ''` keeps the handshake SNI-free, which is what a browser does
      // for an IP literal. Node would otherwise derive SNI from the Host header and
      // turn a Host-routing case into a certificate-name case.
      const req = request({ hostname: '127.0.0.1', port, servername,
        checkServerIdentity: (_host, cert) => checkServerIdentity('127.0.0.1', cert),
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
    assertCaddyAlive();
    try {
      if ((await send('GET', '/')).status === 200) break;
      throw new Error('frontend not served yet');
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await delay(50);
    }
  }

  mark('frontend served over verified TLS with no SNI');
  // An untrusted CA must fail verification, not silently succeed or time out.
  await assert.rejects(send('GET', '/', {}, ''), (error: unknown) => {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    assert(TLS_FAILURES.includes(code), `expected TLS verification failure, received ${code || (error as Error).message}`);
    return true;
  });
  mark('untrusted CA rejected');
  // An unrelated SNI must never obtain a certificate, so no response exists at all.
  await assert.rejects(send('GET', '/', {}, ca, 'evil.example'), (error: unknown) => {
    const code = (error as NodeJS.ErrnoException).code ?? '';
    assert(HANDSHAKE_FAILURES.includes(code), `expected handshake failure for unknown SNI, received ${code || (error as Error).message}`);
    return true;
  });
  mark('unknown SNI refused a certificate');

  const invalidHeaders: [string, Record<string, string>][] = [
    ['invalid Origin', { Origin: 'https://evil.example' }],
    ['invalid Host', { Host: 'evil.example' }],
    ['http Origin on https port', { Origin: `http://localhost:${port}` }],
  ];
  for (const [label, patch] of invalidHeaders) {
    const response = await send('POST', '/api/ai/generate', patch);
    assert.equal(response.status, 403, `${label} must be rejected explicitly, received ${response.status}`);
  }
  assert.equal(mock.calls.length, 0, 'rejected requests must never reach MaPic');
  const wrongHost = await send('GET', '/', { Host: 'evil.example' });
  assert.equal(wrongHost.status, 403, 'frontend route must reject a non-canonical Host');
  assert(!wrongHost.body.includes('<!doctype html'), 'a non-canonical Host must never receive the frontend document');
  mark('guards rejected invalid origin and host');
  // `send` connects to an IP literal without SNI, so every successful response
  // above already proves the no-SNI certificate path used by LAN devices.
  assert.equal((await send('GET', '/.inkspire-lan/data/pki/authorities/local/root.key')).status, 404);
  assert.equal((await send('GET', '/.inkspire-lan/Caddyfile')).status, 404);
  assert.equal((await send('GET', '/api/missing', {}, ca)).status, 404);
  const asset = await send('GET', '/fonts/space-grotesk.ttf');
  assert.equal(asset.status, 200, 'frontend static asset must be served through TLS');

  mark('private paths and static asset served/denied');
  const response = await send('POST', '/api/ai/generate');
  mark('mock generation completed');
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