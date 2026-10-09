import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { request } from 'node:https';
import type { AddressInfo } from 'node:net';
import { networkInterfaces, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkServerIdentity } from 'node:tls';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { readConfig } from '../server/config';
import { startMock, TEST_TOKEN } from './mock-mapic';

const run = promisify(execFile);
const root = resolve('.');
const ip = process.env.INKSPIRE_DOCKER_TEST_IP ?? '';
const image = process.env.INKSPIRE_DOCKER_TEST_IMAGE ?? '';
assert.equal(process.platform, 'linux', 'Docker LAN gate requires native Linux');
assert(!process.env.DOCKER_HOST, 'Unset DOCKER_HOST overrides before the native host-network gate');
assert(image && !/[\r\n]/.test(image), 'Set INKSPIRE_DOCKER_TEST_IMAGE to the built image');
readConfig({ INKSPIRE_PUBLIC_ORIGIN: `https://${ip}:8443` });
assert(Object.values(networkInterfaces()).flat().some(item => item?.address === ip && !item.internal),
  'Set INKSPIRE_DOCKER_TEST_IP to an explicit private IPv4 on this host');

async function docker(args: string[], env: NodeJS.ProcessEnv = process.env) {
  try { return (await run('docker', args, { env, timeout: 120000, maxBuffer: 8 * 1024 * 1024 })).stdout; }
  catch { throw new Error('Docker fixture command failed; inspect only this test project with sanitized logs'); }
}

const endpoint = JSON.parse((await docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'])).trim()) as string;
assert(endpoint.startsWith('unix://'), 'Remote Docker contexts are not accepted by this host-network fixture');
const platform = JSON.parse(await docker(['info', '--format', '{{json .}}'])) as {
  OSType: string; OperatingSystem: string; SecurityOptions?: string[] };
assert.equal(platform.OSType, 'linux');
assert(!platform.OperatingSystem.includes('Docker Desktop'), 'Docker Desktop is not a native Linux gate');
assert(!platform.SecurityOptions?.some(item => item.includes('rootless')), 'Rootless networking needs a separate review');

async function freePort(host: string): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject); server.listen(0, host, resolveListen);
  });
  const port = (server.address() as AddressInfo).port;
  await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  return port;
}

async function poll(action: () => Promise<void>) {
  const deadline = Date.now() + 45000;
  for (;;) {
    try { await action(); return; }
    catch (error) { if (Date.now() >= deadline) throw error; await delay(300); }
  }
}

const fixture = await mkdtemp(join(tmpdir(), 'inkspire-docker-'));
const project = `inkspire-review-${process.pid}-${Date.now()}`;
const file = join(fixture, '.env.docker');
let mock: Awaited<ReturnType<typeof startMock>> | undefined;
let attempted = false;
const fixtureEnv = { ...process.env, INKSPIRE_ENV_FILE: file };
const compose = (args: string[]) => docker(['compose', '--project-directory', root,
  '--env-file', file, '--project-name', project, '-f', join(root, 'compose.yaml'), ...args], fixtureEnv);

