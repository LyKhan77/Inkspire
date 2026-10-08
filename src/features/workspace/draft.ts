export interface DraftRecord {
  schemaVersion: 1; workspaceId: string; revision: number; name: string; sceneJSON: string;
  viewport: { scrollX: number; scrollY: number; zoom: number }; updatedAt: number;
}
export interface DraftStore { read(): Promise<DraftRecord | null>; write(record: DraftRecord): Promise<void>; close(): void }
function validateRecord(value: unknown): DraftRecord {
  const record = value as DraftRecord;
  if (!record || record.schemaVersion !== 1 || typeof record.workspaceId !== 'string' || !record.workspaceId || !Number.isSafeInteger(record.revision) || record.revision < 0 || typeof record.name !== 'string' || typeof record.sceneJSON !== 'string' || !Number.isFinite(record.updatedAt) || !record.viewport || ![record.viewport.scrollX, record.viewport.scrollY, record.viewport.zoom].every(Number.isFinite) || record.viewport.zoom <= 0) throw new Error('Draft tidak valid.');
  const scene = JSON.parse(record.sceneJSON);
  if (scene.type !== 'excalidraw' || !Array.isArray(scene.elements) || !scene.files || typeof scene.files !== 'object' || Array.isArray(scene.files) || !scene.appState) throw new Error('Scene draft tidak valid.');
  for (const element of scene.elements) {
    if (element.type === 'image' && !element.isDeleted && (!element.fileId || !scene.files[element.fileId]?.dataURL)) throw new Error('Aset draft tidak lengkap.');
  }
  return record;
}
export async function openDraftStore(databaseName = 'inkspire'): Promise<DraftStore> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(databaseName, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('workspace'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('Draft sedang dipakai tab lain.'));
  });
  db.onversionchange = () => db.close();
  return {
    read() { return new Promise((resolve, reject) => {
      const tx = db.transaction('workspace', 'readonly');
      let result: unknown;
      const req = tx.objectStore('workspace').get('active'); req.onsuccess = () => { result = req.result; };
      tx.oncomplete = () => { try { resolve(result === undefined ? null : validateRecord(result)); } catch (error) { reject(error); } };
      tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Draft gagal dibaca.'));
    }); },
    write(record) { return new Promise((resolve, reject) => {
      try {
        validateRecord(record);
        const tx = db.transaction('workspace', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('Draft gagal ditulis.'));
        tx.objectStore('workspace').put(record, 'active');
      } catch (error) { reject(error); }
    }); },
    close() { db.close(); },
  };
}
