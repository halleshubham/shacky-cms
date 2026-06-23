import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Token format: shacky_<recordId>.<secret>
// recordId embedded so auth middleware can do a single DB lookup (O(1)) instead of
// iterating every password and bcrypt-comparing each one.
export function generateApplicationSecret(): { secret: string; hash: Promise<string> } {
  const secret = randomBytes(32).toString('hex');
  return { secret, hash: bcrypt.hash(secret, 10) };
}

export function buildApplicationToken(recordId: string, secret: string): string {
  return `shacky_${recordId}.${secret}`;
}

export function parseApplicationToken(token: string): { recordId: string; secret: string } | null {
  if (!token.startsWith('shacky_')) return null;
  const rest = token.slice('shacky_'.length);
  const dot = rest.indexOf('.');
  if (dot < 1) return null;
  return { recordId: rest.slice(0, dot), secret: rest.slice(dot + 1) };
}
