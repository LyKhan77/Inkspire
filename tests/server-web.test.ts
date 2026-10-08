import { afterEach, expect, test } from 'vitest';
import { startApp } from '../server/app';
import type { AppConfig } from '../server/config';
import { request } from 'node:http';
const handles: Awaited<ReturnType<typeof startApp>>[] = [];
afterEach(async () => { await Promise.all(handles.splice(0).map(app => app.close())); });
const config: AppConfig = { port: 0, origin: 'http://127.0.0.1:0', mode: 'production', mapicBaseURL: null, mapicServiceToken: null, generationTimeoutMs: 3_660_000 };
test('bind loopback, unknown API stays JSON without MaPic', async () => {
  const app = await startApp(config); handles.push(app);
  expect(app.server.address()).toMatchObject({ address: '127.0.0.1' });
  const response = await fetch(`${app.origin}/api/missing`);
  expect(response.status).toBe(404);
  expect(response.headers.get('content-type')).toContain('application/json');
  expect((await fetch(app.origin)).status).toBe(200);
  expect((await fetch(app.origin + '/fonts/space-grotesk.ttf')).headers.get('content-type')).toBe('font/ttf');
});
test('reject host and sensitive/traversal paths before static serving', async () => {
  const app = await startApp(config); handles.push(app);
  const status = await new Promise<number>(resolve => { request(app.origin, { headers: { Host: 'evil.example' } }, res => { res.resume(); resolve(res.statusCode!); }).end(); });
  expect(status).toBe(403);
  for (const path of ['/.env', '/temp/image-gen.txt', '/server/config.ts', '/%2e%2e%2f.env']) {
    expect((await fetch(app.origin + path)).status).toBe(404);
  }
});
