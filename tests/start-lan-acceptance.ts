/**
 * Manual LAN acceptance instance: separate companion, mock MaPic, and Caddy using
 * its own ignored CA. Enabled only for device sign-off; never reads `.env` and
 * never contacts the operator MaPic service or GPU.
 */
import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { startApp } from '../server/app';
import { readConfig } from '../server/config';
import { caddyEnvironment, prepareLAN } from '../server/lan';
import { readPublicOrigin } from '../server/origin';
import { startMock, TEST_TOKEN } from './mock-mapic';

const origin = readPublicOrigin(process.env.INKSPIRE_PUBLIC_ORIGIN);
if (!origin || !process.env.INKSPIRE_PORT) throw new Error('Explicit LAN origin and upstream port required.');
const config = readConfig({ INKSPIRE_PUBLIC_ORIGIN: origin, INKSPIRE_PORT: process.env.INKSPIRE_PORT });
const addresses = Object.values(networkInterfaces()).flatMap(items => items ?? [])
  .filter(item => item.family === 'IPv4').map(item => item.address);
const root = resolve('.inkspire-lan/acceptance');
const file = await prepareLAN(config, root, addresses);
const mock = await startMock();
const app = await startApp({ ...config, mapicBaseURL: mock.origin,
  mapicServiceToken: TEST_TOKEN, generationTimeoutMs: 3_660_000 })
  .catch(async error => { await mock.close(); throw error; });

const child = spawn('caddy', ['run', '--config', file, '--adapter', 'caddyfile'], {
  env: caddyEnvironment(process.env, root), stdio: 'inherit', shell: false,
});

let closing = false;
async function close(code: number) {
  if (closing) return;
  closing = true;
  if (child.pid && child.exitCode === null && child.signalCode === null) {
    await new Promise<void>(done => {
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      child.once('exit', () => { clearTimeout(timer); done(); });
      child.kill('SIGTERM');
    });
  }
  await app.close();
  await mock.close();
  process.exitCode = code;
}

child.once('error', () => { console.error('Caddy acceptance startup failed.'); void close(1); });
child.once('exit', code => { if (!closing) void close(code ?? 1); });
process.once('SIGINT', () => { void close(0); });
process.once('SIGTERM', () => { void close(0); });

console.log(`Acceptance URL: ${origin}`);
console.log(`Acceptance CA: ${resolve(dirname(file), 'data/pki/authorities/local/root.crt')}`);
console.log(`Mock control URL: ${mock.origin}`);