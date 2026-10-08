import sharp from 'sharp';
import type { DraftRecord } from '../src/features/workspace/draft';
export function makeDraft(workspaceId = 'a', revision = 1): DraftRecord {
  return { schemaVersion: 1, workspaceId, revision, name: 'Workspace test', sceneJSON: JSON.stringify(emptyScene), viewport: { scrollX: 0, scrollY: 0, zoom: 1 }, updatedAt: 1 };
}
export function makePNG(width = 32, height = 32) {
  return sharp({ create: { width, height, channels: 4, background: '#ed5037' } }).png().toBuffer();
}
export function makeJPEG(width = 32, height = 32) {
  return sharp({ create: { width, height, channels: 4, background: '#ed5037' } }).removeAlpha().jpeg().toBuffer();
}
export async function makeAnimatedPNG() {
  const png = await makePNG();
  const body = Buffer.alloc(12); body.write('acTL'); body.writeUInt32BE(2, 4);
  let crc = 0xffffffff;
  for (const byte of body) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  const length = Buffer.alloc(4); length.writeUInt32BE(8);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([png.subarray(0, 33), length, body, checksum, png.subarray(33)]);
}
export const emptyScene = { type: 'excalidraw', version: 2, source: 'inkspire', elements: [], appState: { viewBackgroundColor: '#fcfbf7' }, files: {} };
