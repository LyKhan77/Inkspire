import { Excalidraw, MainMenu } from '@excalidraw/excalidraw';
import type { ExcalidrawProps } from '@excalidraw/excalidraw/types';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useRef } from 'react';
import { useLanguage } from './language';
import '@excalidraw/excalidraw/index.css';
type EditorProps = Pick<ExcalidrawProps, 'initialData' | 'onChange' | 'excalidrawAPI' | 'theme' | 'name'>;
export function Editor(props: EditorProps) {
  const { language } = useLanguage();
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  return <div className="editor" data-testid="editor"><Excalidraw {...props} excalidrawAPI={value => { api.current = value; props.excalidrawAPI?.(value); }} onChange={(elements, state, files) => {
    // Native palette includes unguarded clear/export actions in 0.18.1.
    if (state.openDialog?.name === 'commandPalette') { api.current?.updateScene({ appState: { openDialog: null } }); return; }
    props.onChange?.(elements, state, files);
  }} langCode={language === 'id' ? 'id-ID' : 'en'} UIOptions={{ welcomeScreen: false, canvasActions: { loadScene: false, clearCanvas: false, saveToActiveFile: false, saveAsImage: false, export: false, toggleTheme: false } }}><MainMenu><MainMenu.DefaultItems.ChangeCanvasBackground /></MainMenu></Excalidraw></div>;
}
