import type { DraftRecord, DraftStore } from './draft';
export interface AutosaveStatus { kind: 'saving' | 'saved' | 'error'; workspaceId: string; revision: number }
export function createAutosave(store: DraftStore, options: { onStatus(status: AutosaveStatus): void }) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { record: DraftRecord; epoch: number } | null = null;
  let active: DraftRecord | null = null;
  let epoch = 0; let disposed = false; let chain = Promise.resolve();
  function status(kind: AutosaveStatus['kind'], record: DraftRecord, writeEpoch: number) {
    if (!disposed && epoch === writeEpoch && active?.workspaceId === record.workspaceId && active.revision === record.revision) options.onStatus({ kind, workspaceId: record.workspaceId, revision: record.revision });
  }
  function flush() {
    clearTimeout(timer);
    const snapshot = pending; pending = null;
    if (snapshot && !disposed) {
      chain = chain.then(async () => {
        if (disposed || snapshot.epoch !== epoch) return;
        try { await store.write(snapshot.record); status('saved', snapshot.record, snapshot.epoch); }
        catch { status('error', snapshot.record, snapshot.epoch); }
      });
    }
    return chain;
  }
  function schedule(record: DraftRecord) {
    if (disposed) return;
    active = record; pending = { record: structuredClone(record), epoch }; status('saving', record, epoch);
    clearTimeout(timer); timer = setTimeout(() => { void flush(); }, 250);
  }
  return { schedule, flush, replace(record: DraftRecord) { epoch++; clearTimeout(timer); pending = null; schedule(record); return flush(); }, dispose() { disposed = true; pending = null; clearTimeout(timer); } };
}
