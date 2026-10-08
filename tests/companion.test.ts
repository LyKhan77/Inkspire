import { afterEach, expect, test } from 'vitest';
import { request } from 'node:http';
import { startApp } from '../server/app';
import { startMock, TEST_TOKEN } from './mock-mapic';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
async function setup(configured = true) {
  const mock = await startMock(); cleanup.push(mock.close);
  const app = await startApp({ port: 0, origin: 'http://127.0.0.1:0', mode: 'production', mapicBaseURL: configured ? mock.origin : null, mapicServiceToken: configured ? TEST_TOKEN : null, generationTimeoutMs: 1000 }); cleanup.push(app.close);
  const headers = { Origin: app.origin, 'Content-Type': 'application/json', 'X-Inkspire-Client': '1' };
  return { mock, app, headers, post: (body: unknown = { prompt: 'Tinta' }) => fetch(app.origin + '/api/ai/generate', { method: 'POST', headers, body: JSON.stringify(body) }) };
}
test('generation success uses mock once; validation never reaches mock', async () => {
  const { mock, post } = await setup();
  expect((await post({ prompt: ' ' })).status).toBe(422); expect(mock.calls).toHaveLength(0);
  const response = await post(); expect(response.status).toBe(200); expect((await response.json()).data[0].b64_json).toBeTruthy(); expect(mock.calls).toHaveLength(1);
});
test('unconfigured generation leaves canvas working', async () => {
  const { post, mock, app } = await setup(false); expect((await post()).status).toBe(503); expect(mock.calls).toHaveLength(0); expect((await fetch(app.origin)).status).toBe(200);
});
test('one active request persists after browser disconnect', async () => {
  const { mock, app, headers, post } = await setup(); mock.setMode({ kind: 'delayed', delay: 250 });
  const req = request(app.origin + '/api/ai/generate', { method: 'POST', headers }); req.on('error', () => {}); req.end(JSON.stringify({ prompt: 'ink' }));
  await expect.poll(() => mock.calls.length).toBe(1); req.destroy();
  const response = await post(); expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ error: { code: 'REQUEST_ACTIVE', outcomeUnknown: false } });
  expect(mock.calls).toHaveLength(1);
  await new Promise(resolve => setTimeout(resolve, 300)); expect((await post()).status).toBe(200); expect(mock.calls).toHaveLength(2);
});
test('downstream secret never reaches API', async () => {
  const { mock, post } = await setup(); mock.setMode({ kind: 'status', status: 500 }); const response = await post(); expect(response.status).toBe(500); expect(await response.text()).not.toContain(TEST_TOKEN);
});
