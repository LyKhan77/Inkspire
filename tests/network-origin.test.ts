import { expect, test } from 'vitest';
import { readPublicOrigin } from '../server/origin';
import { readConfig } from '../server/config';

test('default localhost and canonical private HTTPS origins', () => {
  expect(readConfig({}).origin).toBe('http://127.0.0.1:4173');
  expect(readPublicOrigin('')).toBeNull();
  expect(readPublicOrigin(undefined)).toBeNull();
  for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.20']) {
    expect(readPublicOrigin(`https://${ip}:8443/`)).toBe(`https://${ip}:8443`);
  }
  for (const port of [1024, 65535]) {
    expect(readPublicOrigin(`https://192.168.1.20:${port}`)).toContain(`:${port}`);
  }
  expect(readConfig({ INKSPIRE_PUBLIC_ORIGIN: 'https://192.168.1.20:8443/' }).origin)
    .toBe('https://192.168.1.20:8443');
});

test('reject non-LAN origins and noncanonical authorities without echoing input', () => {
  const values = [
    'http://192.168.1.20:8443', 'https://localhost:8443', 'https://127.0.0.1:8443',
    'https://0.0.0.0:8443', 'https://8.8.8.8:8443', 'https://172.15.1.1:8443',
    'https://172.32.1.1:8443', 'https://[::1]:8443', 'https://example.com:8443',
    'https://192.168.1.20', 'https://192.168.1.20:443', 'https://192.168.1.20:65536',
    'https://192.168.1.20:1023', 'https://192.168.1.20:08443',
    'https://192.168.001.20:8443', 'https://0xc0a80114:8443',
    'https://192.168.276:8443',
    'https://user:SECRET@192.168.1.20:8443', 'https://192.168.1.20:8443/path',
    'https://192.168.1.20:8443?q=SECRET', 'https://192.168.1.20:8443#SECRET',
    ' https://192.168.1.20:8443', 'https://192.168.1.20:8443\n', ' ',
  ];
  for (const value of values) expect(() => readPublicOrigin(value))
    .toThrow('INKSPIRE_PUBLIC_ORIGIN tidak valid.');
});

test('LAN origin is production only', () => {
  expect(() => readConfig({ INKSPIRE_PUBLIC_ORIGIN: 'https://192.168.1.20:8443' }, true))
    .toThrow('Akses LAN membutuhkan mode production.');
  expect(readConfig({}, true).mode).toBe('development');
  expect(readConfig({}, true).origin).toBe('http://127.0.0.1:4173');
});

test('existing MaPic configuration validation is preserved', () => {
  expect(() => readConfig({ INKSPIRE_PORT: '70000' })).toThrow('INKSPIRE_PORT tidak valid.');
  expect(() => readConfig({ MAPIC_BASE_URL: 'ftp://example.com' }))
    .toThrow('Konfigurasi URL MaPic tidak valid.');
  expect(() => readConfig({ MAPIC_SERVICE_TOKEN: 'a\nb' }))
    .toThrow('Konfigurasi token MaPic tidak valid.');
});