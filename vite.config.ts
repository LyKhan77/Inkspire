import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [{
    name: 'inkspire-native-font-worker', enforce: 'pre',
    resolveId(source, importer) {
      if (source === './subset-worker.chunk.js' && importer?.includes('/@excalidraw/excalidraw/')) return '\0inkspire-native-font-worker';
    },
    load(id) {
      if (id === '\0inkspire-native-font-worker') return 'export const WorkerUrl = new URL("/excalidraw/worker/subset-worker.chunk.js", globalThis.location.href);';
    },
  }, react()],
  build: { sourcemap: false },
});
