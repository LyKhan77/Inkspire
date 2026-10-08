import { spawn } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { readConfig } from './config.js';
import { caddyEnvironment, prepareLAN } from './lan.js';

const SAFE_MESSAGES = new Set([
  'INKSPIRE_PORT tidak valid.',
  'INKSPIRE_PUBLIC_ORIGIN tidak valid.',
  'Konfigurasi URL MaPic tidak valid.',
  'Konfigurasi token MaPic tidak valid.',
  'Konfigurasi LAN production diperlukan.',
  'IP LAN tidak terpasang pada host.',
  'Argumen LAN tidak valid.',
]);

try {
  if (process.argv.slice(2).some(arg => arg !== '--write-only')) throw new Error('Argumen LAN tidak valid.');
  const config = readConfig(process.env);
  const addresses = Object.values(networkInterfaces()).flatMap(items => items ?? [])
    .filter(item => item.family === 'IPv4').map(item => item.address);
  const root = process.cwd();
  const file = await prepareLAN(config, root, addresses);
  console.log(`Inkspire LAN: ${config.origin}`);
  console.log(`Caddyfile: ${file}`);
  if (!process.argv.includes('--write-only')) {
    const child = spawn('caddy', ['run', '--config', file, '--adapter', 'caddyfile'], {
      cwd: root, env: caddyEnvironment(process.env, root), stdio: 'inherit', shell: false,
    });
    let stopping = false;
    const stop = () => { stopping = true; child.kill('SIGTERM'); };
    const removeSignals = () => {
      process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop);
    };
    process.once('SIGINT', stop); process.once('SIGTERM', stop);
    child.once('error', () => {
      removeSignals();
      console.error('Caddy tidak dapat dijalankan. Periksa executable pada PATH.');
      process.exitCode = 1;
    });
    child.once('exit', code => {
      removeSignals();
      process.exitCode = stopping ? 0 : (code ?? 1);
    });
  }
} catch (error) {
  const message = error instanceof Error && SAFE_MESSAGES.has(error.message)
    ? error.message : 'Konfigurasi LAN gagal. Periksa environment dan izin folder lokal.';
  console.error(message);
  process.exitCode = 1;
}