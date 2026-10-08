import { createServer } from 'node:http';
import type { IncomingHttpHeaders } from 'node:http';
import { makePNG } from './fixtures';
export const TEST_TOKEN = 'inkspire-test-only-SENTINEL-7f913';
export interface MockMode { kind: 'success' | 'delayed' | 'held' | 'status' | 'disconnect' | 'invalid-result' | 'invalid-json' | 'oversize-result'; delay?: number; status?: number }
export async function startMock(port = 0) {
  let mode: MockMode = { kind: 'success' };
  const held: (() => void)[] = [];
  const release = () => { for (const resolve of held.splice(0)) resolve(); };
  const calls: { path: string; headers: IncomingHttpHeaders; body: unknown }[] = [];
  const png = (await makePNG(96, 48)).toString('base64');
  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const raw = Buffer.concat(chunks).toString();
    if (req.url === '/__test/mode') {
      release();
      mode = JSON.parse(raw) as MockMode; calls.length = 0; res.end('{}'); return;
    }
    if (req.url === '/__test/release') { release(); res.end('{}'); return; }
    if (req.url === '/__test/calls') {
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(calls)); return;
    }
    calls.push({ path: req.url ?? '', headers: req.headers, body: JSON.parse(raw) });
    const current = { ...mode };
    if (current.kind === 'held') await new Promise<void>(resolve => held.push(resolve));
    if (current.delay) await new Promise(resolve => setTimeout(resolve, current.delay));
    if (current.kind === 'disconnect') { res.destroy(); return; }
    res.setHeader('Content-Type', 'application/json');
    if (current.kind === 'invalid-json') { res.end('{'); return; }
    if (current.kind === 'oversize-result') { res.end(' '.repeat(33 * 1024 * 1024)); return; }
    if (current.kind === 'status') { res.statusCode = current.status ?? 500; res.end(JSON.stringify({ detail: TEST_TOKEN })); return; }
    res.end(JSON.stringify({ data: [{ b64_json: current.kind === 'invalid-result' ? 'invalid' : png }] }));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Mock address missing');
  return { server, origin: `http://127.0.0.1:${address.port}`, calls, setMode(value: MockMode) { release(); mode = value; calls.length = 0; }, close: () => new Promise<void>(resolve => { release(); server.closeAllConnections(); server.close(() => resolve()); }) };
}
