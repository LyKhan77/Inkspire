export interface AppConfig {
  port: number; origin: string; mode: 'development' | 'production';
  mapicBaseURL: string | null; mapicServiceToken: string | null; generationTimeoutMs: number;
}
export function readConfig(env: NodeJS.ProcessEnv, development = false): AppConfig {
  const port = Number(env.INKSPIRE_PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('INKSPIRE_PORT tidak valid.');
  let base: string | null = null;
  if (env.MAPIC_BASE_URL) {
    try { const url = new URL(env.MAPIC_BASE_URL); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error(); base = url.href; }
    catch { throw new Error('Konfigurasi URL MaPic tidak valid.'); }
  }
  const token = env.MAPIC_SERVICE_TOKEN || null;
  if (token && /[\r\n]/.test(token)) throw new Error('Konfigurasi token MaPic tidak valid.');
  return { port, origin: `http://127.0.0.1:${port}`, mode: development ? 'development' : 'production', mapicBaseURL: base, mapicServiceToken: token, generationTimeoutMs: 3_660_000 };
}
