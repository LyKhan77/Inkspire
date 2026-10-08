import { afterEach, expect, test } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../server/config';
import { assertLANInterface, caddyEnvironment, prepareLAN, renderCaddyfile } from '../server/lan';

const roots: string[] = [];
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });
const config = readConfig({ INKSPIRE_PUBLIC_ORIGIN: 'https://192.168.1.20:8443', INKSPIRE_PORT: '4193' });

test('explicit interface and no implicit localhost or wildcard fallback', () => {
  expect(() => assertLANInterface(config, ['192.168.1.20'])).not.toThrow();
  expect(() => assertLANInterface(config, ['192.168.1.21'])).toThrow('IP LAN tidak terpasang pada host.');
  expect(() => renderCaddyfile(readConfig({}), '/tmp/inkspire')).toThrow();
  const text = renderCaddyfile(config, '/tmp/inkspire');
  expect(text).toContain('bind 192.168.1.20');
  expect(text).toContain('reverse_proxy 127.0.0.1:4193');
  for (const line of ['admin off', 'persist_config off', 'skip_install_trust', 'auto_https disable_redirects', 'tls internal', 'protocols h1 h2']) expect(text).toContain(line);
  expect(text).not.toMatch(/0\.0\.0\.0|header_up|MAPIC|file_server/u);
});

test('generated storage path stays absolute and outside dist', () => {
  const text = renderCaddyfile(config, '/tmp/inkspire root');
  expect(text).toContain('"');
  expect(text).toMatch(/storage file_system "\/tmp\/inkspire root\/\.inkspire-lan\/data"/u);
  expect(text).not.toMatch(/\bdist\b/u);
});

test('child environment excludes operator credentials', () => {
  const env = caddyEnvironment({ PATH: '/bin', MAPIC_SERVICE_TOKEN: 'SECRET',
    MAPIC_BASE_URL: 'http://private', INKSPIRE_PUBLIC_ORIGIN: config.origin, OTHER_SECRET: 'SECRET' }, '/tmp/inkspire');
  expect(env.PATH).toBe('/bin');
  expect(JSON.stringify(env)).not.toContain('SECRET');
  expect(env.MAPIC_BASE_URL).toBeUndefined();
  expect(env.XDG_DATA_HOME).toContain('.inkspire-lan');
});

test('prepare writes only project-local private files after interface validation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'inkspire-lan-config-')); roots.push(root);
  await expect(prepareLAN(config, root, [])).rejects.toThrow('IP LAN tidak terpasang');
  const path = await prepareLAN(config, root, ['192.168.1.20']);
  expect(await readFile(path, 'utf8')).toContain(config.origin);
  if (process.platform !== 'win32') {
    expect((await stat(join(root, '.inkspire-lan'))).mode & 0o777).toBe(0o700);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  }
});