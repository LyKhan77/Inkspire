import { GENERATION_LIMITS as L } from './contract';
export interface PreparedReference { base64: string; mime: 'image/png' | 'image/jpeg'; width: number; height: number }
export interface Reference extends PreparedReference { id: string; name: string }
export async function prepareReference(blob: Blob): Promise<PreparedReference> {
  if (!['image/png', 'image/jpeg'].includes(blob.type)) throw new Error('Referensi harus PNG atau JPEG.');
  const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  const png = header[0] === 137 && header[1] === 80 && header[2] === 78 && header[3] === 71;
  const jpeg = header[0] === 255 && header[1] === 216 && header[2] === 255;
  if (!png && !jpeg) throw new Error('Isi referensi bukan PNG/JPEG valid.');
  const bitmap = await createImageBitmap(blob);
  try {
    let scale = Math.min(1, L.referenceSide / Math.max(bitmap.width, bitmap.height), Math.sqrt(L.referencePixels / (bitmap.width * bitmap.height)));
    const canvas = document.createElement('canvas'); const context = canvas.getContext('2d');
    if (!context) throw new Error('Gambar tidak dapat disiapkan.');
    const mime = png ? 'image/png' as const : 'image/jpeg' as const;
    for (let attempt = 0; attempt < 24; attempt++) {
      canvas.width = Math.max(1, Math.floor(bitmap.width * scale)); canvas.height = Math.max(1, Math.floor(bitmap.height * scale));
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const encoded = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Encode referensi gagal.')), mime, .92));
      const base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve((reader.result as string).split(',')[1]!); reader.onerror = () => reject(new Error('Referensi gagal dibaca.')); reader.readAsDataURL(encoded); });
      if (encoded.size <= L.referenceBytes && base64.length <= L.base64Characters) return { base64, mime, width: canvas.width, height: canvas.height };
      scale *= .8;
    }
    throw new Error('Referensi tidak dapat memenuhi batas ukuran.');
  } finally { bitmap.close(); }
}
