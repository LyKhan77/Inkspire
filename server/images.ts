import sharp from 'sharp';
import { RequestError } from './request.js';
import { GENERATION_LIMITS as L } from '../src/features/ai/contract.js';
function hasPNGAnimation(bytes: Buffer): boolean {
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    if (bytes.toString('ascii', offset + 4, offset + 8) === 'acTL') return true;
    const next = offset + bytes.readUInt32BE(offset) + 12;
    if (next > bytes.length) break;
    offset = next;
  }
  return false;
}
function decode(base64: string, maxCharacters: number, maxBytes: number, invalid: () => RequestError, oversize: () => RequestError) {
  if (base64.length > maxCharacters) throw oversize();
  if (!base64.length || base64.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)) throw invalid();
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length > maxBytes) throw oversize();
  if (buffer.toString('base64') !== base64) throw invalid();
  return buffer;
}
export async function validateReferenceImage(base64: string, index: number): Promise<void> {
  const field = `images.${index}`;
  const invalid = () => new RequestError(422, 'INVALID_IMAGE', 'Referensi harus PNG/JPEG valid, maksimal sisi 2048 px.', false, field);
  const bytes = decode(base64, L.base64Characters, L.referenceBytes, invalid, () => new RequestError(413, 'IMAGE_TOO_LARGE', 'Ukuran referensi melebihi batas.', false, field));
  if (hasPNGAnimation(bytes)) throw invalid();
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: L.referencePixels });
    const meta = await image.metadata();
    if (!['png', 'jpeg'].includes(meta.format ?? '') || !meta.width || !meta.height || meta.width > L.referenceSide || meta.height > L.referenceSide || meta.width * meta.height > L.referencePixels || (meta.pages ?? 1) !== 1) throw invalid();
    await image.raw().toBuffer();
  } catch { throw invalid(); }
}
export async function validateResultPNG(base64: string): Promise<void> {
  const invalid = () => new RequestError(502, 'INVALID_RESULT', 'Layanan mengirim hasil gambar tidak valid.', true);
  const bytes = decode(base64, L.bodyBytes, L.bodyBytes, invalid, invalid);
  if (hasPNGAnimation(bytes)) throw invalid();
  try {
    const image = sharp(bytes, { failOn: 'warning', limitInputPixels: 16_777_216 });
    const meta = await image.metadata();
    if (meta.format !== 'png' || (meta.pages ?? 1) !== 1) throw invalid();
    await image.raw().toBuffer();
  } catch { throw invalid(); }
}
