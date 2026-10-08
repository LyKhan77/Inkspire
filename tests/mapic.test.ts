import { afterEach, expect, test } from 'vitest';
import { generateWithMaPic } from '../server/mapic';
import type { AppConfig } from '../server/config';
import { startMock, TEST_TOKEN } from './mock-mapic';
import { makePNG } from './fixtures';
const mocks: Awaited<ReturnType<typeof startMock>>[] = [];
afterEach(async () => { await Promise.all(mocks.splice(0).map(m => m.close())); });
async function setup() { const mock = await startMock(); mocks.push(mock); return { mock, config: { port: 0, origin: 'http://127.0.0.1:0', mode: 'production', mapicBaseURL: mock.origin, mapicServiceToken: TEST_TOKEN, generationTimeoutMs: 1000 } as AppConfig }; }
test('exact service endpoint, machine auth and I2I payload, single request', async () => {
  const { mock, config } = await setup(); const images = [(await makePNG()).toString('base64')];
  const response = await generateWithMaPic({ prompt: 'Tinta', images, resolution: 1024, num_inference_steps: 40, true_cfg_scale: 1 }, config);
  expect(response.data[0].b64_json).toBeTruthy(); expect(mock.calls).toHaveLength(1);
  expect(mock.calls[0]).toMatchObject({ path: '/api/service/generate', headers: { authorization: `Bearer ${TEST_TOKEN}` }, body: { images, prompt: 'Tinta' } });
});
test.each([401, 413, 422, 429, 500, 502, 503, 504, 302])('sanitized HTTP %i without following redirects or retries', async status => {
  const { mock, config } = await setup(); mock.setMode({ kind: 'status', status });
  const error = await generateWithMaPic({ prompt: 'ink' }, config).catch(e => e);
  expect(error.status).toBe(status === 302 ? 502 : status); expect(JSON.stringify(error)).not.toContain(TEST_TOKEN); expect(error.message).not.toContain(TEST_TOKEN); expect(mock.calls).toHaveLength(1);
});
test('absolute transport deadline and disconnect produce unknown outcome without retry', async () => {
  const { mock, config } = await setup(); mock.setMode({ kind: 'delayed', delay: 200 });
  await expect(generateWithMaPic({ prompt: 'ink' }, { ...config, generationTimeoutMs: 50 })).rejects.toMatchObject({ status: 504, outcomeUnknown: true }); expect(mock.calls).toHaveLength(1);
  mock.setMode({ kind: 'disconnect' }); await expect(generateWithMaPic({ prompt: 'ink' }, config)).rejects.toMatchObject({ status: 502, outcomeUnknown: true }); expect(mock.calls).toHaveLength(1);
});
test('invalid result is not returned as preview', async () => {
  const { mock, config } = await setup(); mock.setMode({ kind: 'invalid-result' });
  await expect(generateWithMaPic({ prompt: 'ink' }, config)).rejects.toMatchObject({ status: 502 }); expect(mock.calls).toHaveLength(1);
});
test.each(['invalid-json', 'oversize-result'] as const)('malformed downstream %s is bounded, sanitized and never retried', async kind => {
  const { mock, config } = await setup(); mock.setMode({ kind });
  await expect(generateWithMaPic({ prompt: 'ink' }, config)).rejects.toMatchObject({ status: 502, outcomeUnknown: true });
  expect(mock.calls).toHaveLength(1);
});
test('connection refusal gives sanitized unknown outcome without retry', async () => {
  const { mock, config } = await setup(); await mock.close(); mocks.splice(mocks.indexOf(mock), 1);
  await expect(generateWithMaPic({ prompt: 'ink' }, config)).rejects.toMatchObject({ status: 502, outcomeUnknown: true });
  expect(mock.calls).toHaveLength(0);
});
