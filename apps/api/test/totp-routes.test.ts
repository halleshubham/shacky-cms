import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import { authenticator } from 'otplib';

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));
vi.mock('../src/services/email.js', () => ({ sendMail: vi.fn() }));

const mockUser = vi.hoisted(() => ({ current: { id: 'u1', email: 'a@b.test', role: 'editor', name: 'Ed' } }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = mockUser.current; },
  requireSuperAdmin: async (req: any, reply: any) => {
    if (req.user?.role !== 'superadmin') reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
  },
}));

import authRoutes from '../src/routes/auth';

const app = Fastify();
app.register(authRoutes, { prefix: '/api/auth' });
afterAll(() => app.close());

const secret = authenticator.generateSecret();
const otherSecret = authenticator.generateSecret();

beforeEach(() => {
  vi.resetAllMocks();
  mockUser.current = { id: 'u1', email: 'a@b.test', role: 'editor', name: 'Ed' };
});

describe('POST /api/auth/totp/setup — re-setup requires current code', () => {
  it('generates a fresh secret with no check when 2FA is not yet enabled', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.test', totpEnabled: false, totpSecret: null });
    const res = await app.inject({ method: 'POST', url: '/api/auth/totp/setup', payload: {} });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('rejects re-setup while already enabled without the current code', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.test', totpEnabled: true, totpSecret: secret });
    const res = await app.inject({ method: 'POST', url: '/api/auth/totp/setup', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects re-setup with a code for the wrong secret (stolen-session guard)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.test', totpEnabled: true, totpSecret: secret });
    const wrongCode = authenticator.generate(otherSecret);
    const res = await app.inject({ method: 'POST', url: '/api/auth/totp/setup', payload: { currentCode: wrongCode } });
    expect(res.statusCode).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows re-setup when the current code is correct', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@b.test', totpEnabled: true, totpSecret: secret });
    const currentCode = authenticator.generate(secret);
    const res = await app.inject({ method: 'POST', url: '/api/auth/totp/setup', payload: { currentCode } });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.update).toHaveBeenCalled();
  });
});

describe('POST /api/auth/totp/disable — self-service vs admin override', () => {
  it('rejects self-disable without a code', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', totpEnabled: true, totpSecret: secret });
    const res = await app.inject({ method: 'POST', url: '/api/auth/totp/disable', payload: {} });
    expect(res.statusCode).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects self-disable with a wrong code', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', totpEnabled: true, totpSecret: secret });
    const wrongCode = authenticator.generate(otherSecret);
    const res = await app.inject({ method: 'POST', url: '/api/auth/totp/disable', payload: { code: wrongCode } });
    expect(res.statusCode).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('disables with the correct current code', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', totpEnabled: true, totpSecret: secret });
    const code = authenticator.generate(secret);
    const res = await app.inject({ method: 'POST', url: '/api/auth/totp/disable', payload: { code } });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { totpEnabled: false, totpSecret: null } });
  });

  it('a non-superadmin cannot disable someone else\'s 2FA', async () => {
    mockUser.current = { id: 'u1', email: 'a@b.test', role: 'editor', name: 'Ed' };
    const res = await app.inject({ method: 'POST', url: '/api/auth/totp/disable', payload: { userId: 'u2' } });
    expect(res.statusCode).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('a superadmin can force-disable another user\'s 2FA with no code (device-lost recovery)', async () => {
    mockUser.current = { id: 'admin1', email: 'admin@b.test', role: 'superadmin', name: 'Admin' };
    const res = await app.inject({ method: 'POST', url: '/api/auth/totp/disable', payload: { userId: 'u2' } });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { totpEnabled: false, totpSecret: null } });
  });
});
