import { useEffect, useRef, useState } from 'react';
import { IconDroplet, IconX } from '@tabler/icons-react';
import { exportToBlob, viewportCoordsToSceneCoords } from '@excalidraw/excalidraw';
import { Editor } from './features/editor/Editor';
import { useTheme } from './features/editor/theme';
import { ThemeToggle } from './features/editor/ThemeToggle';
import { useWorkspace } from './features/workspace/useWorkspace';
import { ConfirmDialog, WorkspaceActions } from './features/workspace/WorkspaceActions';
import { insertPNG } from './features/editor/images';
import { useGeneration } from './features/ai/useGeneration';
import { AIPanel } from './features/ai/AIPanel';
import { useLanguage } from './features/editor/language';
import type { Language } from './features/editor/language';
import { useFlowchart } from './features/flowchart/useFlowchart';
import { FlowchartDialog } from './features/flowchart/FlowchartDialog';
export function App() {
  const { t, language, choose } = useLanguage();
  const workspace = useWorkspace(); const theme = useTheme();
  const flowchart = useFlowchart({ workspaceId: workspace.workspaceId, getWorkspaceId: () => workspace.identity.current.id, getAPI: () => workspace.api.current });
  const generation = useGeneration(); const aiToggle = useRef<HTMLButtonElement>(null);
  const [panelOpen, setPanelOpen] = useState(false); const [error, setError] = useState('');
  const [insertTarget, setInsertTarget] = useState<{ id: string; name: string } | null>(null);
  const [inserting, setInserting] = useState(false); const insertGuard = useRef(false);
  const unloadRisk = workspace.dirty || generation.busy || (generation.state.kind === 'success' && !generation.state.saved);
  useEffect(() => { const before = (event: BeforeUnloadEvent) => { if (unloadRisk) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', before); return () => window.removeEventListener('beforeunload', before); }, [unloadRisk]);
  async function snapshot() {
    const api = workspace.api.current; if (!api) throw new Error('Editor belum siap.');
    const state = api.getAppState(); const elements = api.getSceneElements().filter(e => state.selectedElementIds[e.id]);
    if (!elements.length) throw new Error('Pilih objek pada canvas dahulu.');
    return exportToBlob({ elements, appState: { ...state, exportBackground: false, exportWithDarkMode: false }, files: api.getFiles() });
  }
  function closePanel() { setPanelOpen(false); aiToggle.current?.focus(); }
  function closeFlowchart() {
    flowchart.close();
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.editor .App-toolbar__extra-tools-trigger')?.focus());
  }
  async function performInsert(targetId: string) {
    if (insertGuard.current || generation.state.kind !== 'success') return;
    const api = workspace.api.current; if (!api) return;
    insertGuard.current = true; setInserting(true);
    const preview = generation.state; const state = api.getAppState();
    const position = viewportCoordsToSceneCoords({ clientX: state.offsetLeft + state.width / 2, clientY: state.offsetTop + state.height / 2 }, state);
    try { await insertPNG(api, preview.dataURL, preview, position, () => workspace.identity.current.id === targetId && workspace.api.current === api); generation.markSaved(preview.dataURL); }
    catch (error) { setError(error instanceof Error ? error.message : 'Gambar gagal ditambahkan.'); }
    finally { insertGuard.current = false; setInserting(false); }
  }
  async function insert() {
    if (generation.state.kind !== 'success') return;
    if (generation.state.workspaceId !== workspace.identity.current.id) { setInsertTarget({ id: workspace.identity.current.id, name: workspace.identity.current.name }); return; }
    await performInsert(workspace.identity.current.id);
  }
  return <main className="inkspire" data-theme={theme.theme}>
    <header className="app-header"><div className="brand"><ThemeToggle theme={theme} />inkspire</div>
      <div className="workspace-name"><input aria-label={t('Nama workspace')} value={workspace.name} onChange={event => workspace.rename(event.target.value)} /><span className="save-status" role="status">{t(workspace.status)}</span></div>
      <nav className="header-actions" aria-label="Workspace">{workspace.initialData && <WorkspaceActions workspace={workspace} report={setError} />}<button ref={aiToggle} className="solid accent ai-toggle" aria-expanded={panelOpen} onClick={() => setPanelOpen(!panelOpen)}><IconDroplet size={18} /><span>AI image</span></button></nav>
    </header>
    {error && <div className="error-banner" role="alert">{t(error)}<button aria-label={t('Tutup pesan')} onClick={() => setError('')}><IconX size={18} /></button></div>}
    <div className="work-area">
      {workspace.restoreError ? <div className="recovery"><h1>{t('Draft gagal dipulihkan')}</h1><p>{t('Draft lama tetap disimpan. Buka file atau mulai canvas baru setelah konfirmasi.')}</p><WorkspaceActions workspace={workspace} report={setError} recovery /></div> : workspace.initialData ? <Editor initialData={workspace.initialData} onChange={workspace.onChange} excalidrawAPI={api => { workspace.api.current = api; }} theme={theme.theme} name={workspace.name} onOpenFlowchart={flowchart.show} /> : <p className="restore-status">{t('Memulihkan draft…')}</p>}
      {panelOpen && <AIPanel generation={generation} workspaceId={workspace.identity.current.id} onClose={closePanel} snapshot={snapshot} insert={insert} inserting={inserting} />}
    </div>
    <footer className="app-footer"><span>{t('Canvas lokal · File milikmu')}</span><div className="footer-settings"><label>{t('Bahasa')} <select aria-label={t('Bahasa')} value={language} onChange={event => choose(event.target.value as Language)}><option value="id">Indonesia</option><option value="en">English</option></select></label><label className="system-theme"><input type="checkbox" checked={theme.choice === 'system'} onChange={event => theme.choose(event.target.checked ? 'system' : theme.theme)} />{t('Ikuti sistem')}</label></div></footer>
    {flowchart.open && <FlowchartDialog flowchart={flowchart} onClose={closeFlowchart} />}
    {insertTarget && <ConfirmDialog title={t('Tambahkan ke workspace aktif?')} onClose={() => setInsertTarget(null)}><p>{t('Hasil berasal dari workspace lain. Tambahkan ke')} <strong>{insertTarget.name}</strong>?</p><div className="dialog-actions"><button onClick={() => setInsertTarget(null)}>{t('Batal')}</button><button className="accent" onClick={() => { const target = insertTarget.id; setInsertTarget(null); void performInsert(target); }}>{t('Tambahkan ke workspace ini')}</button></div></ConfirmDialog>}
  </main>;
}
