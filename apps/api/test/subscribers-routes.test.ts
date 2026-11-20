import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';

const prisma = vi.hoisted(() => ({
  subscriber: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
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

import subscribersRoutes, { parseCsv } from '../src/routes/subscribers';

const app = Fastify();
app.register(multipart);
app.register(subscribersRoutes, { prefix: '/api/subscribers' });
afterAll(() => app.close());

function csvForm(content: string) {
  const b = 'XBOUNDARYX';
  const parts = [
    Buffer.from(`--${b}\r\nContent-Disposition: form-data; name="file"; filename="subs.csv"\r\nContent-Type: text/csv\r\n\r\n`),
    Buffer.from(content),
    Buffer.from(`\r\n--${b}--\r\n`),
  ];
  return { payload: Buffer.concat(parts), headers: { 'content-type': `multipart/form-data; boundary=${b}` } };
}

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

describe('parseCsv', () => {
  it('splits plain comma-separated rows', () => {
    expect(parseCsv('a,b,c\n1,2,3')).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('keeps a comma inside a quoted field intact (the actual bug)', () => {
    expect(parseCsv('email,phone,name\na@b.com,555,"Doe, Jane"')).toEqual([
      ['email', 'phone', 'name'],
      ['a@b.com', '555', 'Doe, Jane'],
    ]);
  });

  it('unescapes doubled quotes inside a quoted field', () => {
    expect(parseCsv('name\n"Say ""hi"""')).toEqual([['name'], ['Say "hi"']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('POST /api/subscribers/import — CSV parsing and update-all-fields', () => {
  it('does not split a quoted name containing a comma into extra columns', async () => {
    prisma.subscriber.upsert.mockResolvedValue({});
    const res = await app.inject({
      method: 'POST',
      url: '/api/subscribers/import',
      ...csvForm('email,phone,name,channels\na@b.com,555,"Doe, Jane",email'),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ imported: 1, skipped: 0 });
    const call = prisma.subscriber.upsert.mock.calls[0][0];
    expect(call.create.name).toBe('Doe, Jane');
  });

  it('updates phone and channels on re-import, not just name (the other bug)', async () => {
    prisma.subscriber.upsert.mockResolvedValue({});
    await app.inject({
      method: 'POST',
      url: '/api/subscribers/import',
      ...csvForm('email,phone,name,channels\na@b.com,999,Jane,both'),
    });
    const call = prisma.subscriber.upsert.mock.calls[0][0];
    expect(call.update).toMatchObject({ name: 'Jane', phone: '999', channels: 'both' });
  });
});
