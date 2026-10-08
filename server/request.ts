import type { IncomingMessage } from 'node:http';
import type { GenerateRequest } from '../src/features/ai/contract.js';
import { GENERATION_LIMITS as L } from '../src/features/ai/contract.js';
export class RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly outcomeUnknown = false, readonly field?: string) { super(message); this.name = 'RequestError'; }
}
export function requireLocalRequest(req: IncomingMessage, origin: string) {
  if (req.headers.host !== new URL(origin).host || req.headers.origin !== origin || req.headers['x-inkspire-client'] !== '1' || req.headers['sec-fetch-site'] === 'cross-site') throw new RequestError(403, 'LOCAL_ONLY', 'Akses lokal ditolak.');
  if (req.method !== 'POST') throw new RequestError(405, 'METHOD_NOT_ALLOWED', 'Gunakan POST.');
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) throw new RequestError(415, 'JSON_REQUIRED', 'Gunakan JSON.');
}
export function readJSONBody(req: IncomingMessage, maxBytes: number): Promise<unknown> {
  const length = req.headers['content-length'];
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes)) { req.resume(); return Promise.reject(new RequestError(413, 'BODY_TOO_LARGE', 'Body melebihi batas.')); }
  return new Promise((resolve, reject) => {
    let bytes = 0; let chunks: Buffer[] = []; let finished = false;
    function fail(error: RequestError) { if (finished) return; finished = true; chunks = []; reject(error); }
    req.on('data', (chunk: Buffer) => {
      if (finished) return; bytes += chunk.length;
      if (bytes > maxBytes) { fail(new RequestError(413, 'BODY_TOO_LARGE', 'Body melebihi batas.')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => { if (finished) return; finished = true; try { const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)); resolve(JSON.parse(text)); } catch { reject(new RequestError(400, 'INVALID_JSON', 'JSON tidak valid.')); } chunks = []; });
    req.on('error', () => fail(new RequestError(400, 'BODY_INTERRUPTED', 'Body gagal diterima.')));
    req.on('aborted', () => fail(new RequestError(400, 'BODY_INTERRUPTED', 'Body gagal diterima.')));
  });
}
export function validateGenerate(value: unknown): GenerateRequest {
  function invalid(field: string, message: string): never { throw new RequestError(422, 'INVALID_INPUT', message, false, field); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('body', 'Request harus berupa objek JSON.');
  const v = value as Record<string, unknown>;
  const allowed = ['prompt', 'images', 'negative_prompt', 'true_cfg_scale', 'num_inference_steps', 'resolution'];
  for (const key of Object.keys(v)) if (!allowed.includes(key)) invalid('body', 'Field request tidak dikenal.');
  if (typeof v.prompt !== 'string' || !v.prompt.trim() || Array.from(v.prompt).length > L.promptCharacters) invalid('prompt', 'Prompt wajib diisi, maksimal 2000 karakter.');
  if (v.images !== undefined && (!Array.isArray(v.images) || v.images.length > L.references || v.images.some(i => typeof i !== 'string'))) invalid('images', 'Maksimal 10 referensi PNG/JPEG.');
  if (v.negative_prompt !== undefined && typeof v.negative_prompt !== 'string') invalid('negative_prompt', 'Negative prompt harus berupa teks.');
  const steps = v.num_inference_steps === undefined ? 40 : v.num_inference_steps; const cfg = v.true_cfg_scale === undefined ? 1 : v.true_cfg_scale; const resolution = v.resolution === undefined ? 1024 : v.resolution;
  if (typeof steps !== 'number' || !Number.isInteger(steps) || steps < L.stepsMin || steps > L.stepsMax) invalid('num_inference_steps', 'Steps harus 20–75.');
  if (typeof cfg !== 'number' || !Number.isFinite(cfg) || cfg < L.cfgMin || cfg > L.cfgMax) invalid('true_cfg_scale', 'CFG harus 1–3.');
  if (resolution !== L.resolution) invalid('resolution', 'Resolusi harus 1024.');
  return { prompt: v.prompt as string, ...(v.images === undefined ? {} : { images: v.images as string[] }), ...(v.negative_prompt === undefined ? {} : { negative_prompt: v.negative_prompt as string }), num_inference_steps: steps as number, true_cfg_scale: cfg as number, resolution: 1024 };
}
