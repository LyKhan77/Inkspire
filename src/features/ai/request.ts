import type { GenerateRequest, GenerateSuccess, GenerateFailure } from './contract';
import { GENERATION_LIMITS } from './contract';
const unknownFailure: GenerateFailure = { error: { code: 'CONNECTION_LOST', message: 'Koneksi terputus. Generation mungkin masih berjalan; hasil belum diketahui.', outcomeUnknown: true } };
export async function requestImage(payload: GenerateRequest, fetcher: typeof fetch = fetch): Promise<GenerateSuccess> {
  const body = JSON.stringify(payload);
  if (new TextEncoder().encode(body).length > GENERATION_LIMITS.bodyBytes) throw { error: { code: 'BODY_TOO_LARGE', message: 'Ukuran request melebihi 32 MiB.', outcomeUnknown: false, field: 'images' } } satisfies GenerateFailure;
  try {
    const response = await fetcher('/api/ai/generate', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Inkspire-Client': '1' }, body });
    let result: unknown; try { result = await response.json(); } catch { throw unknownFailure; }
    const value = result as GenerateFailure & GenerateSuccess;
    if (!response.ok) {
      if (typeof value?.error?.code === 'string' && typeof value.error.message === 'string' && typeof value.error.outcomeUnknown === 'boolean') throw { error: { code: value.error.code, message: value.error.message, outcomeUnknown: value.error.outcomeUnknown, ...(typeof value.error.field === 'string' ? { field: value.error.field } : {}) } } satisfies GenerateFailure;
      throw unknownFailure;
    }
    if (!Array.isArray(value?.data) || value.data.length !== 1 || typeof value.data[0]?.b64_json !== 'string') throw unknownFailure;
    return { data: [{ b64_json: value.data[0].b64_json }] };
  } catch (error) { if ((error as GenerateFailure)?.error) throw error; throw unknownFailure; }
}
