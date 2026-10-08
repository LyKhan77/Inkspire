import type { GenerateRequest, GenerateSuccess } from '../src/features/ai/contract.js';
import type { AppConfig } from './config.js';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { GENERATION_LIMITS } from '../src/features/ai/contract.js';
import { RequestError } from './request.js';
import { validateResultPNG } from './images.js';
const messages: Record<number, string> = {
  401: 'Konfigurasi autentikasi layanan perlu diperiksa di backend.',
  413: 'Ukuran referensi atau request melebihi batas layanan.',
  422: 'Input generation ditolak layanan. Periksa prompt dan referensi.',
  429: 'Layanan sedang penuh. Coba lagi secara manual nanti.',
  500: 'Layanan generation gagal. Hasil belum diketahui.',
  502: 'Layanan generation gagal. Hasil belum diketahui.',
  503: 'Service generation belum diaktifkan.',
  504: 'Waktu tunggu habis. Generation mungkin masih berjalan.',
};
export async function generateWithMaPic(payload: GenerateRequest, config: AppConfig): Promise<GenerateSuccess> {
  if (!config.mapicBaseURL || !config.mapicServiceToken) throw new RequestError(503, 'SERVICE_UNCONFIGURED', 'Konfigurasi MaPic belum tersedia di backend.');
  const url = new URL('/api/service/generate', config.mapicBaseURL);
  const body = JSON.stringify(payload); const signal = AbortSignal.timeout(config.generationTimeoutMs);
  return new Promise((resolve, reject) => {
    let finished = false;
    const fail = (error: RequestError) => { if (!finished) { finished = true; reject(error); } };
    const req = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      method: 'POST', signal, headers: { Authorization: `Bearer ${config.mapicServiceToken}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      const status = res.statusCode ?? 502;
      if (status !== 200) { res.resume(); fail(new RequestError(messages[status] ? status : 502, `MAPIC_${messages[status] ? status : 502}`, messages[status] ?? messages[502]!, [500, 502, 504].includes(status) || !messages[status])); return; }
      let bytes = 0; const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        if (finished) return;
        bytes += chunk.length;
        if (bytes > GENERATION_LIMITS.bodyBytes) { fail(new RequestError(502, 'INVALID_RESULT', 'Respons layanan melebihi batas.', true)); res.destroy(); return; }
        chunks.push(chunk);
      });
      res.on('end', () => {
        if (finished) return;
        void (async () => {
          try {
            const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            if (!Array.isArray(value?.data) || value.data.length !== 1 || typeof value.data[0]?.b64_json !== 'string') throw new Error();
            const base64 = value.data[0].b64_json as string; await validateResultPNG(base64);
            if (!finished) { finished = true; resolve({ data: [{ b64_json: base64 }] }); }
          } catch { fail(new RequestError(502, 'INVALID_RESULT', 'Layanan mengirim hasil tidak valid.', true)); }
        })();
      });
      res.on('error', () => fail(new RequestError(502, 'TRANSPORT_ERROR', 'Koneksi terputus. Generation mungkin masih berjalan.', true)));
      res.on('aborted', () => fail(new RequestError(502, 'TRANSPORT_ERROR', 'Koneksi terputus. Generation mungkin masih berjalan.', true)));
    });
    req.on('error', () => fail(signal.aborted ? new RequestError(504, 'GENERATION_TIMEOUT', messages[504]!, true) : new RequestError(502, 'TRANSPORT_ERROR', 'Koneksi layanan gagal. Hasil belum diketahui.', true)));
    req.end(body);
  });
}
