import { CaptureUpdateAction, Excalidraw, MainMenu, TTDDialogTrigger } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, ExcalidrawProps } from '@excalidraw/excalidraw/types';
import { IconHierarchy } from '@tabler/icons-react';
import { useRef } from 'react';
import { useLanguage } from './language';
import type { Mode } from '../flowchart/model';
import '@excalidraw/excalidraw/index.css';

type EditorProps = Pick<ExcalidrawProps, 'initialData' | 'onChange' | 'excalidrawAPI' | 'theme' | 'name'> & { onOpenFlowchart(mode: Mode): void };

export function Editor({ onOpenFlowchart, ...props }: EditorProps) {
  const { language } = useLanguage();
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const routing = useRef(false);
  return <div className="editor" data-testid="editor"><Excalidraw {...props} excalidrawAPI={value => { api.current = value; props.excalidrawAPI?.(value); }} onChange={(elements, state, files) => {
    // Native palette includes unguarded clear/export actions in 0.18.1.
    if (state.openDialog?.name === 'commandPalette') { api.current?.updateScene({ appState: { openDialog: null } }); return; }
    // Both native text-to-diagram routes have no validator of their own, so they must not insert either.
    if (state.openDialog?.name === 'ttd') {
      if (routing.current) return;
      routing.current = true;
      const mode: Mode = state.openDialog.tab === 'mermaid' ? 'mermaid' : 'text';
      props.onChange?.(elements, { ...state, openDialog: null }, files);
      api.current?.updateScene({ appState: { openDialog: null }, captureUpdate: CaptureUpdateAction.NEVER });
      onOpenFlowchart(mode);
      queueMicrotask(() => { routing.current = false; });
      return;
    }
    props.onChange?.(elements, state, files);
  }} langCode={language === 'id' ? 'id-ID' : 'en'} UIOptions={{ welcomeScreen: false, canvasActions: { loadScene: false, clearCanvas: false, saveToActiveFile: false, saveAsImage: false, export: false, toggleTheme: false } }}><MainMenu><MainMenu.DefaultItems.ChangeCanvasBackground /></MainMenu><TTDDialogTrigger icon={<IconHierarchy size={18} />}><span data-inkspire-flowchart-trigger>Flowchart</span></TTDDialogTrigger></Excalidraw></div>;
}
