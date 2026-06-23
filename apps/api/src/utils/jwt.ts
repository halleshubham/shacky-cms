import { SignJWT, jwtVerify } from 'jose';
import type { JwtPayload, Role } from '@shacky/shared';
import { env } from './env.js';

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiry: ${expiry}`);
  const val = parseInt(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  return val * multipliers[unit];
}

export async function signAccessToken(payload: { sub: string; email: string; role: Role }): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${parseExpiry(env.JWT_ACCESS_EXPIRES_IN)}s`)
    .sign(secret);
}

export async function signRefreshToken(payload: { sub: string; email: string; role: Role }): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${parseExpiry(env.JWT_REFRESH_EXPIRES_IN)}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JwtPayload;
}

export async function verifyRefreshToken(token: string): Promise<JwtPayload> {
  const secret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);
  const { payload } = await jwtVerify(token, secret);
  return payload as unknown as JwtPayload;
}
