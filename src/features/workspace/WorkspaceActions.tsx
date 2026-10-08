import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconChevronDown, IconDeviceFloppy, IconFolderOpen, IconPlus, IconDownload } from '@tabler/icons-react';
import type { useWorkspace } from './useWorkspace';
import { downloadWorkspace, exportWorkspace, readWorkspace, serializeWorkspace } from './files';
import { useLanguage } from '../editor/language';
export function ConfirmDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} onCancel={event => { event.preventDefault(); onClose(); }} aria-label={title}><h2>{title}</h2>{children}</dialog>;
}
type Workspace = ReturnType<typeof useWorkspace>;
export function WorkspaceActions({ workspace, report, recovery }: { workspace: Workspace; report(message: string): void; recovery?: boolean }) {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [menu, setMenu] = useState(false); const [exportMenu, setExportMenu] = useState(false);
  const [selectionOnly, setSelectionOnly] = useState(false);
  const [replacement, setReplacement] = useState<{ scene: ReturnType<Workspace['empty']>; name: string } | null>(null);
  const current = useRef({ workspace, report, t }); current.current = { workspace, report, t };
  function save() {
    const api = current.current.workspace.api.current; if (!api) return;
    try { downloadWorkspace(serializeWorkspace(api.getSceneElementsIncludingDeleted(), api.getAppState(), api.getFiles()), current.current.workspace.identity.current.name); }
    catch { report('File workspace gagal disiapkan.'); }
  }
  async function open(file: File) {
    try { const scene = await readWorkspace(file); setReplacement({ scene, name: file.name.replace(/\.(excalidraw|json)$/i, '') }); }
    catch (error) { report(error instanceof Error ? error.message : 'File workspace tidak valid.'); }
  }
  function askNew() { setMenu(false); setReplacement({ scene: workspace.empty(), name: t('Tanpa judul') }); }
  useEffect(() => {
    // Flowchart is modal: workspace actions must not fire from inside it, but every other key behaves as before.
    const flowchartModal = () => !!document.querySelector('dialog[data-flowchart-modal][open]');
    const shortcut = (event: KeyboardEvent) => {
      if (flowchartModal()) {
        if ((event.ctrlKey || event.metaKey) && ['s', 'o', '/', 'p', 'Backspace', 'Delete'].includes(event.key.length === 1 ? event.key.toLowerCase() : event.key)) { event.preventDefault(); event.stopImmediatePropagation(); }
        return;
      }
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === 's') { event.preventDefault(); event.stopImmediatePropagation(); save(); }
      if (event.key.toLowerCase() === 'o') { event.preventDefault(); event.stopImmediatePropagation(); input.current?.click(); }
      if ((event.key === 'Backspace' || event.key === 'Delete') && !(event.target instanceof HTMLElement && (event.target.matches('input,textarea') || event.target.isContentEditable))) { event.preventDefault(); event.stopImmediatePropagation(); setReplacement({ scene: current.current.workspace.empty(), name: current.current.t('Tanpa judul') }); }
      if (event.key === '/' || (event.key.toLowerCase() === 'p' && event.shiftKey)) { event.preventDefault(); event.stopImmediatePropagation(); setMenu(true); }
    };
    const drop = (event: DragEvent) => {
      if (flowchartModal()) { event.preventDefault(); event.stopImmediatePropagation(); return; }
      const file = Array.from(event.dataTransfer?.files ?? []).find(f => /\.(excalidraw|json)$/i.test(f.name));
      if (file) { event.preventDefault(); event.stopImmediatePropagation(); void open(file); }
    };
    document.addEventListener('keydown', shortcut, true); document.addEventListener('drop', drop, true);
    return () => { document.removeEventListener('keydown', shortcut, true); document.removeEventListener('drop', drop, true); };
  }, []);
  async function exportFile(format: 'png' | 'svg') {
    setExportMenu(false); const api = workspace.api.current; if (!api) return;
    try { await exportWorkspace(api, workspace.name, format, selectionOnly); }
    catch (error) { report(error instanceof Error ? error.message : 'Export gagal.'); }
  }
  const hasSelection = workspace.api.current && Object.values(workspace.api.current.getAppState().selectedElementIds).some(Boolean);
  return <>
    <input hidden ref={input} data-testid="workspace-input" type="file" accept=".excalidraw,.json" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void open(file); }} />
    {recovery ? <><button onClick={askNew}>{t('Canvas baru')}</button><button onClick={() => input.current?.click()}>{t('Buka file')}</button></> : <>
      <div className="action-menu"><button className="flat" onClick={() => { setMenu(!menu); setExportMenu(false); }} aria-expanded={menu}>Workspace <IconChevronDown size={17} /></button>
        {menu && <div className="menu"><button onClick={askNew}><IconPlus size={18} />{t('Canvas baru')}</button><button onClick={() => { setMenu(false); input.current?.click(); }}><IconFolderOpen size={18} />{t('Buka / import file')}</button><button onClick={() => { setMenu(false); save(); }}><IconDeviceFloppy size={18} />{t('Simpan file workspace')}</button><button onClick={() => { setMenu(false); setExportMenu(true); }}><IconDownload size={18} />Export PNG / SVG</button></div>}
      </div>
      <button className="solid save-button" onClick={save} aria-label={t('Simpan file')}><IconDeviceFloppy size={18} /><span>{t('Simpan file')}</span></button>
      <div className="action-menu"><button className="flat export-button" onClick={() => { setExportMenu(!exportMenu); setMenu(false); }} aria-expanded={exportMenu}>Export <IconChevronDown size={17} /></button>
        {exportMenu && <div className="menu"><label className="selection-option"><input type="checkbox" checked={selectionOnly} disabled={!hasSelection} onChange={event => setSelectionOnly(event.target.checked)} />{t('Seleksi saja')}</label><button onClick={() => void exportFile('png')}>Export PNG</button><button onClick={() => void exportFile('svg')}>Export SVG</button></div>}
      </div>
    </>}
    {replacement && <ConfirmDialog title={t('Ganti workspace?')} onClose={() => setReplacement(null)}><p>{t('Canvas aktif akan diganti. Simpan file jika ingin membawa salinan pekerjaan ini.')}</p><div className="dialog-actions"><button onClick={() => { save(); setReplacement(null); }}>{t('Simpan file dahulu')}</button><button className="accent" onClick={() => { workspace.replace(replacement.scene, replacement.name); setReplacement(null); }}>{t('Ganti canvas')}</button><button onClick={() => setReplacement(null)}>{t('Batal')}</button></div></ConfirmDialog>}
  </>;
}
