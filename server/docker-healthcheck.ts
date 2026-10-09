import { request } from 'node:http';
import { readConfig } from './config.js';

try {
  if (process.argv.slice(2).join(' ') !== 'companion') throw new Error('mode');
  const config = readConfig(process.env);
  await new Promise<void>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: config.port, path: '/', method: 'HEAD',
      headers: { Host: new URL(config.origin).host } }, res => {
      res.resume();
      clearTimeout(deadline);
      if (res.statusCode === 200) resolve();
      else reject(new Error('not ready'));
    });
    const deadline = setTimeout(() => req.destroy(new Error('deadline')), 5000);
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
    req.once('error', () => { clearTimeout(deadline); reject(new Error('unavailable')); });
    req.end();
  });
  process.exit(0);
} catch {
  console.error('Inkspire healthcheck failed.');
  process.exit(1);
}
