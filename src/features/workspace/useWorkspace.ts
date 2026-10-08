import { useCallback, useEffect, useRef, useState } from 'react';
import { CaptureUpdateAction, restore } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI, ExcalidrawProps } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { openDraftStore } from './draft';
import type { DraftRecord } from './draft';
import { createAutosave } from './autosave';
import { serializeWorkspace } from './files';
import { useLanguage } from '../editor/language';
type Scene = ReturnType<typeof restore>;
const empty = () => restore({ elements: [], appState: { viewBackgroundColor: '#fcfbf7' }, files: {} }, null, null);
export function useWorkspace() {
  const { t } = useLanguage();
  const [initialData, setInitialData] = useState<Scene | null>(null);
  const [name, setName] = useState(() => t('Tanpa judul'));
  const [status, setStatus] = useState('Memulihkan draft…');
  const [restoreError, setRestoreError] = useState(false);
  const identity = useRef<{ id: string; name: string; revision: number }>({ id: crypto.randomUUID(), name, revision: 0 });
  // Observable mirror of identity.current.id so a same-name replacement can invalidate render output.
  const [workspaceId, setWorkspaceId] = useState(identity.current.id);
  const autosave = useRef<ReturnType<typeof createAutosave> | null>(null);
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const suppressed = useRef(false);
  const last = useRef('');
  const record = useCallback((elements: readonly ExcalidrawElement[], state: AppState, files: BinaryFiles): DraftRecord => {
    const scene = JSON.parse(serializeWorkspace(elements, state, files));
    scene.files = files;
    return { schemaVersion: 1, workspaceId: identity.current.id, revision: identity.current.revision, name: identity.current.name, sceneJSON: JSON.stringify(scene), viewport: { scrollX: state.scrollX, scrollY: state.scrollY, zoom: state.zoom.value }, updatedAt: Date.now() };
  }, []);
  useEffect(() => {
    let disposed = false; let close = () => {};
    void (async () => {
      try {
        const store = await openDraftStore();
        if (disposed) { store.close(); return; }
        close = () => store.close();
        autosave.current = createAutosave(store, { onStatus(s) { if (!disposed) setStatus(s.kind === 'saved' ? 'Draft tersimpan di browser' : s.kind === 'saving' ? 'Menyimpan draft…' : 'Draft belum tersimpan'); } });
        const draft = await store.read(); if (disposed) return;
        let scene = empty();
        if (draft) {
          scene = restore(JSON.parse(draft.sceneJSON), null, null);
          scene.appState = { ...scene.appState, scrollX: draft.viewport.scrollX, scrollY: draft.viewport.scrollY, zoom: { value: draft.viewport.zoom as AppState['zoom']['value'] } };
          identity.current = { id: draft.workspaceId, name: draft.name, revision: draft.revision }; setName(draft.name);
          setWorkspaceId(draft.workspaceId);
        }
        setInitialData(scene); setStatus(draft ? 'Draft tersimpan di browser' : 'Menyimpan draft…');
      } catch { if (!disposed) { setRestoreError(true); setStatus('Draft gagal dibaca'); } }
    })();
    return () => { disposed = true; const current = autosave.current; current?.dispose(); autosave.current = null; void current?.flush().finally(close); if (!current) close(); };
  }, []);
  const onChange: NonNullable<ExcalidrawProps['onChange']> = useCallback((elements, state, files) => {
    if (suppressed.current || !autosave.current) return;
    const snapshot = record(elements, state, files);
    const signature = JSON.stringify([snapshot.sceneJSON, snapshot.viewport, identity.current.name]);
    if (signature === last.current) return;
    last.current = signature; identity.current.revision++; snapshot.revision = identity.current.revision;
    autosave.current.schedule(snapshot);
  }, [record]);
  function rename(value: string) {
    identity.current.name = value; setName(value);
    if (api.current) onChange(api.current.getSceneElementsIncludingDeleted(), api.current.getAppState(), api.current.getFiles());
  }
  function replace(scene: Scene, newName = 'Tanpa judul') {
    const editor = api.current; suppressed.current = true;
    identity.current = { id: crypto.randomUUID(), name: newName, revision: 1 }; setName(newName); last.current = '';
    setWorkspaceId(identity.current.id);
    if (editor) {
      editor.resetScene({ resetLoadingState: true }); editor.addFiles(Object.values(scene.files));
      editor.updateScene({ elements: scene.elements, appState: { ...scene.appState, selectedElementIds: {} }, captureUpdate: CaptureUpdateAction.NEVER }); editor.history.clear();
      const snapshot = record(scene.elements, { ...editor.getAppState(), ...scene.appState } as AppState, scene.files);
      if (autosave.current) void autosave.current.replace(snapshot); else setStatus('Draft belum tersimpan');
      queueMicrotask(() => { suppressed.current = false; });
    } else { setInitialData(scene); setStatus('Draft belum tersimpan'); suppressed.current = false; }
    setRestoreError(false);
  }
  return { initialData, workspaceId, name, rename, status, restoreError, onChange, api, identity, replace, empty, get dirty() { return status !== 'Draft tersimpan di browser'; } };
}
