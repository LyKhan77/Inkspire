import { serializeAsJSON, loadFromBlob, exportToBlob, exportToSvg } from '@excalidraw/excalidraw';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { parseWorkspaceJSON } from './schema';
export function serializeWorkspace(elements: readonly ExcalidrawElement[], appState: Partial<AppState>, files: BinaryFiles) {
  return serializeAsJSON(elements, appState, files, 'local');
}
export async function readWorkspace(file: Blob) {
  if (file.size > 64 * 1024 * 1024) throw new Error('File workspace melebihi 64 MiB.');
  const data = parseWorkspaceJSON(await file.text());
  for (const element of data.elements) {
    if (element.type === 'image' && !element.isDeleted) {
      const asset = data.files[element.fileId];
      const blob = await (await fetch(asset.dataURL)).blob();
      const bitmap = await createImageBitmap(blob); bitmap.close();
    }
  }
  return loadFromBlob(file, null, null);
}
export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
export function downloadWorkspace(json: string, name: string) { downloadBlob(new Blob([json], { type: 'application/json' }), `${safeName(name)}.excalidraw`); }
function safeName(name: string) { return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Workspace'; }
export async function exportWorkspace(api: ExcalidrawImperativeAPI, name: string, format: 'png' | 'svg', selection = false) {
  const state = api.getAppState();
  const elements = api.getSceneElements().filter(element => !selection || state.selectedElementIds[element.id]);
  if (!elements.length) throw new Error(selection ? 'Pilih objek dahulu.' : 'Canvas masih kosong.');
  const options = { elements, appState: { ...state, exportWithDarkMode: false }, files: api.getFiles() };
  await document.fonts.ready;
  if (format === 'png') downloadBlob(await exportToBlob(options), `${safeName(name)}.png`);
  else downloadBlob(new Blob([(await exportToSvg(options)).outerHTML], { type: 'image/svg+xml' }), `${safeName(name)}.svg`);
}
