import { readConfig } from './config.js';
import { startApp } from './app.js';
try {
  const app = await startApp(readConfig(process.env, process.argv.includes('--dev')));
  console.log(`Inkspire: ${app.origin}`);
  const stop = async () => { await app.close(); process.exit(0); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
} catch { console.error('Inkspire gagal dimulai. Periksa konfigurasi dan port lokal.'); process.exitCode = 1; }
