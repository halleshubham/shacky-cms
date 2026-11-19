import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import { createHash } from 'crypto';
import { signRefreshToken } from '../src/utils/jwt';

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  refreshToken: { findFirst: vi.fn(), create: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));
vi.mock('../src/services/email.js', () => ({ sendMail: vi.fn() }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => {
    req.user = { id: 'u1', email: 'a@b.test', role: 'editor', name: 'Ed' };
  },
  requireSuperAdmin: async () => {},
}));

import authRoutes from '../src/routes/auth';

const app = Fastify();
app.register(cookie, { secret: 'test-cookie-secret' });
app.register(authRoutes, { prefix: '/api/auth' });
afterAll(() => app.close());

const user = { id: 'u1', email: 'a@b.test', role: 'editor', name: 'Ed', passwordHash: 'x', totpEnabled: false };
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

beforeEach(() => {
  vi.resetAllMocks();
  prisma.$transaction.mockImplementation(async (ops: any[]) => Promise.all(ops));
  prisma.user.findUnique.mockResolvedValue(user);
});

// A "stored session": the real refresh JWT plus the SHA-256 hash of it the way
// /login and /refresh persist it — lets tests simulate "this token's row still
// exists" (findFirst returns it) vs. "it's been revoked/rotated" (returns null).
// Regression coverage for the real bug this replaced: bcrypt truncates at 72
// bytes, so every refresh token issued to the same user (same sub/email/role/
// type prefix) hashed identically under bcrypt — revoking one session's token
// matched and invalidated every session that user ever had. SHA-256 has no
// such truncation, so two distinct sessions must never collide.
let sessionCounter = 0;
async function issueSession() {
  const token = await signRefreshToken({ sub: user.id, email: user.email, role: user.role as any });
  const row = { id: `rt${++sessionCounter}`, userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 1000000) };
  return { token, row };
}

describe('refresh token hashing', () => {
  it('two sessions for the same user never produce the same tokenHash', async () => {
    const a = await issueSession();
    const b = await issueSession();
    expect(a.token).not.toBe(b.token); // jti makes them distinct even same-second
    expect(a.row.tokenHash).not.toBe(b.row.tokenHash);
  });
});

describe('POST /api/auth/refresh', () => {
  it('rejects a refresh token with no matching session row (e.g. already logged out)', async () => {
    const { token } = await issueSession();
    prisma.refreshToken.findFirst.mockResolvedValue(null); // no live session for this token
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', cookies: { refresh_token: token } });
    expect(res.statusCode).toBe(401);
    expect(prisma.refreshToken.delete).not.toHaveBeenCalled();
  });

  it('accepts a refresh token with a matching session row and rotates it', async () => {
    const { token, row } = await issueSession();
    prisma.refreshToken.findFirst.mockResolvedValue(row);
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', cookies: { refresh_token: token } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('accessToken');
    // old row deleted, new row created — same transaction, old token can't be reused
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: row.id } });
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('looks up the session by exact tokenHash, not just any live row for the user', async () => {
    const { token } = await issueSession();
    prisma.refreshToken.findFirst.mockImplementation(({ where }: any) => {
      expect(where.tokenHash).toBe(sha256(token));
      expect(where.expiresAt.gt).toBeInstanceOf(Date);
      return null;
    });
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', cookies: { refresh_token: token } });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the session row matching the presented refresh token', async () => {
    const { token, row } = await issueSession();
    prisma.refreshToken.findFirst.mockResolvedValue(row);
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', cookies: { refresh_token: token } });
    expect(res.statusCode).toBe(200);
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: row.id } });
  });

  it('a refresh token used again after logout is rejected (the original bug)', async () => {
    const { token, row } = await issueSession();
    // First call (logout): the session is live.
    prisma.refreshToken.findFirst.mockResolvedValueOnce(row);
    const logoutRes = await app.inject({ method: 'POST', url: '/api/auth/logout', cookies: { refresh_token: token } });
    expect(logoutRes.statusCode).toBe(200);
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: row.id } });

    // Second call (reuse attempt): the row is gone, so no session matches this token.
    prisma.refreshToken.findFirst.mockResolvedValueOnce(null);
    const reuseRes = await app.inject({ method: 'POST', url: '/api/auth/refresh', cookies: { refresh_token: token } });
    expect(reuseRes.statusCode).toBe(401);
  });

  it('does NOT revoke an unrelated session for the same user (the bcrypt-truncation bug)', async () => {
    const mine = await issueSession();
    const other = await issueSession();
    // Logging out of "mine" must only ever look up/delete by mine's exact hash.
    prisma.refreshToken.findFirst.mockImplementation(({ where }: any) =>
      where.tokenHash === mine.row.tokenHash ? mine.row : null,
    );
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', cookies: { refresh_token: mine.token } });
    expect(res.statusCode).toBe(200);
    expect(prisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: mine.row.id } });
    expect(prisma.refreshToken.delete).not.toHaveBeenCalledWith({ where: { id: other.row.id } });
  });

  it('still clears cookies and succeeds when no session row matches (nothing to revoke)', async () => {
    const { token } = await issueSession();
    prisma.refreshToken.findFirst.mockResolvedValue(null);
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout', cookies: { refresh_token: token } });
    expect(res.statusCode).toBe(200);
    expect(prisma.refreshToken.delete).not.toHaveBeenCalled();
  });
});
