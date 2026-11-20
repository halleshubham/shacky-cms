import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// webhooks.ts, wordpress.ts, and botsab.ts all let an admin configure a URL
// (webhook target, WordPress site, Botsab base URL) that the server later
// fetches on its own — wordpress.ts additionally fetches image URLs found
// inside imported post content, which isn't even bounded to the configured
// site's own domain. Without this guard, any of those is a live SSRF
// primitive: the configured/embedded URL could point at an internal
// service (Redis, Postgres, another container) or a cloud metadata
// endpoint (169.254.169.254) and the server would fetch it on the
// attacker's behalf. This blocks fetches to private/loopback/link-local/
// metadata address space, resolving hostnames first so a DNS name can't
// just point at an internal IP.
//
// This is a point-in-time check, not a connection-time pin — a DNS record
// that changes between this lookup and the actual fetch (DNS rebinding) is
// a known residual risk for any guard that doesn't control the socket
// connect itself. Every call site here is already gated to admin roles,
// which keeps the realistic blast radius to "an admin configures a bad
// value", not an arbitrary unauthenticated attacker.

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true; // malformed — fail closed
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8 (private)
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (private)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (private)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (shared/CGNAT)
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true; // loopback / unspecified
  if (lower.startsWith('fe80:') || lower.startsWith('fec0:')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local, fc00::/7
  if (lower.startsWith('::ffff:')) {
    const mapped = lower.slice('::ffff:'.length);
    if (isIP(mapped) === 4) return isBlockedIPv4(mapped);
  }
  return false;
}

export class BlockedTargetError extends Error {}

export async function assertSafeExternalUrl(rawUrl: string): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedTargetError('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BlockedTargetError('Only http/https URLs are allowed');
  }

  // URL#hostname keeps the enclosing brackets for an IPv6 literal
  // (e.g. "[::1]"), but net.isIP() only recognizes the bracket-less form.
  const hostname = url.hostname;
  const bareHostname = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  const ipVersion = isIP(bareHostname);
  if (ipVersion === 4) {
    if (isBlockedIPv4(bareHostname)) throw new BlockedTargetError('Target address is not allowed');
    return;
  }
  if (ipVersion === 6) {
    if (isBlockedIPv6(bareHostname)) throw new BlockedTargetError('Target address is not allowed');
    return;
  }

  // Hostname, not a literal IP — resolve and check every address it maps to.
  let addresses: { address: string; family: number }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new BlockedTargetError('Could not resolve target host');
  }
  for (const { address, family } of addresses) {
    if (family === 4 && isBlockedIPv4(address)) throw new BlockedTargetError('Target address is not allowed');
    if (family === 6 && isBlockedIPv6(address)) throw new BlockedTargetError('Target address is not allowed');
  }
}

// Drop-in replacement for global fetch that rejects before ever opening a
// connection to a blocked target.
export async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  await assertSafeExternalUrl(url);
  return fetch(url, init);
}
