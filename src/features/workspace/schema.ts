export function parseWorkspaceJSON(text: string) {
  const data = JSON.parse(text);
  if (data?.type !== 'excalidraw' || !Array.isArray(data.elements) || !data.appState || typeof data.appState !== 'object' || !data.files || Array.isArray(data.files) || typeof data.files !== 'object') throw new Error('File workspace tidak valid.');
  for (const element of data.elements) {
    if (!element || typeof element.id !== 'string' || typeof element.type !== 'string') throw new Error('Elemen workspace tidak valid.');
    if (element.type === 'image' && !element.isDeleted) {
      const asset = data.files[element.fileId];
      if (!asset || asset.id !== element.fileId || typeof asset.dataURL !== 'string' || !/^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,[A-Za-z0-9+/]+=*$/.test(asset.dataURL)) throw new Error('Aset gambar workspace tidak lengkap.');
    }
  }
  return data;
}
