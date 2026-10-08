import { afterEach, expect, test } from 'vitest';
import { request } from 'node:http';
import { startApp } from '../server/app';
import { startMock, TEST_TOKEN } from './mock-mapic';
import { readConfig } from '../server/config';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
async function setup() {
  const mock = await startMock(); cleanup.push(mock.close);
  const app = await startApp({ port: 0, origin: 'http://127.0.0.1:0', mode: 'production', mapicBaseURL: mock.origin, mapicServiceToken: TEST_TOKEN, generationTimeoutMs: 1000 }); cleanup.push(app.close);
  const headers = { Origin: app.origin, 'Content-Type': 'application/json', 'X-Inkspire-Client': '1' };
  return { app, mock, headers };
}
test('foreign origins, browser config fields, bad media and images never reach downstream', async () => {
  const { app, mock, headers } = await setup();
  for (const [patch, body, status] of [[{ Origin: 'http://evil.example' }, { prompt: 'ink' }, 403], [{ Origin: 'null' }, { prompt: 'ink' }, 403], [{ Origin: '' }, { prompt: 'ink' }, 403], [{ 'Sec-Fetch-Site': 'cross-site' }, { prompt: 'ink' }, 403], [{ 'Content-Type': 'text/plain' }, { prompt: 'ink' }, 415], [{}, { prompt: 'ink', base_url: 'http://evil' }, 422], [{}, { prompt: 'ink', token: 'evil' }, 422], [{}, { prompt: 'ink', images: ['bad'] }, 422]] as const) {
    const response = await fetch(app.origin + '/api/ai/generate', { method: 'POST', headers: { ...headers, ...patch }, body: JSON.stringify(body) }); expect(response.status).toBe(status);
  }
  expect(mock.calls).toHaveLength(0);
});
test('oversize chunked raw body returns 413 before downstream', async () => {
  const { app, mock, headers } = await setup();
  const status = await new Promise<number>((resolve, reject) => {
    const req = request(app.origin + '/api/ai/generate', { method: 'POST', headers }, res => { res.resume(); resolve(res.statusCode!); }); req.on('error', reject);
    for (let i = 0; i < 33; i++) req.write(Buffer.alloc(1024 * 1024, 32)); req.end();
  });
  expect(status).toBe(413); expect(mock.calls).toHaveLength(0);
});
test('configuration validation never reflects secrets and static paths never expose operator files', async () => {
  for (const env of [{ INKSPIRE_PORT: 'bad' }, { MAPIC_BASE_URL: `http://user:${TEST_TOKEN}@example.org` }, { MAPIC_SERVICE_TOKEN: TEST_TOKEN + '\n' }]) {
    let error: unknown; try { readConfig(env); } catch (e) { error = e; } expect(error).toBeInstanceOf(Error); expect(String(error)).not.toContain(TEST_TOKEN);
  }
  const { app } = await setup();
  for (const path of ['/.env', '/temp/image-gen.txt', '/server/config.ts', '/%2e%2e%2f.env', '/@fs/etc/passwd']) expect((await fetch(app.origin + path)).status).toBe(404);
});
