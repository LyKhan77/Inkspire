import { useEffect, useRef, useState } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { FlowchartError } from './model';
import type { Direction, Mode } from './model';
import { EXAMPLE, parseText } from './text';
import { parseMermaid } from './mermaid';
import { convertGraph } from './convert';
import type { Converted } from './convert';
import { insertFlowchart } from './insert';

type Inputs = { mode: Mode; text: string; mermaid: string; direction: Direction };
type Preview = Converted & { url: string; version: number; workspaceId: string; api: ExcalidrawImperativeAPI };
export type FlowchartOptions = { workspaceId: string; getWorkspaceId(): string; getAPI(): ExcalidrawImperativeAPI | null };

/** App owns this controller; the dialog is only a view. Input stays in page memory across closing. */
export function useFlowchart(options: FlowchartOptions) {
  const current = useRef(options); current.current = options;
  const [inputs, setInputs] = useState<Inputs>({ mode: 'text', text: '', mermaid: '', direction: 'TD' });
  const values = useRef(inputs); values.current = inputs;
  const [open, setOpen] = useState(false); const opened = useRef(false);
  const [busy, setBusy] = useState(false); const working = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null); const result = useRef<Preview | null>(null);
  const [error, setError] = useState<FlowchartError | null>(null);
  const version = useRef(0); const mounted = useRef(true); const inserting = useRef(false);
  const target = useRef(options.workspaceId);

  function discard() {
    version.current++;
    if (result.current) URL.revokeObjectURL(result.current.url);
    result.current = null;
    setPreview(null);
    setError(null);
  }

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; version.current++; if (result.current) URL.revokeObjectURL(result.current.url); result.current = null; };
  }, []);

  useEffect(() => {
    if (target.current === options.workspaceId) return;
    target.current = options.workspaceId;
    discard();
    if (opened.current) setError(new FlowchartError('STALE'));
  }, [options.workspaceId]);

  function edit(patch: Partial<Inputs>) { discard(); values.current = { ...values.current, ...patch }; setInputs(values.current); }
  function show(mode: Mode) { discard(); values.current = { ...values.current, mode }; setInputs(values.current); opened.current = true; setOpen(true); }
  function close() { discard(); opened.current = false; setOpen(false); }

  async function generate() {
    if (working.current || !opened.current) return;
    discard();
    const token = version.current;
    const workspaceId = current.current.getWorkspaceId();
    const api = current.current.getAPI();
    working.current = true; setBusy(true);
    const live = () => mounted.current && opened.current && version.current === token && current.current.getWorkspaceId() === workspaceId && current.current.getAPI() === api;
    try {
      if (!api) throw new FlowchartError('STALE');
      const source = values.current;
      const graph = source.mode === 'text' ? parseText(source.text, source.direction) : parseMermaid(source.mermaid);
      const converted = await convertGraph(graph, source.mode);
      // Superseded work may finish, but no object URL is created for a result nobody can see.
      if (!live()) return;
      const next: Preview = { ...converted, url: URL.createObjectURL(converted.blob), version: token, workspaceId, api };
      result.current = next;
      setPreview(next);
    }
    catch (caught) { if (live()) setError(caught instanceof FlowchartError ? caught : new FlowchartError('CONVERSION_FAILED')); }
    finally { working.current = false; if (mounted.current) setBusy(false); }
  }

  function insert() {
    if (inserting.current || !result.current) return false;
    inserting.current = true;
    const pending = result.current;
    const live = () => opened.current && pending.version === version.current && current.current.getWorkspaceId() === pending.workspaceId && current.current.getAPI() === pending.api;
    try { insertFlowchart(pending.api, pending, live); close(); return true; }
    catch (caught) { discard(); setError(caught instanceof FlowchartError ? caught : new FlowchartError('CONVERSION_FAILED')); return false; }
    finally { inserting.current = false; }
  }

  function example() { edit({ mode: 'text', text: EXAMPLE }); }
  function useMermaid() { const source = result.current?.sourceMermaid; if (source) edit({ mode: 'mermaid', mermaid: source }); }

  return { inputs, open, busy, preview, error, edit, show, close, generate, insert, example, useMermaid };
}

export type FlowchartController = ReturnType<typeof useFlowchart>;
