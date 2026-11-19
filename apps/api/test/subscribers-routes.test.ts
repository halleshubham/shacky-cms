import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  subscriber: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  subscriberListMember: { upsert: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
const fireWebhook = vi.hoisted(() => vi.fn());
vi.mock('../src/utils/webhooks.js', () => ({ fireWebhook }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = { id: 'me', role: 'superadmin' }; },
  requireRoles: (...roles: string[]) => async (req: any, reply: any) => {
    if (!roles.includes(req.user?.role)) reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
  },
}));

import subscribersRoutes from '../src/routes/subscribers';

const app = Fastify();
app.register(subscribersRoutes, { prefix: '/api/subscribers' });
afterAll(() => app.close());

beforeEach(() => vi.resetAllMocks());

describe('POST /api/subscribers/subscribe — member.created', () => {
  it('fires member.created for a brand new subscriber', async () => {
    prisma.subscriber.findFirst.mockResolvedValue(null);
    prisma.subscriber.create.mockResolvedValue({ id: 's1', email: 'new@test.local' });
    await app.inject({ method: 'POST', url: '/api/subscribers/subscribe', payload: { email: 'new@test.local' } });
    expect(fireWebhook).toHaveBeenCalledWith('member.created', expect.objectContaining({ id: 's1' }));
  });

  it('does not fire member.created when the subscriber already exists', async () => {
    prisma.subscriber.findFirst.mockResolvedValue({ id: 's1', email: 'existing@test.local' });
    await app.inject({ method: 'POST', url: '/api/subscribers/subscribe', payload: { email: 'existing@test.local' } });
    expect(fireWebhook).not.toHaveBeenCalled();
    expect(prisma.subscriber.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/subscribers/unsubscribe/:token — member.updated', () => {
  it('fires member.updated on successful unsubscribe', async () => {
    prisma.subscriber.findUnique.mockResolvedValue({ id: 's1', email: 'a@test.local', unsubscribeToken: 'tok' });
    prisma.subscriber.update.mockResolvedValue({});
    const res = await app.inject({ method: 'GET', url: '/api/subscribers/unsubscribe/tok' });
    expect(res.statusCode).toBe(200);
    expect(fireWebhook).toHaveBeenCalledWith('member.updated', expect.objectContaining({ id: 's1', status: 'unsubscribed' }));
  });

  it('does not fire for an invalid token', async () => {
    prisma.subscriber.findUnique.mockResolvedValue(null);
    const res = await app.inject({ method: 'GET', url: '/api/subscribers/unsubscribe/bad-token' });
    expect(res.statusCode).toBe(404);
    expect(fireWebhook).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/subscribers/:id — member.deleted', () => {
  it('fires member.deleted', async () => {
    prisma.subscriber.delete.mockResolvedValue({});
    const res = await app.inject({ method: 'DELETE', url: '/api/subscribers/s1' });
    expect(res.statusCode).toBe(200);
    expect(fireWebhook).toHaveBeenCalledWith('member.deleted', { id: 's1' });
  });
});
