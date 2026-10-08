import { isIP } from 'node:net';

const INVALID = 'INKSPIRE_PUBLIC_ORIGIN tidak valid.';

/**
 * Parse the optional LAN public origin into one canonical origin string.
 * Only HTTPS with a canonical private RFC 1918 IPv4 literal and an explicit
 * port is accepted; every other shape is rejected with a fixed message so no
 * operator input is echoed back.
 */
export function readPublicOrigin(raw: string | undefined): string | null {
  if (raw === undefined || raw === '') return null;
  if (raw.trim() !== raw) throw new Error(INVALID);
  const match = /^https:\/\/(\d{1,3}(?:\.\d{1,3}){3}):([1-9]\d{3,4})\/?$/u.exec(raw);
  if (!match) throw new Error(INVALID);
  const ip = match[1]!;
  const port = Number(match[2]);
  const octets = ip.split('.').map(Number);
  const privateIP = octets[0] === 10
    || (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31)
    || (octets[0] === 192 && octets[1] === 168);
  if (isIP(ip) !== 4 || !privateIP || port < 1024 || port > 65535) throw new Error(INVALID);
  return new URL(raw).origin;
}