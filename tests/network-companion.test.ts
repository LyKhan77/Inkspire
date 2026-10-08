import { afterEach, expect, test } from 'vitest';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { startApp } from '../server/app';
import { readConfig } from '../server/config';
import { startMock, TEST_TOKEN } from './mock-mapic';

const closes: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of closes.splice(0).reverse()) await close(); });
const origin = 'https://192.168.1.20:8443';

async function setup() {
  const mock = await startMock(); closes.push(mock.close);
  const app = await startApp({
    ...readConfig({ INKSPIRE_PUBLIC_ORIGIN: origin }), port: 0,
    mapicBaseURL: mock.origin, mapicServiceToken: TEST_TOKEN, generationTimeoutMs: 2000,
  });
  closes.push(app.close);
  const upstream = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  function send(path = '/api/ai/generate', patch: Record<string, string> = {}, method = 'POST') {
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = request(upstream + path, { method, headers: {
        Host: new URL(origin).host, Origin: origin, 'Content-Type': 'application/json',
        'X-Inkspire-Client': '1', ...patch,
      } }, res => {
        let body = ''; res.setEncoding('utf8');
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode!, body }));
      });
      req.on('error', reject);
      req.end(method === 'POST' ? JSON.stringify({ prompt: 'ink' }) : undefined);
    });
  }
  return { app, mock, upstream, send };
}

test('preserve HTTPS origin while listening only on loopback', async () => {
  const { app, send } = await setup();
  expect(app.origin).toBe(origin);
  expect(app.server.address()).toMatchObject({ address: '127.0.0.1' });
  expect((await send('/', {}, 'GET')).status).toBe(200);
  expect((await send()).status).toBe(200);
  for (const path of ['/.inkspire-lan/Caddyfile', '/.inkspire-lan/data/pki/authorities/local/root.key', '/.env']) {
    expect((await send(path, {}, 'GET')).status).toBe(404);
  }
});

test('forwarded headers cannot rescue invalid Host or Origin', async () => {
  const { send, mock, upstream } = await setup();
  const patches: Record<string, string>[] = [
    { Host: new URL(upstream).host }, { Origin: 'http://192.168.1.20:8443' },
    { Origin: 'https://192.168.1.21:8443' }, { Origin: 'null' },
    { Host: 'evil.example', 'X-Forwarded-Host': new URL(origin).host,
      'X-Forwarded-Proto': 'https', Forwarded: `host=${new URL(origin).host};proto=https` },
  ];
  for (const patch of patches) expect((await send('/api/ai/generate', patch)).status).toBe(403);
  expect(mock.calls).toHaveLength(0);
});

test('two clients share one generation slot', async () => {
  const { send, mock } = await setup(); mock.setMode({ kind: 'held' });
  const first = send();
  await expect.poll(() => mock.calls.length).toBe(1);
  const second = await send();
  expect(second.status).toBe(409);
  expect(JSON.parse(second.body)).toMatchObject({ error: { code: 'REQUEST_ACTIVE' } });
  expect(mock.calls).toHaveLength(1);
  await fetch(mock.origin + '/__test/release', { method: 'POST' });
  expect((await first).status).toBe(200);
  expect(mock.calls).toHaveLength(1);
  mock.setMode({ kind: 'success' }); // Existing mock resets its call list on mode changes.
  expect((await send()).status).toBe(200);
  expect(mock.calls).toHaveLength(1);
});

test('localhost default still reports its actual ephemeral port', async () => {
  const mock = await startMock(); closes.push(mock.close);
  const app = await startApp({ ...readConfig({}), port: 0, mapicBaseURL: mock.origin,
    mapicServiceToken: TEST_TOKEN, generationTimeoutMs: 2000 });
  closes.push(app.close);
  const port = (app.server.address() as AddressInfo).port;
  expect(app.origin).toBe(`http://127.0.0.1:${port}`);
  expect(app.server.address()).toMatchObject({ address: '127.0.0.1' });
});