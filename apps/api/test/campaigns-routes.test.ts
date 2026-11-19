import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  campaign: { findUnique: vi.fn(), update: vi.fn() },
  subscriber: { findMany: vi.fn() },
  issue: { findUnique: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));
const fireWebhook = vi.hoisted(() => vi.fn());
vi.mock('../src/utils/webhooks.js', () => ({ fireWebhook }));
vi.mock('../src/services/botsab.js', () => ({ sendMessagesToGroups: vi.fn() }));
vi.mock('../src/services/newsletter.js', () => ({
  generateNewsletterHtml: vi.fn().mockResolvedValue('<p>html</p>'),
  generateWhatsAppDigest: vi.fn(),
  generateWhatsAppChannelMessages: vi.fn(),
  getNewsletterSettings: vi.fn(),
}));

const sendMail = vi.hoisted(() => vi.fn());
const getEmailConfig = vi.hoisted(() => vi.fn());
vi.mock('../src/services/email.js', () => ({ sendMail, getEmailConfig }));

vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = { id: 'me', email: 'me@test.local', role: 'superadmin' }; },
  requireRoles: (...roles: string[]) => async (req: any, reply: any) => {
    if (!roles.includes(req.user?.role)) reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
  },
}));

import campaignsRoutes from '../src/routes/campaigns';

const app = Fastify();
app.register(campaignsRoutes, { prefix: '/api/campaigns' });
afterAll(() => app.close());

const campaign = { id: 'c1', issueId: 'i1', subscriberListId: 'l1', status: 'draft', blocks: [] };
const issue = { id: 'i1', title: 'Issue 1', posts: [] };

function makeSubscribers(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `s${i}`, email: `sub${i}@test.local`, unsubscribeToken: `t${i}` }));
}

beforeEach(() => {
  vi.resetAllMocks();
  prisma.campaign.findUnique.mockResolvedValue(campaign);
  prisma.issue.findUnique.mockResolvedValue(issue);
  prisma.campaign.update.mockResolvedValue(campaign);
  getEmailConfig.mockResolvedValue({});
});

const send = (id = 'c1') => app.inject({ method: 'POST', url: `/api/campaigns/${id}/send` });

describe('POST /api/campaigns/:id/send — accurate status on delivery failure', () => {
  it('marks the campaign failed (not sent) and returns an error when every send fails', async () => {
    prisma.subscriber.findMany.mockResolvedValue(makeSubscribers(3));
    sendMail.mockRejectedValue(new Error('no provider configured'));

    const res = await send();

    expect(res.statusCode).toBe(502);
    const finalUpdate = prisma.campaign.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data.status).toBe('failed');
    expect(finalUpdate.data.sentCount).toBe(0);
    expect(finalUpdate.data.sentAt).toBeNull();
  });

  it('reports the failure count on a partial failure, but still marks it sent', async () => {
    prisma.subscriber.findMany.mockResolvedValue(makeSubscribers(3));
    sendMail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('bounced'))
      .mockResolvedValueOnce(undefined);

    const res = await send();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, sent: 2, failed: 1 });
    const finalUpdate = prisma.campaign.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data.status).toBe('sent');
    expect(finalUpdate.data.sentCount).toBe(2);
  });

  it('marks it sent with zero failures when every send succeeds', async () => {
    prisma.subscriber.findMany.mockResolvedValue(makeSubscribers(2));
    sendMail.mockResolvedValue(undefined);

    const res = await send();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, sent: 2, failed: 0 });
  });

  it('is not a failure when there are simply no subscribers to send to', async () => {
    prisma.subscriber.findMany.mockResolvedValue([]);

    const res = await send();

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true, sent: 0, failed: 0 });
    const finalUpdate = prisma.campaign.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data.status).toBe('sent');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('still blocks re-sending an already-sent campaign (unchanged behavior)', async () => {
    prisma.campaign.findUnique.mockResolvedValue({ ...campaign, status: 'sent' });
    const res = await send();
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /api/campaigns/:id/send — campaign.sent webhook', () => {
  it('fires campaign.sent when the send succeeds (even partially)', async () => {
    prisma.subscriber.findMany.mockResolvedValue(makeSubscribers(3));
    sendMail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('bounced'))
      .mockResolvedValueOnce(undefined);

    await send();

    expect(fireWebhook).toHaveBeenCalledWith('campaign.sent', expect.objectContaining({ id: 'c1', sent: 2, failed: 1 }));
  });

  it('does not fire campaign.sent when every send fails', async () => {
    prisma.subscriber.findMany.mockResolvedValue(makeSubscribers(3));
    sendMail.mockRejectedValue(new Error('no provider configured'));

    await send();

    expect(fireWebhook).not.toHaveBeenCalled();
  });
});
