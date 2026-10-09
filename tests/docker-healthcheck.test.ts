import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { TEST_TOKEN } from './mock-mapic';

const run = promisify(execFile);
const probe = resolve('server/docker-healthcheck.ts');
const origin = 'https://192.168.50.20:8443';

async function fixture(status: number | null, action: (port: number, hosts: string[]) => Promise<void>) {
  const hosts: string[] = [];
  const server = createServer((req, res) => {
    hosts.push(req.headers.host ?? '');
    if (status === null) return;
    res.writeHead(req.method === 'HEAD' && req.headers.host === new URL(origin).host ? status : 403);
    res.end();
  });
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject); server.listen(0, '127.0.0.1', resolveListen);
  });
  try { await action((server.address() as AddressInfo).port, hosts); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
  }
}

function environment(port: number, publicOrigin = origin): NodeJS.ProcessEnv {
  return { NODE_ENV: 'production', INKSPIRE_PORT: String(port), INKSPIRE_PUBLIC_ORIGIN: publicOrigin,
    MAPIC_BASE_URL: 'http://127.0.0.1:1', MAPIC_SERVICE_TOKEN: TEST_TOKEN };
}

describe('Docker companion healthcheck', () => {
  it('uses canonical Host on HTTP loopback without a MaPic request', async () => {
    await fixture(200, async (port, hosts) => {
      const result = await run(process.execPath, ['--import', 'tsx', probe, 'companion'], { env: environment(port), timeout: 8000 });
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
      expect(hosts).toEqual([new URL(origin).host]);
    });
  });

  it('fails closed on a different canonical Host and sanitizes output', async () => {
    await fixture(200, async port => {
      try {
        await run(process.execPath, ['--import', 'tsx', probe, 'companion'], {
          env: environment(port, 'https://192.168.50.21:8443'), timeout: 8000 });
        throw new Error('probe unexpectedly passed');
      } catch (error) {
        const failure = error as { code: number; stdout: string; stderr: string };
        expect(failure.code).toBe(1);
        expect(failure.stdout).toBe('');
        expect(failure.stderr).toBe('Inkspire healthcheck failed.\n');
        expect(failure.stderr).not.toContain(TEST_TOKEN);
      }
    });
  });

  it('fails on non-200 readiness and never tries generation', async () => {
    await fixture(503, async (port, hosts) => {
      await expect(run(process.execPath, ['--import', 'tsx', probe, 'companion'], {
        env: environment(port), timeout: 8000 })).rejects.toMatchObject({ code: 1 });
      expect(hosts).toEqual([new URL(origin).host]);
    });
  });

  it('rejects an unsupported mode before making a request', async () => {
    await fixture(200, async (port, hosts) => {
      await expect(run(process.execPath, ['--import', 'tsx', probe, 'proxy'], {
        env: environment(port), timeout: 8000 })).rejects.toMatchObject({ code: 1 });
      expect(hosts).toEqual([]);
    });
  });

  it('rejects invalid configuration without printing operator values', async () => {
    await expect(run(process.execPath, ['--import', 'tsx', probe, 'companion'], {
      env: environment(0), timeout: 8000 })).rejects.toMatchObject({
        code: 1, stderr: 'Inkspire healthcheck failed.\n' });
  });

  it('bounds a stalled HTTP request', async () => {
    await fixture(null, async (port, hosts) => {
      const started = Date.now();
      await expect(run(process.execPath, ['--import', 'tsx', probe, 'companion'], {
        env: environment(port), timeout: 8000 })).rejects.toMatchObject({
          code: 1, stderr: 'Inkspire healthcheck failed.\n' });
      expect(Date.now() - started).toBeLessThan(7000);
      expect(hosts).toEqual([new URL(origin).host]);
    });
  }, 10000);
});
