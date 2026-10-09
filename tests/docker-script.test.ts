import { execFile } from 'node:child_process';
import { chmod, copyFile, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const run = promisify(execFile);
const source = resolve('scripts/docker.sh');
const sentinel = 'docker-script-test-only-SENTINEL';
interface Call { args: string[]; envFile?: string; origin?: string; image?: string }
interface Result { code: number; stdout: string; stderr: string }

async function fixture(action: (root: string, invoke: (args: string[], extra?: NodeJS.ProcessEnv) => Promise<Result>,
  calls: () => Promise<Call[]>) => Promise<void>) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'inkspire docker script-')));
  const bin = join(root, 'bin');
  const log = join(root, 'calls.jsonl');
  await mkdir(bin);
  await mkdir(join(root, 'scripts'));
  await mkdir(join(root, 'deploy'));
  try {
    await copyFile(source, join(root, 'scripts/docker.sh'));
    await copyFile(resolve('deploy/docker.env.example'), join(root, 'deploy/docker.env.example'));
    await writeFile(join(root, 'compose.yaml'), 'name: inkspire\n');
    await writeFile(join(bin, 'uname'), '#!/bin/bash\nprintf "%s\\n" "${INKSPIRE_TEST_OS:-Linux}"\n');
    const fakeDocker = [
      '#!/usr/bin/env node',
      "const fs = require('node:fs');",
      'const args = process.argv.slice(2);',
      "fs.appendFileSync(process.env.INKSPIRE_TEST_LOG, JSON.stringify({ args, envFile: process.env.INKSPIRE_ENV_FILE, origin: process.env.INKSPIRE_PUBLIC_ORIGIN, image: process.env.INKSPIRE_IMAGE }) + '\\n');",
      "if (args[0] === 'context') console.log(process.env.INKSPIRE_TEST_ENDPOINT || 'unix:///fixture.sock');",
      "else if (args[0] === 'info') console.log(process.env.INKSPIRE_TEST_INFO || 'linux|Fixture Engine|[]');",
      "else if (args.includes('config') && process.env.INKSPIRE_TEST_BAD_CONFIG === '1') { console.error('" + sentinel + "'); process.exit(1); }",
    ].join('\n') + '\n';
    await writeFile(join(bin, 'docker'), fakeDocker);
    await chmod(join(bin, 'uname'), 0o755);
    await chmod(join(bin, 'docker'), 0o755);
    const invoke = async (args: string[], extra: NodeJS.ProcessEnv = {}): Promise<Result> => {
      try {
        const result = await run('/bin/bash', [join(root, 'scripts/docker.sh'), ...args], {
          cwd: tmpdir(), timeout: 10000, env: {
            PATH: [bin, dirname(process.execPath), '/usr/bin', '/bin'].join(':'),
            INKSPIRE_TEST_LOG: log, ...extra,
          },
        });
        return { code: 0, ...result };
      } catch (error) {
        const failure = error as { code: number; stdout: string; stderr: string };
        return { code: failure.code, stdout: failure.stdout, stderr: failure.stderr };
      }
    };
    const calls = async (): Promise<Call[]> => {
      try { return (await readFile(log, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as Call); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
    };
    await action(root, invoke, calls);
  } finally { await rm(root, { recursive: true, force: true }); }
}

async function configured(root: string) {
  await writeFile(join(root, '.env.docker'),
    "INKSPIRE_PUBLIC_ORIGIN=https://192.168.50.20:8443\nMAPIC_SERVICE_TOKEN='" + sentinel + "'\n", { mode: 0o600 });
}
function operations(calls: Call[]) {
  return calls.filter(call => call.args[0] === 'compose' && call.args[1] !== 'version');
}

describe('Docker quickstart shell helper', () => {
  it('defaults to help without file creation or Docker calls', async () => {
    await fixture(async (root, invoke, calls) => {
      const result = await invoke([]);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('init');
      await expect(stat(join(root, '.env.docker'))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await calls()).toEqual([]);
    });
  });
  it('initializes a private file from a different cwd with spaces in its path', async () => {
    await fixture(async (root, invoke, calls) => {
      expect((await invoke(['init'])).code).toBe(0);
      expect(await readFile(join(root, '.env.docker'), 'utf8')).toBe(await readFile(join(root, 'deploy/docker.env.example'), 'utf8'));
      expect((await stat(join(root, '.env.docker'))).mode & 0o777).toBe(0o600);
      expect(await calls()).toEqual([]);
    });
  });
  it('preserves existing configuration', async () => {
    await fixture(async (root, invoke, calls) => {
      await configured(root);
      const before = await readFile(join(root, '.env.docker'), 'utf8');
      expect((await invoke(['init'])).code).toBe(0);
      expect(await readFile(join(root, '.env.docker'), 'utf8')).toBe(before);
      expect(await calls()).toEqual([]);
    });
  });
  it('rejects extra or unknown arguments before creating configuration', async () => {
    await fixture(async (root, invoke, calls) => {
      expect((await invoke(['init', 'unexpected'])).code).toBe(1);
      expect((await invoke(['destroy'])).code).toBe(1);
      await expect(stat(join(root, '.env.docker'))).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await calls()).toEqual([]);
    });
  });
  it('requires explicit initialization before attempting Docker', async () => {
    await fixture(async (_root, invoke, calls) => {
      const result = await invoke(['up']);
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('init');
      expect(await calls()).toEqual([]);
    });
  });
  it('rejects macOS before contacting Docker', async () => {
    await fixture(async (root, invoke, calls) => {
      await configured(root);
      const result = await invoke(['up'], { INKSPIRE_TEST_OS: 'Darwin' });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('Linux');
      expect(await calls()).toEqual([]);
    });
  });
  it.each([
    ['remote context', { INKSPIRE_TEST_ENDPOINT: 'ssh://fixture' }],
    ['Docker Desktop', { INKSPIRE_TEST_INFO: 'linux|Docker Desktop|[]' }],
    ['rootless daemon', { INKSPIRE_TEST_INFO: 'linux|Fixture Engine|["name=rootless"]' }],
    ['endpoint override', { DOCKER_HOST: 'tcp://fixture:2375' }],
  ])('rejects %s before Compose operations', async (_label, extra) => {
    await fixture(async (root, invoke, calls) => {
      await configured(root);
      expect((await invoke(['up'], extra)).code).toBe(1);
      expect(operations(await calls())).toEqual([]);
    });
  });
  it('sanitizes configuration failures and does not build/start', async () => {
    await fixture(async (root, invoke, calls) => {
      await configured(root);
      const result = await invoke(['up'], { INKSPIRE_TEST_BAD_CONFIG: '1' });
      expect(result.code).toBe(1);
      expect(result.stderr).toContain('.env.docker');
      expect(result.stdout + result.stderr).not.toContain(sentinel);
      const actual = operations(await calls());
      expect(actual).toHaveLength(1);
      expect(actual[0]!.args.slice(-2)).toEqual(['config', '--quiet']);
    });
  });
  it('builds then recreates this project using checkout env without evaluating it', async () => {
    await fixture(async (root, invoke, calls) => {
      const marker = join(root, 'unexpected-execution');
      await configured(root);
      await writeFile(join(root, '.env.docker'), 'EXECUTE_ME=$(touch "' + marker + '")\n', { flag: 'a' });
      const result = await invoke(['up'], {
        INKSPIRE_ENV_FILE: '/not-this-file', INKSPIRE_PUBLIC_ORIGIN: 'https://wrong.example', INKSPIRE_IMAGE: 'wrong-image',
      });
      expect(result.code).toBe(0);
      await expect(stat(marker)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(result.stdout + result.stderr).not.toContain(sentinel);
      const actual = operations(await calls());
      expect(actual.map(call => call.args.slice(9))).toEqual([
        ['config', '--quiet'], ['build', 'lan-config'], ['up', '-d', '--force-recreate'], ['ps', '--all'],
      ]);
      for (const call of actual) {
        expect(call.args.slice(0, 9)).toEqual(['compose', '--project-directory', root,
          '--project-name', 'inkspire', '--env-file', join(root, '.env.docker'), '--file', join(root, 'compose.yaml')]);
        expect(call.envFile).toBe(join(root, '.env.docker'));
        expect(call.origin).toBeUndefined();
        expect(call.image).toBeUndefined();
      }
    });
  });
  it('stops this project while keeping its volume', async () => {
    await fixture(async (root, invoke, calls) => {
      await configured(root);
      expect((await invoke(['down'])).code).toBe(0);
      const actual = operations(await calls());
      expect(actual.map(call => call.args.slice(9))).toEqual([['config', '--quiet'], ['down']]);
      expect(actual.some(call => call.args.includes('--volumes') || call.args.includes('--remove-orphans'))).toBe(false);
    });
  });
  it('status performs no build/start', async () => {
    await fixture(async (root, invoke, calls) => {
      await configured(root);
      expect((await invoke(['status'])).code).toBe(0);
      expect(operations(await calls()).map(call => call.args.slice(9))).toEqual([['config', '--quiet'], ['ps', '--all']]);
    });
  });
  it('exports only the public root certificate to the ignored root path', async () => {
    await fixture(async (root, invoke, calls) => {
      await configured(root);
      expect((await invoke(['export-ca'])).code).toBe(0);
      const actual = operations(await calls());
      expect(actual.map(call => call.args.slice(9))).toEqual([['config', '--quiet'],
        ['cp', 'proxy:/app/.inkspire-lan/data/pki/authorities/local/root.crt', join(root, 'inkspire-lan-root.crt')]]);
      expect(actual.some(call => call.args.some(arg => arg.includes('.key')))).toBe(false);
    });
  });
});
