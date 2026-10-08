import { expect, test } from 'vitest';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { requireLocalRequest, readJSONBody, validateGenerate } from '../server/request';
const origin = 'http://127.0.0.1:4183';
function req(headers: Record<string, string | undefined>, method = 'POST') { return { headers, method } as IncomingMessage; }
test('strict origin, host, client and method guard', () => {
  const headers = { host: '127.0.0.1:4183', origin, 'x-inkspire-client': '1', 'content-type': 'application/json' };
  expect(() => requireLocalRequest(req(headers), origin)).not.toThrow();
  for (const patch of [{ host: 'evil' }, { origin: 'null' }, { origin: '' }, { origin: 'http://evil' }, { 'x-inkspire-client': '' }, { 'sec-fetch-site': 'cross-site' }, { 'content-type': 'text/plain' }]) expect(() => requireLocalRequest(req({ ...headers, ...patch }), origin)).toThrow();
  expect(() => requireLocalRequest(req(headers, 'GET'), origin)).toThrow();
});
test('raw body bounds include chunks and malformed JSON', async () => {
  function body(chunks: string[], headers = {}) { return Object.assign(Readable.from(chunks.map(c => Buffer.from(c))), { headers }) as IncomingMessage; }
  await expect(readJSONBody(body(['{}']), 2)).resolves.toEqual({});
  await expect(readJSONBody(body(['{', ' "x": 1}']), 2)).rejects.toMatchObject({ status: 413 });
  await expect(readJSONBody(body(['{}'], { 'content-length': '100' }), 2)).rejects.toMatchObject({ status: 413 });
  await expect(readJSONBody(body(['{']), 2)).rejects.toMatchObject({ status: 400 });
});
test('Unicode code point prompt and exact parameter boundaries', () => {
  expect(validateGenerate({ prompt: '😀'.repeat(2000) })).toMatchObject({ num_inference_steps: 40, true_cfg_scale: 1, resolution: 1024 });
  for (const value of [null, [], {}, { prompt: '' }, { prompt: '  ' }, { prompt: 1 }, { prompt: '😀'.repeat(2001) }, { prompt: 'a', images: Array(11).fill('x') }, { prompt: 'a', images: [null] }, { prompt: 'a', images: {} }, { prompt: 'a', negative_prompt: 2 }, { prompt: 'a', num_inference_steps: 19 }, { prompt: 'a', num_inference_steps: 76 }, { prompt: 'a', num_inference_steps: 20.5 }, { prompt: 'a', true_cfg_scale: NaN }, { prompt: 'a', true_cfg_scale: 0.99 }, { prompt: 'a', true_cfg_scale: 3.01 }, { prompt: 'a', resolution: 2048 }, { prompt: 'a', MAPIC_BASE_URL: 'http://evil' }, { prompt: 'a', token: 'x' }]) expect(() => validateGenerate(value)).toThrow();
  expect(validateGenerate({ prompt: ' ink ', num_inference_steps: 20, true_cfg_scale: 3 })).toMatchObject({ prompt: ' ink ', num_inference_steps: 20, true_cfg_scale: 3 });
  for (const field of ['num_inference_steps', 'true_cfg_scale', 'resolution']) expect(() => validateGenerate({ prompt: 'ink', [field]: null })).toThrow();
});
