import { useEffect, useRef, useState } from 'react';
import type { GenerateFailure, GenerateRequest } from './contract';
import { GENERATION_LIMITS as L } from './contract';
import { requestImage } from './request';
import { prepareReference } from './references';
import type { Reference } from './references';
export type GenerationState =
  | { kind: 'idle' } | { kind: 'preparing' } | { kind: 'pending'; startedAt: number }
  | { kind: 'success'; dataURL: string; width: number; height: number; workspaceId: string; saved: boolean }
  | { kind: 'error'; failure: GenerateFailure };
export function useGeneration() {
  const [state, setState] = useState<GenerationState>({ kind: 'idle' });
  const [prompt, setPrompt] = useState(''); const [negative, setNegative] = useState('');
  const [steps, setSteps] = useState(40); const [cfg, setCfg] = useState(1);
  const [references, setReferences] = useState<Reference[]>([]); const referencesRef = useRef(references); referencesRef.current = references;
  const [referenceError, setReferenceError] = useState(''); const [preparingRefs, setPreparingRefs] = useState(false);
  const [elapsed, setElapsed] = useState(0); const busy = useRef(false); const referenceBusy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (state.kind !== 'pending') return; const update = () => setElapsed(Math.floor((Date.now() - state.startedAt) / 1000)); update(); const timer = setInterval(update, 1000); return () => clearInterval(timer); }, [state]);
  async function addReferences(blobs: { blob: Blob; name: string }[]) {
    if (referenceBusy.current || busy.current) return;
    if (referencesRef.current.length + blobs.length > L.references) { setReferenceError('Maksimal 10 referensi.'); return; }
    referenceBusy.current = true; setPreparingRefs(true); setReferenceError('');
    try {
      const additions: Reference[] = [];
      for (const item of blobs) additions.push({ ...await prepareReference(item.blob), id: crypto.randomUUID(), name: item.name });
      setReferences(current => [...current, ...additions]);
    } catch (error) { setReferenceError(error instanceof Error ? error.message : 'Referensi gagal disiapkan.'); }
    finally { referenceBusy.current = false; setPreparingRefs(false); }
  }
  async function generate(workspaceId: string) {
    if (busy.current || referenceBusy.current) return;
    busy.current = true; setState({ kind: 'preparing' });
    const payload: GenerateRequest = { prompt, negative_prompt: negative, num_inference_steps: steps, true_cfg_scale: cfg, resolution: 1024, ...(references.length ? { images: references.map(ref => ref.base64) } : {}) };
    try {
      if (!prompt.trim() || Array.from(prompt).length > L.promptCharacters) throw { error: { code: 'INVALID_INPUT', message: 'Prompt wajib diisi, maksimal 2000 karakter.', field: 'prompt', outcomeUnknown: false } } satisfies GenerateFailure;
      if (!Number.isInteger(steps) || steps < 20 || steps > 75 || !Number.isFinite(cfg) || cfg < 1 || cfg > 3) throw { error: { code: 'INVALID_INPUT', message: 'Steps harus 20–75 dan CFG harus 1–3.', outcomeUnknown: false } } satisfies GenerateFailure;
      setElapsed(0); setState({ kind: 'pending', startedAt: Date.now() });
      const response = await requestImage(payload); const dataURL = 'data:image/png;base64,' + response.data[0].b64_json;
      const bitmap = await createImageBitmap(await (await fetch(dataURL)).blob()); const width = bitmap.width; const height = bitmap.height; bitmap.close();
      if (mounted.current) setState({ kind: 'success', dataURL, width, height, workspaceId, saved: false });
    } catch (error) {
      const failure = (error as GenerateFailure)?.error ? error as GenerateFailure : { error: { code: 'INVALID_RESULT', message: 'Hasil tidak dapat dibuka. Generation mungkin sudah selesai.', outcomeUnknown: true } };
      if (mounted.current) setState({ kind: 'error', failure });
    } finally { busy.current = false; }
  }
  function markSaved(dataURL: string) { setState(current => current.kind === 'success' && current.dataURL === dataURL ? { ...current, saved: true } : current); }
  return { state, prompt, setPrompt, negative, setNegative, steps, setSteps, cfg, setCfg, references, removeReference(id: string) { setReferences(current => current.filter(ref => ref.id !== id)); }, addReferences, referenceError, setReferenceError, preparingRefs, generate, elapsed, markSaved, busy: state.kind === 'preparing' || state.kind === 'pending' };
}
