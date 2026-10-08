import 'fake-indexeddb/auto';
import { expect, test, vi } from 'vitest';
import { openDraftStore } from '../src/features/workspace/draft';
import { makeDraft } from './fixtures';
test('draft native round trip after closing database', async () => {
  const name = crypto.randomUUID(); const store = await openDraftStore(name);
  expect(await store.read()).toBeNull();
  await store.write(makeDraft()); store.close();
  const reopened = await openDraftStore(name);
  expect(await reopened.read()).toEqual(makeDraft()); reopened.close();
});
test('transaction abort preserves last record and rejects write', async () => {
  const store = await openDraftStore(crypto.randomUUID()); await store.write(makeDraft());
  const original = IDBObjectStore.prototype.put;
  const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<typeof original>) {
    const request = original.apply(this, args); this.transaction.abort(); return request;
  });
  await expect(store.write(makeDraft('b'))).rejects.toBeDefined(); spy.mockRestore();
  expect(await store.read()).toEqual(makeDraft()); store.close();
});
test('corrupt record is reported and retained for recovery', async () => {
  const name = crypto.randomUUID(); const store = await openDraftStore(name); store.close();
  const db = await new Promise<IDBDatabase>(resolve => { const req = indexedDB.open(name); req.onsuccess = () => resolve(req.result); });
  await new Promise<void>(resolve => { const tx = db.transaction('workspace', 'readwrite'); tx.objectStore('workspace').put({ schemaVersion: 99 }, 'active'); tx.oncomplete = () => resolve(); }); db.close();
  const reopened = await openDraftStore(name); await expect(reopened.read()).rejects.toBeDefined(); reopened.close();
});
