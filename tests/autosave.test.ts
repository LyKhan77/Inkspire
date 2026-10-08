import { expect, test, vi } from 'vitest';
import { createAutosave } from '../src/features/workspace/autosave';
import type { AutosaveStatus } from '../src/features/workspace/autosave';
import type { DraftRecord, DraftStore } from '../src/features/workspace/draft';
import { makeDraft } from './fixtures';
test('old write cannot overwrite replacement or mark it saved', async () => {
  let release = () => {}; const barrier = new Promise<void>(resolve => { release = resolve; });
  const writes: DraftRecord[] = []; const statuses: AutosaveStatus[] = [];
  const store: DraftStore = { read: async () => null, close() {}, write: async record => { if (record.workspaceId === 'a') await barrier; writes.push(record); } };
  const autosave = createAutosave(store, { onStatus: s => statuses.push(s) });
  autosave.schedule(makeDraft('a')); const first = autosave.flush(); await Promise.resolve();
  const marker = statuses.length; const replace = autosave.replace(makeDraft('b')); release();
  await Promise.all([first, replace]); await autosave.flush();
  expect(writes.at(-1)?.workspaceId).toBe('b');
  expect(statuses.slice(marker).filter(s => s.kind === 'saved').map(s => s.workspaceId)).toEqual(['b']); autosave.dispose();
});
test('new revision during write stays saving until its own transaction completes', async () => {
  let release = () => {}; const barrier = new Promise<void>(resolve => { release = resolve; }); const statuses: AutosaveStatus[] = [];
  const writes: number[] = [];
  const store: DraftStore = { read: async () => null, close() {}, write: async record => { if (record.revision === 1) await barrier; writes.push(record.revision); } };
  const autosave = createAutosave(store, { onStatus: s => statuses.push(s) });
  autosave.schedule(makeDraft('a', 1)); const first = autosave.flush(); await Promise.resolve();
  autosave.schedule(makeDraft('a', 2)); const second = autosave.flush(); release(); await Promise.all([first, second]);
  expect(writes).toEqual([1, 2]); expect(statuses.filter(s => s.kind === 'saved').map(s => s.revision)).toEqual([2]); autosave.dispose();
});
test('failure never reports saved; scheduler can recover', async () => {
  const write = vi.fn().mockRejectedValueOnce(new Error('quota')).mockResolvedValue(undefined); const statuses: AutosaveStatus[] = [];
  const auto = createAutosave({ read: async () => null, write, close() {} }, { onStatus: s => statuses.push(s) });
  auto.schedule(makeDraft()); await auto.flush(); expect(statuses.at(-1)?.kind).toBe('error');
  auto.schedule(makeDraft('a', 2)); await auto.flush(); expect(statuses.at(-1)?.kind).toBe('saved'); auto.dispose();
});
test('dispose cancels timers', async () => {
  vi.useFakeTimers(); const write = vi.fn(); const auto = createAutosave({ read: async () => null, write, close() {} }, { onStatus() {} });
  auto.schedule(makeDraft()); auto.dispose(); await vi.runAllTimersAsync(); expect(write).not.toHaveBeenCalled(); vi.useRealTimers();
});
