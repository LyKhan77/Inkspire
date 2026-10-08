import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import type { AppConfig } from './config.js';
const mime: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
export function safeWebPath(raw: string) {
  try {
    const path = decodeURIComponent(raw.split('?')[0]!);
    if (path.includes('\\') || path.includes('\0') || path.split('/').some((part, index, parts) => part.startsWith('.') && !(part === '.vite' && index === 2 && parts[1] === 'node_modules')) || /^\/(temp|server|tests|docs|scripts)(\/|$)/.test(path)) return null;
    return path;
  } catch { return null; }
}
export async function createWeb(config: AppConfig, server: Server) {
  if (config.mode === 'development') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: { server }, fs: { strict: true, deny: ['.env', '.env.*', '**/.git/**', '**/temp/**', '**/server/**', '**/.cooper/**', '**/.superpowers/**', '**/*.{pem,key}'] } },
      appType: 'spa',
    });
    return { handle(req: IncomingMessage, res: ServerResponse) { vite.middlewares(req, res, () => { res.statusCode = 404; res.end(); }); }, close: () => vite.close() };
  }
  const root = resolve('dist');
  return {
    async handle(req: IncomingMessage, res: ServerResponse) {
      const path = safeWebPath(req.url ?? '/');
      if (path === null) { res.statusCode = 404; res.end(); return; }
      let file = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      try {
        const real = await realpath(file);
        if (!real.startsWith(root + sep) || !(await stat(real)).isFile()) throw new Error();
        file = real;
        res.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        const content = await readFile(file);
        res.end(req.method === 'HEAD' ? undefined : content);
      } catch { res.statusCode = 404; res.end(); }
    },
    close: async () => {},
  };
}
