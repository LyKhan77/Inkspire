import { chmod, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { AppConfig } from './config.js';
import { readPublicOrigin } from './origin.js';

/** Root folder for generated Caddy configuration, PKI storage, and child XDG dirs. */
export const LAN_ROOT = '.inkspire-lan';

function lanOrigin(config: AppConfig): string {
  if (!config.origin.startsWith('https://')) throw new Error('Konfigurasi LAN production diperlukan.');
  const origin = readPublicOrigin(config.origin);
  if (!origin || config.mode !== 'production') throw new Error('Konfigurasi LAN production diperlukan.');
  return origin;
}

/** Fail unless the configured LAN IP is literally present on a host interface. No interface selection. */
export function assertLANInterface(config: AppConfig, addresses: readonly string[]): void {
  if (!addresses.includes(new URL(lanOrigin(config)).hostname)) {
    throw new Error('IP LAN tidak terpasang pada host.');
  }
}

export function renderCaddyfile(config: AppConfig, root: string): string {
  const origin = lanOrigin(config);
  const ip = new URL(origin).hostname;
  const storage = JSON.stringify(resolve(root, LAN_ROOT, 'data'));
  return `{
  admin off
  persist_config off
  skip_install_trust
  auto_https disable_redirects
  storage file_system ${storage}
  servers {
    protocols h1 h2
  }
}

${origin} {
  bind ${ip}
  tls internal
  reverse_proxy 127.0.0.1:${config.port}
}
`;
}

/** Whitelisted environment for the Caddy child: no MaPic token/URL and no operator environment. */
export function caddyEnvironment(env: NodeJS.ProcessEnv, root: string): NodeJS.ProcessEnv {
  const result: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'SystemRoot', 'SystemDrive', 'COMSPEC', 'PATHEXT', 'TMPDIR', 'TEMP', 'TMP']) {
    if (env[key] !== undefined) result[key] = env[key];
  }
  result.XDG_DATA_HOME = resolve(root, LAN_ROOT, 'xdg-data');
  result.XDG_CONFIG_HOME = resolve(root, LAN_ROOT, 'xdg-config');
  return result;
}

export async function prepareLAN(config: AppConfig, root: string, addresses: readonly string[]): Promise<string> {
  assertLANInterface(config, addresses);
  const dir = resolve(root, LAN_ROOT);
  const data = resolve(dir, 'data');
  await mkdir(data, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') { await chmod(dir, 0o700); await chmod(data, 0o700); }
  const file = resolve(dir, 'Caddyfile');
  await writeFile(file, renderCaddyfile(config, root), { mode: 0o600 });
  if (process.platform !== 'win32') await chmod(file, 0o600);
  return file;
}