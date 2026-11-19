import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  setting: { findUnique: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));
vi.mock('../src/services/email.js', () => ({ sendMail: vi.fn() }));
vi.mock('../src/utils/env.js', () => ({ env: { APP_URL: 'http://localhost:3000' } }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => {
    req.user = { id: 'me', email: 'me@test.local', role: 'superadmin', name: 'Me' };
  },
  requireSuperAdmin: async () => {},
}));

import usersRoutes from '../src/routes/users';

const app = Fastify();
app.register(usersRoutes, { prefix: '/api/users' });
afterAll(() => app.close());

beforeEach(() => {
  vi.resetAllMocks();
  prisma.user.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }));
});

const patch = (id: string, payload: unknown) => app.inject({ method: 'PATCH', url: `/api/users/${id}`, payload: payload as any });
const del = (id: string) => app.inject({ method: 'DELETE', url: `/api/users/${id}` });

describe('PATCH /api/users/:id — last-superadmin guard', () => {
  it('blocks demoting the last superadmin', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'superadmin' });
    prisma.user.count.mockResolvedValue(1);
    const res = await patch('other', { role: 'author' });
    expect(res.statusCode).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('allows demoting a superadmin when another one still exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'superadmin' });
    prisma.user.count.mockResolvedValue(2);
    const res = await patch('other', { role: 'author' });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('blocks self-demotion when it is the last superadmin (the original bug)', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'superadmin' });
    prisma.user.count.mockResolvedValue(1);
    const res = await patch('me', { role: 'author' });
    expect(res.statusCode).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('never counts superadmins when the target is not one', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'editor' });
    const res = await patch('other', { role: 'author' });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('skips the guard entirely when role is not being changed', async () => {
    const res = await patch('other', { name: 'New Name' });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('skips the guard when promoting to / staying at superadmin', async () => {
    const res = await patch('other', { role: 'superadmin' });
    expect(res.statusCode).toBe(200);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('404s for an unknown user instead of silently succeeding', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await patch('ghost', { role: 'author' });
    expect(res.statusCode).toBe(404);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/users/:id — last-superadmin guard', () => {
  it('blocks deleting the last superadmin', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'superadmin' });
    prisma.user.count.mockResolvedValue(1);
    const res = await del('other');
    expect(res.statusCode).toBe(400);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('allows deleting a superadmin when another one still exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'superadmin' });
    prisma.user.count.mockResolvedValue(2);
    const res = await del('other');
    expect(res.statusCode).toBe(200);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'other' } });
  });

  it('never counts superadmins when deleting a non-superadmin', async () => {
    prisma.user.findUnique.mockResolvedValue({ role: 'author' });
    const res = await del('other');
    expect(res.statusCode).toBe(200);
    expect(prisma.user.count).not.toHaveBeenCalled();
  });

  it('still blocks deleting yourself (unchanged behavior)', async () => {
    const res = await del('me');
    expect(res.statusCode).toBe(400);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('404s for an unknown user instead of a raw 500', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await del('ghost');
    expect(res.statusCode).toBe(404);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
