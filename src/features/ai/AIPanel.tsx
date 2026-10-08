import { useEffect, useRef, useState } from 'react';
import { IconX, IconPhoto, IconPlus, IconArrowRight, IconDownload } from '@tabler/icons-react';
import type { useGeneration } from './useGeneration';
import { ConfirmDialog } from '../workspace/WorkspaceActions';
import { downloadBlob } from '../workspace/files';
import { useLanguage } from '../editor/language';
type Props = { generation: ReturnType<typeof useGeneration>; workspaceId: string; onClose(): void; snapshot(): Promise<Blob>; insert(): Promise<void>; inserting: boolean };
export function AIPanel({ generation: g, workspaceId, onClose, snapshot, insert, inserting }: Props) {
  const { t } = useLanguage();
  const fileInput = useRef<HTMLInputElement>(null); const promptInput = useRef<HTMLTextAreaElement>(null);
  const [confirm, setConfirm] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  useEffect(() => { promptInput.current?.focus(); }, []);
  useEffect(() => { if (g.state.kind === 'pending' || g.state.kind === 'success' || g.state.kind === 'error') preview.current?.scrollIntoView({ block: 'nearest' }); }, [g.state.kind]);
  function submit() {
    if ((g.state.kind === 'success' && !g.state.saved) || (g.state.kind === 'error' && g.state.failure.error.outcomeUnknown)) { setConfirm(true); return; }
    void g.generate(workspaceId);
  }
  const count = Array.from(g.prompt).length;
  return <aside className="ai-panel" aria-label="AI image" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); onClose(); } }}>
    <div className="panel-title"><div><span className="mono eyebrow">PROMPT → IMAGE</span><h2>AI image</h2></div><button aria-label={t('Tutup panel AI')} onClick={onClose}><IconX size={20} /></button></div>
    <p className="panel-intro">{t('Dari ide ke gambar.')}<br />{t('Mulai dengan kata atau sketsa.')}</p>
    <label className="field-label" htmlFor="prompt">Prompt</label><textarea id="prompt" ref={promptInput} rows={5} value={g.prompt} disabled={g.busy} onChange={event => g.setPrompt(event.target.value)} placeholder={t('Ilustrasi tinta hitam, komposisi sederhana, ruang kosong yang luas…')} aria-describedby="prompt-count" />
    <div className="input-meta mono" id="prompt-count"><span>PNG · 1024</span><span className={count > 2000 ? 'input-invalid' : ''}>{count} / 2000</span></div>
    <div className="section-label"><h3>{t('Referensi')}</h3><span className="mono">{g.references.length} / 10</span></div>
    <input hidden ref={fileInput} data-testid="references-input" type="file" accept="image/png,image/jpeg" multiple onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void g.addReferences(files.map(file => ({ blob: file, name: file.name }))); }} />
    <div className="reference-actions"><button disabled={g.busy || g.preparingRefs} onClick={() => fileInput.current?.click()}><IconPlus size={17} />{t('Upload gambar')}</button><button disabled={g.busy || g.preparingRefs} onClick={() => { void snapshot().then(blob => g.addReferences([{ blob, name: t('Seleksi canvas') }])).catch(error => g.setReferenceError(error instanceof Error ? error.message : 'Snapshot gagal.')); }}>{t('Dari seleksi canvas')}</button></div>
    <p className="helper">{t('PNG / JPEG. Salinan referensi disiapkan untuk MaPic.')}</p>
    {g.preparingRefs && <p role="status">{t('Menyiapkan referensi…')}</p>}
    {g.referenceError && <p role="alert" className="field-error">{t(g.referenceError)}</p>}
    {!!g.references.length && <div className="references">{g.references.map(ref => <div key={ref.id} className="reference"><img data-testid="reference-thumbnail" src={`data:${ref.mime};base64,${ref.base64}`} alt={ref.name} /><button disabled={g.busy} aria-label={`${t('Hapus referensi')} ${ref.name}`} onClick={() => g.removeReference(ref.id)}><IconX size={14} /></button></div>)}</div>}
    <details className="advanced"><summary>{t('Lanjutan')} <span className="mono">40 default steps</span></summary><label>Steps <input aria-label="Steps" type="number" min={20} max={75} disabled={g.busy} value={g.steps} onChange={event => g.setSteps(Number(event.target.value))} /></label><label>CFG <input aria-label="CFG" type="number" step="0.1" min={1} max={3} disabled={g.busy} value={g.cfg} onChange={event => g.setCfg(Number(event.target.value))} /></label><label>Negative prompt <textarea aria-label="Negative prompt" disabled={g.busy} value={g.negative} onChange={event => g.setNegative(event.target.value)} /></label><p className="helper">{t('CFG di atas 1 memerlukan negative prompt untuk guidance.')}</p></details>
    <button className="solid accent generate-button" disabled={g.busy || g.preparingRefs || inserting} onClick={submit}>Generate image <IconArrowRight size={19} /></button>
    <div ref={preview} className="preview-section"><h3>Preview</h3>
      {g.state.kind === 'idle' && <div className="empty-preview"><IconPhoto size={26} /><span>{t('Hasil gambar muncul di sini.')}</span><span className="helper">{t('Kamu yang menentukan masuk canvas.')}</span></div>}
      {g.state.kind === 'preparing' && <div className="state-box" role="status">{t('Menyiapkan input…')}</div>}
      {g.state.kind === 'pending' && <div className="state-box" role="status"><strong>{t('Menunggu hasil MaPic…')}</strong><p>{t('Canvas tetap bisa dipakai. Menutup panel tidak membatalkan generation.')}</p><div className="elapsed mono"><span>{t('Waktu tunggu')}</span><span>{String(Math.floor(g.elapsed / 60)).padStart(2, '0')}:{String(g.elapsed % 60).padStart(2, '0')}</span></div></div>}
      {g.state.kind === 'error' && <div className="state-box" role="alert"><strong>{t(g.state.failure.error.outcomeUnknown ? 'Hasil belum diketahui' : 'Generation belum berhasil')}</strong><p>{t(g.state.failure.error.message)}</p>{g.state.failure.error.outcomeUnknown && <p>{t('Percobaan baru bisa menghasilkan job ganda. Tidak ada retry otomatis.')}</p>}</div>}
      {g.state.kind === 'success' && <><img className="generated-preview" alt={t('Hasil MaPic')} src={g.state.dataURL} /><button className="solid accent" disabled={inserting} onClick={() => void insert()}>{t('Tambahkan ke canvas')}</button><button className="download-result" onClick={() => { if (g.state.kind !== 'success') return; const url = g.state.dataURL; void fetch(url).then(res => res.blob()).then(blob => { downloadBlob(blob, 'Inkspire.png'); g.markSaved(url); }); }}><IconDownload size={17} />{t('Unduh PNG')}</button><p className="helper">{t('Preview belum menjadi bagian file workspace sampai ditambahkan.')}</p></>}
    </div>
    <p className="privacy-note">{t('Prompt dan referensi dikirim ke MaPic saat Generate ditekan. Draft canvas tetap di browser.')}</p>
    {confirm && <ConfirmDialog title={t(g.state.kind === 'success' ? 'Ganti preview?' : 'Coba generation baru?')} onClose={() => setConfirm(false)}><p>{t(g.state.kind === 'success' ? 'Tambahkan atau unduh PNG dahulu jika ingin menyimpan hasil ini. Preview ini akan diganti.' : 'Generation sebelumnya mungkin masih berjalan. Percobaan baru berisiko menghasilkan job ganda.')}</p><div className="dialog-actions"><button onClick={() => setConfirm(false)}>{t('Batal')}</button><button className="accent" onClick={() => { setConfirm(false); void g.generate(workspaceId); }}>{t('Lanjutkan generation')}</button></div></ConfirmDialog>}
  </aside>;
}
