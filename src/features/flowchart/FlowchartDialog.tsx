import { useEffect, useRef, useState } from 'react';
import { IconX } from '@tabler/icons-react';
import { useLanguage } from '../editor/language';
import type { FlowchartController } from './useFlowchart';
import { flowError, flowWarning } from './messages';

type Props = { flowchart: FlowchartController; onClose(): void };

const MODES = ['text', 'mermaid'] as const;

export function FlowchartDialog({ flowchart: f, onClose }: Props) {
  const { t, language } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const code = useRef<HTMLTextAreaElement>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const mode = f.inputs.mode;
  useEffect(() => { const node = dialog.current!; node.showModal(); input.current?.focus(); return () => node.close(); }, []);
  useEffect(() => { setCopyStatus(''); }, [f.preview?.sourceMermaid]);
  async function copy() {
    const source = f.preview?.sourceMermaid;
    if (!source) return;
    try { await navigator.clipboard.writeText(source); setCopyStatus('Kode disalin.'); }
    catch { code.current?.focus(); code.current?.select(); setCopyStatus('Pilih kode dan salin manual.'); }
  }
  function switchTab(next: number) {
    f.edit({ mode: MODES[next]! });
    document.getElementById(next === 0 ? 'flowchart-text-tab' : 'flowchart-mermaid-tab')?.focus();
  }
  return <dialog ref={dialog} className="flowchart-dialog" data-flowchart-modal aria-label="Flowchart"
    onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => event.stopPropagation()}>
    <div className="flowchart-heading"><h2>Flowchart</h2><button className="flat" aria-label={t('Tutup Flowchart')} onClick={onClose}><IconX size={18} /></button></div>
    <p className="helper">{t('Format terstruktur, tanpa AI. Preview masuk file setelah ditambahkan ke canvas.')}</p>
    <div className="flowchart-grid">
      <section aria-label={t('Input flowchart')}>
        <div role="tablist" aria-label="Flowchart" onKeyDown={event => {
          const index = mode === 'text' ? 0 : 1;
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : event.key === 'ArrowRight' || event.key === 'ArrowLeft' ? (index + 1) % 2 : null;
          if (next === null) return;
          event.preventDefault();
          switchTab(next);
        }}>
          <button type="button" id="flowchart-text-tab" role="tab" aria-selected={mode === 'text'} aria-controls="flowchart-input-panel" onClick={() => f.edit({ mode: 'text' })}>{t('Teks langkah')}</button>
          <button type="button" id="flowchart-mermaid-tab" role="tab" aria-selected={mode === 'mermaid'} aria-controls="flowchart-input-panel" onClick={() => f.edit({ mode: 'mermaid' })}>Mermaid</button>
        </div>
        <div id="flowchart-input-panel" role="tabpanel" aria-labelledby={mode === 'text' ? 'flowchart-text-tab' : 'flowchart-mermaid-tab'}>
          <label>{mode === 'text' ? t('Teks langkah') : 'Mermaid'}<textarea ref={input} rows={12} value={mode === 'text' ? f.inputs.text : f.inputs.mermaid} onChange={event => f.edit(mode === 'text' ? { text: event.target.value } : { mermaid: event.target.value })} spellCheck={false} /></label>
          {mode === 'text' && <><p className="helper">{t('Gunakan langkah per baris. Cabang Jika/If memakai dua spasi dan Ya/Yes atau Tidak/No.')}</p>
            <label>{t('Arah flowchart')}<select value={f.inputs.direction} onChange={event => f.edit({ direction: event.target.value === 'LR' ? 'LR' : 'TD' })}><option value="TD">{t('Atas ke bawah')}</option><option value="LR">{t('Kiri ke kanan')}</option></select></label>
            <button onClick={f.example}>{t('Muat contoh')}</button></>}
        </div>
        <div className="dialog-actions"><button className="solid accent" disabled={f.busy} onClick={() => void f.generate()}>{t(f.busy ? 'Menyiapkan flowchart…' : 'Buat preview')}</button></div>
        {f.busy && <p role="status">{t('Menyiapkan flowchart…')}</p>}
        {f.error && <p className="field-error" role="alert">{flowError(language, f.error.code)} {f.error.line !== undefined && <span>{t('Baris')} {f.error.line}</span>}</p>}
      </section>
      <section aria-label={t('Preview flowchart')}>
        {f.preview ? <>
          <img className="flowchart-preview" alt={t('Preview flowchart')} src={f.preview.url} />
          {!!f.preview.graph.warnings.length && <ul className="helper" role="status">{f.preview.graph.warnings.map((warning, index) => <li key={`${warning.code}-${warning.line}-${index}`}>{flowWarning(language, warning.code)} {t('Baris')} {warning.line}{warning.label ? `: ${warning.label}` : ''}</li>)}</ul>}
          <label>{t('Kode Mermaid')}<textarea ref={code} readOnly rows={6} value={f.preview.sourceMermaid} spellCheck={false} /></label>
          <div className="dialog-actions"><button onClick={() => void copy()}>{t('Salin Mermaid')}</button>{mode === 'text' && <button onClick={f.useMermaid}>{t('Gunakan kode Mermaid')}</button>}</div>
          <p className="helper" role="status">{t(copyStatus)}</p>
        </> : <p className="helper">{t('Preview muncul setelah input divalidasi.')}</p>}
      </section>
    </div>
    <div className="dialog-actions"><button onClick={onClose}>{t('Batal')}</button><button className="solid accent" disabled={!f.preview || f.busy} onClick={() => { if (f.insert()) onClose(); }}>{t('Tambahkan ke canvas')}</button></div>
  </dialog>;
}
