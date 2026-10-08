import { spawn } from 'node:child_process';
import { startApp } from '../server/app';
import { startMock, TEST_TOKEN } from './mock-mapic';
const mock = await startMock(4184);
const production = process.env.INKSPIRE_TEST_MODE === 'production';
const config = { port: 4183, origin: 'http://127.0.0.1:4183', mode: 'development' as const, mapicBaseURL: mock.origin, mapicServiceToken: TEST_TOKEN, generationTimeoutMs: 3_660_000 };
const child = production ? spawn(process.execPath, ['dist-server/server/index.js'], { env: { PATH: process.env.PATH, INKSPIRE_PORT: '4183', MAPIC_BASE_URL: mock.origin, MAPIC_SERVICE_TOKEN: TEST_TOKEN }, stdio: 'inherit' }) : null;
const app = production ? null : await startApp(config);
if (child) child.once('exit', code => { if (code) process.exit(code); });
async function close() { if (child) child.kill('SIGTERM'); await app?.close(); await mock.close(); process.exit(0); }
process.once('SIGINT', close); process.once('SIGTERM', close);
