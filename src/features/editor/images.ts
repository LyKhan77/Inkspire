import { CaptureUpdateAction, convertToExcalidrawElements } from '@excalidraw/excalidraw';
import type { BinaryFileData, DataURL, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { FileId } from '@excalidraw/excalidraw/element/types';
export function addPNGElement(api: ExcalidrawImperativeAPI, file: BinaryFileData, box: { x: number; y: number; width: number; height: number }) {
  api.addFiles([file]);
  const elements = convertToExcalidrawElements([{ type: 'image', fileId: file.id, status: 'saved', scale: [1, 1], ...box }]);
  api.updateScene({ elements: [...api.getSceneElementsIncludingDeleted(), ...elements], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
}
export async function insertPNG(api: ExcalidrawImperativeAPI, dataURL: string, dimensions: { width: number; height: number }, position: { x: number; y: number }, canInsert = () => true) {
  const blob = await (await fetch(dataURL)).blob();
  const bytes = await blob.arrayBuffer(); const bitmap = await createImageBitmap(blob);
  try { if (bitmap.width !== dimensions.width || bitmap.height !== dimensions.height) throw new Error('Dimensi hasil tidak valid.'); } finally { bitmap.close(); }
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const id = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('') as FileId;
  const file: BinaryFileData = { id, dataURL: dataURL as DataURL, mimeType: 'image/png', created: Date.now() };
  const state = api.getAppState(); const scale = Math.min(1, state.width * .65 / state.zoom.value / dimensions.width, state.height * .65 / state.zoom.value / dimensions.height);
  const width = dimensions.width * scale; const height = dimensions.height * scale;
  if (!canInsert()) throw new Error('Workspace berubah saat gambar disiapkan. Pilih Tambahkan lagi untuk target aktif.');
  addPNGElement(api, file, { x: position.x - width / 2, y: position.y - height / 2, width, height });
}
