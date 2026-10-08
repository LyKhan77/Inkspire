import { expect, test, vi } from 'vitest';
import { requestImage } from '../src/features/ai/request';
test('disconnect never retries or claims cancellation', async () => {
  const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Network failed'));
  await expect(requestImage({ prompt: 'Tinta hitam' }, fetcher)).rejects.toMatchObject({ error: { outcomeUnknown: true } }); expect(fetcher).toHaveBeenCalledTimes(1);
});
test('same-origin client marker without browser Authorization', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ data: [{ b64_json: 'png' }] })));
  await requestImage({ prompt: 'ink' }, fetcher); expect(fetcher.mock.calls[0]).toEqual(['/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Inkspire-Client': '1' }, body: '{"prompt":"ink"}' }]);
});
