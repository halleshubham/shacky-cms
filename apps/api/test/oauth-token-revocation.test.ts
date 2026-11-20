import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  oAuthAccessToken: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = { id: 'u1' }; },
  requireRoles: (...roles: string[]) => async () => {},
}));

import oauthRoutes from '../src/routes/oauth';
import mcpRoutes from '../src/routes/mcp';

const app = Fastify();
app.decorate('prisma', prisma as any);
app.register(oauthRoutes);
app.register(mcpRoutes);
afterAll(() => app.close());

beforeEach(() => vi.resetAllMocks());

describe('POST /oauth/revoke — soft revoke, not delete', () => {
  it('sets revoked: true and revokedAt instead of deleting the row', async () => {
    prisma.oAuthAccessToken.updateMany.mockResolvedValue({ count: 1 });
    const res = await app.inject({ method: 'POST', url: '/oauth/revoke', payload: { token: 'tok123' } });
    expect(res.statusCode).toBe(200);
    expect(prisma.oAuthAccessToken.updateMany).toHaveBeenCalledWith({
      where: { token: 'tok123', revoked: false },
      data: { revoked: true, revokedAt: expect.any(Date) },
    });
  });
});

describe('GET /api/oauth/tokens — excludes revoked tokens', () => {
  it('filters on revoked: false', async () => {
    prisma.oAuthAccessToken.findMany.mockResolvedValue([]);
    await app.inject({ method: 'GET', url: '/api/oauth/tokens' });
    expect(prisma.oAuthAccessToken.findMany.mock.calls[0][0].where).toMatchObject({ revoked: false });
  });
});

describe('DELETE /api/oauth/tokens/:id — soft revoke by id', () => {
  it('sets revoked instead of deleting, scoped to the owning user', async () => {
    prisma.oAuthAccessToken.updateMany.mockResolvedValue({ count: 1 });
    const res = await app.inject({ method: 'DELETE', url: '/api/oauth/tokens/t1' });
    expect(res.statusCode).toBe(200);
    expect(prisma.oAuthAccessToken.updateMany).toHaveBeenCalledWith({
      where: { id: 't1', userId: 'u1', revoked: false },
      data: { revoked: true, revokedAt: expect.any(Date) },
    });
  });

  it('404s when the token is already revoked or not owned', async () => {
    prisma.oAuthAccessToken.updateMany.mockResolvedValue({ count: 0 });
    const res = await app.inject({ method: 'DELETE', url: '/api/oauth/tokens/t1' });
    expect(res.statusCode).toBe(404);
  });
});

describe('POST /mcp — revoked token must be rejected like an expired one', () => {
  it('returns 401 for a revoked token even though it has not expired', async () => {
    prisma.oAuthAccessToken.findUnique.mockResolvedValue({
      userId: 'u1', scopes: ['posts:read'], revoked: true, expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    const res = await app.inject({
      method: 'POST', url: '/mcp', headers: { authorization: 'Bearer revoked-token' }, payload: {},
    });
    expect(res.statusCode).toBe(401);
  });

  it('allows a non-revoked, non-expired token through to the MCP handoff', async () => {
    prisma.oAuthAccessToken.findUnique.mockResolvedValue({
      userId: 'u1', scopes: ['posts:read'], revoked: false, expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    });
    const res = await app.inject({
      method: 'POST', url: '/mcp', headers: { authorization: 'Bearer good-token' }, payload: {},
    });
    expect(res.statusCode).not.toBe(401);
  });
});
