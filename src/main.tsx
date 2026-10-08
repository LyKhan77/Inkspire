import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { LanguageProvider } from './features/editor/language';
import './app.css';
declare global { interface Window { EXCALIDRAW_ASSET_PATH: string } }
createRoot(document.getElementById('root')!).render(<StrictMode><LanguageProvider><App /></LanguageProvider></StrictMode>);
