import { cp, mkdir, rm, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const source = fileURLToPath(new URL('node_modules/@excalidraw/excalidraw/dist/prod/fonts/', root));
const destination = fileURLToPath(new URL('public/excalidraw/fonts/', root));
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });
// Keep the native worker graph separate: bundling it with UI helpers makes
// the worker import the browser entry, where document is unavailable.
const workerRoot = fileURLToPath(new URL('public/excalidraw/worker/', root));
const editorRoot = fileURLToPath(new URL('node_modules/@excalidraw/excalidraw/dist/prod/', root));
await rm(workerRoot, { recursive: true, force: true });
await mkdir(workerRoot, { recursive: true });
const copied = new Set();
async function copyWorker(name) {
  if (copied.has(name)) return;
  if (!/^[\w.-]+\.js$/.test(name)) throw new Error('Unexpected native worker dependency');
  copied.add(name);
  const text = await readFile(join(editorRoot, name), 'utf8');
  await cp(join(editorRoot, name), join(workerRoot, name));
  for (const match of text.matchAll(/(?:from|import)\s*["']\.\/([^"']+)["']/g)) await copyWorker(match[1]);
}
await copyWorker('subset-worker.chunk.js');
const noticeRoot = fileURLToPath(new URL('public/notices/', root));
await rm(noticeRoot, { recursive: true, force: true });
await mkdir(noticeRoot, { recursive: true });
const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
const notices = [];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev) continue;
  const directory = fileURLToPath(new URL(path + '/', root));
  try {
    const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    const licenseFiles = (await readdir(directory)).filter(name => /^(licen[cs]e|notice|copyright)([.-].*)?$/i.test(name));
    const target = join(noticeRoot, pkg.name.replaceAll('/', '__') + '-' + pkg.version);
    await mkdir(target, { recursive: true });
    for (const name of licenseFiles) await cp(join(directory, name), join(target, name), { recursive: true });
    notices.push({ name: pkg.name, version: pkg.version, license: pkg.license ?? null, files: licenseFiles });
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
await writeFile(join(noticeRoot, 'packages.json'), JSON.stringify(notices, null, 2) + '\n');