try {
  mock = await startMock();
  const appPort = await freePort('127.0.0.1');
  let proxyPort = await freePort(ip);
  while (proxyPort === appPort) proxyPort = await freePort(ip);
  const origin = `https://${ip}:${proxyPort}`;
  Object.assign(fixtureEnv, { INKSPIRE_IMAGE: image, INKSPIRE_PORT: String(appPort),
    INKSPIRE_PUBLIC_ORIGIN: origin, MAPIC_BASE_URL: mock.origin, MAPIC_SERVICE_TOKEN: TEST_TOKEN });
  await writeFile(file, `INKSPIRE_IMAGE=${image}\nINKSPIRE_PORT=${appPort}\nINKSPIRE_PUBLIC_ORIGIN=${origin}\nMAPIC_BASE_URL=${mock.origin}\nMAPIC_SERVICE_TOKEN=${TEST_TOKEN}\n`, { mode: 0o600 });
  await compose(['config', '--quiet']);
  console.log(`Docker fixture project: ${project}`);
  attempted = true;
  await compose(['up', '-d', '--no-build']);
  await compose(['exec', '-T', 'app', 'node', '-e', `
    const fs = require('node:fs');
    if (process.versions.node.split('.')[0] !== '24' || process.getuid() === 0) process.exit(1);
    require('sharp');
    for (const path of ['dist/index.html', 'dist-server/server/index.js',
      'dist-server/server/docker-healthcheck.js', 'dist-server/src/features/ai/contract.js']) {
      if (!fs.existsSync(path)) process.exit(1);
    }
    for (const path of ['.env', '.env.docker', '.git', 'temp', 'docs', 'src', 'tests']) {
      if (fs.existsSync(path)) process.exit(1);
    }
  `]);
  let ca = '';
  await poll(async () => {
    ca = await compose(['exec', '-T', 'proxy', 'cat', '/app/.inkspire-lan/data/pki/authorities/local/root.crt']);
    assert(ca.includes('BEGIN CERTIFICATE'));
  });

  function send(method: string, path: string, payload?: unknown, patch: Record<string, string> = {}, trust = ca) {
    return new Promise<{ status: number; body: string }>((resolveResponse, reject) => {
      const req = request({ hostname: ip, port: proxyPort, servername: '', ca: trust,
        rejectUnauthorized: true, checkServerIdentity: (_host, cert) => checkServerIdentity(ip, cert),
        method, path, headers: { Host: new URL(origin).host, Origin: origin,
          'Content-Type': 'application/json', 'X-Inkspire-Client': '1', ...patch } }, res => {
        let body = ''; res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolveResponse({ status: res.statusCode ?? 0, body }));
      });
      const deadline = setTimeout(() => req.destroy(new Error('Docker HTTPS deadline')), 10000);
      req.once('close', () => clearTimeout(deadline));
      req.once('error', reject);
      req.end(payload === undefined ? undefined : JSON.stringify(payload));
    });
  }

  await poll(async () => { assert.equal((await send('GET', '/')).status, 200); });
  await assert.rejects(send('GET', '/', undefined, {}, ''), error =>
    ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT',
      'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_SIGNATURE_FAILURE'].includes((error as NodeJS.ErrnoException).code ?? ''));
  for (const path of ['/.env', '/.env.docker', '/.inkspire-lan/Caddyfile',
    '/.inkspire-lan/data/pki/authorities/local/root.key', '/api/missing']) {
    assert.equal((await send('GET', path)).status, 404);
  }
  for (const path of ['/fonts/space-grotesk.ttf', '/excalidraw/worker/subset-worker.chunk.js', '/notices/packages.json']) {
    assert.equal((await send('GET', path)).status, 200);
  }
  const invalidHeaders: Record<string, string>[] = [{ Origin: 'https://evil.example' }, { Host: 'evil.example' }];
  for (const patch of invalidHeaders) {
    assert.equal((await send('POST', '/api/ai/generate', { prompt: 'mock ink' }, patch)).status, 403);
  }
  assert.equal(mock.calls.length, 0);
  const t2i = await send('POST', '/api/ai/generate', { prompt: 'mock ink' });
  assert.equal(t2i.status, 200);
  assert(!t2i.body.includes(TEST_TOKEN));
  assert.equal(mock.calls[0]?.path, '/api/service/generate');
  assert.equal(mock.calls[0]?.headers.authorization, `Bearer ${TEST_TOKEN}`);
  const png = (JSON.parse(t2i.body) as { data: { b64_json: string }[] }).data[0]?.b64_json;
  assert(png);
  const i2i = await send('POST', '/api/ai/generate', { prompt: 'mock variation', images: [png] });
  assert.equal(i2i.status, 200);
  assert(!i2i.body.includes(TEST_TOKEN));
  assert.equal(mock.calls.length, 2);
  const referenceBody = mock.calls[1]?.body as { images?: string[] };
  assert.equal(referenceBody.images?.length, 1);

  for (const service of ['lan-config', 'proxy']) {
    const id = (await compose(['ps', '--all', '-q', service])).trim();
    assert(id && !id.includes('\n'));
    const env = await docker(['inspect', '--format', '{{json .Config.Env}}', id]);
    assert(!env.includes('MAPIC_') && !env.includes(TEST_TOKEN), `${service} must have no service credentials`);
  }

  mock.setMode({ kind: 'held' });
  const first = send('POST', '/api/ai/generate', { prompt: 'held mock' });
  // Attach a rejection handler immediately, so a failure while polling never leaves an unhandled promise.
  const held = first.then(value => ({ value }), () => ({ value: undefined }));
  await poll(async () => { assert.equal(mock!.calls.length, 1); });
  try {
    assert.equal((await send('POST', '/api/ai/generate', { prompt: 'second mock' })).status, 409);
    assert.equal(mock.calls.length, 1);
  } finally { await fetch(`${mock.origin}/__test/release`, { method: 'POST' }); }
  assert.equal((await held).value?.status, 200);

  const savedCA = ca;
  await compose(['down']);
  assert.equal((await compose(['ps', '--status', 'running', '-q'])).trim(), '');
  // Binding the released ports must work; a surviving listener fails this gate.
  for (const [host, port] of [['127.0.0.1', appPort], [ip, proxyPort]] as const) {
    const server = createServer();
    await new Promise<void>((resolveListen, reject) => {
      server.once('error', reject); server.listen(port, host, resolveListen);
    });
    await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  }
  await compose(['up', '-d', '--no-build']);
  await poll(async () => {
    ca = await compose(['exec', '-T', 'proxy', 'cat', '/app/.inkspire-lan/data/pki/authorities/local/root.crt']);
    assert.equal(ca, savedCA);
    assert.equal((await send('GET', '/')).status, 200);
  });
  console.log('PASS: Linux Docker TLS, guards, mock T2I/I2I, slot, retained CA and stop');
} finally {
  let cleaned = !attempted;
  try {
    if (attempted) await compose(['down', '--volumes', '--remove-orphans']);
    cleaned = true;
  } catch {
    throw new Error(`Cleanup failed for ${project}; fixture retained at ${fixture}`);
  } finally {
    await mock?.close();
    if (cleaned) await rm(fixture, { recursive: true, force: true });
  }
}
