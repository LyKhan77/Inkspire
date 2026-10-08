import { createServer } from 'node:http';
import type { AppConfig } from './config.js';
import { createWeb, safeWebPath } from './web.js';
import { RequestError, requireLocalRequest, readJSONBody, validateGenerate } from './request.js';
import { validateReferenceImage } from './images.js';
import { generateWithMaPic } from './mapic.js';
import { GENERATION_LIMITS } from '../src/features/ai/contract.js';
import type { ServerResponse } from 'node:http';
function json(res: ServerResponse, status: number, value: unknown) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(value));
}
function failure(res: ServerResponse, error: unknown) {
  const e = error instanceof RequestError ? error : new RequestError(500, 'INTERNAL_ERROR', 'Permintaan lokal gagal.');
  json(res, e.status, { error: { code: e.code, message: e.message, outcomeUnknown: e.outcomeUnknown, ...(e.field ? { field: e.field } : {}) } });
}
export async function startApp(config: AppConfig) {
  let origin = config.origin;
  let active = false;
  let web: Awaited<ReturnType<typeof createWeb>>;
  const server = createServer((req, res) => {
    if (req.headers.host !== new URL(origin).host) { failure(res, new RequestError(403, 'LOCAL_ONLY', 'Akses lokal ditolak.')); return; }
    if (req.url === '/api/ai/generate') {
      void (async () => {
        let acquired = false;
        try {
          requireLocalRequest(req, origin);
          const payload = validateGenerate(await readJSONBody(req, GENERATION_LIMITS.bodyBytes));
          for (const [index, image] of (payload.images ?? []).entries()) await validateReferenceImage(image, index);
          if (!config.mapicBaseURL || !config.mapicServiceToken) throw new RequestError(503, 'SERVICE_UNCONFIGURED', 'Konfigurasi MaPic belum tersedia di backend. Canvas dan file tetap dapat dipakai.');
          if (active) throw new RequestError(409, 'REQUEST_ACTIVE', 'Satu request masih aktif. Tunggu hasilnya lalu coba secara manual.');
          if (res.destroyed) return;
          active = true; acquired = true;
          json(res, 200, await generateWithMaPic(payload, config));
        } catch (error) { failure(res, error); }
        finally { if (acquired) active = false; }
      })(); return;
    }
    if ((req.url ?? '').startsWith('/api/')) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":{"code":"NOT_FOUND","message":"Endpoint tidak ditemukan.","outcomeUnknown":false}}'); return; }
    if (safeWebPath(req.url ?? '/') === null || !['GET', 'HEAD'].includes(req.method ?? '')) { res.statusCode = 404; res.end(); return; }
    void web.handle(req, res);
  });
  server.requestTimeout = 120_000;
  server.headersTimeout = 60_000;
  server.setTimeout(config.generationTimeoutMs + 60_000);
  server.on('upgrade', (req, socket) => {
    if (req.headers.host !== new URL(origin).host || req.headers.origin !== origin) socket.destroy();
  });
  web = await createWeb(config, server);
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(config.port, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Companion address missing');
  origin = config.origin.startsWith('https://') ? config.origin : `http://127.0.0.1:${address.port}`;
  return { server, origin, async close() { await web.close(); await new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }); } };
}
