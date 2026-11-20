import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/newsletter.js', () => ({
  generateNewsletterHtml: vi.fn().mockResolvedValue('<p>html</p>'),
  getNewsletterSettings: vi.fn(),
}));

const sendMail = vi.hoisted(() => vi.fn());
vi.mock('../src/services/email.js', () => ({ sendMail }));

import { createMcpServer } from '../src/services/mcpServer';

const campaign = {
  id: 'c1',
  status: 'draft',
  subscriberListId: 'l1',
  issue: { title: 'Issue 1', posts: [] },
};

function makeSubscribers(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `s${i}`, email: `sub${i}@test.local`, unsubscribeToken: `t${i}` }));
}

function makePrisma() {
  return {
    campaign: { findUnique: vi.fn().mockResolvedValue(campaign), update: vi.fn().mockResolvedValue(campaign) },
    subscriber: { findMany: vi.fn().mockResolvedValue([]) },
    setting: { findMany: vi.fn().mockResolvedValue([]) },
    post: { count: vi.fn().mockResolvedValue(0) },
  } as any;
}

function getSendCampaignHandler(prisma: any, role: any = 'superadmin') {
  const server = createMcpServer(prisma, 'user1', role, ['campaigns:write', 'campaigns:read']);
  return (server as any)._registeredTools['send_campaign'].handler;
}

beforeEach(() => vi.resetAllMocks());

describe('MCP send_campaign — confirmation gate', () => {
  it('refuses to send without confirm: true', async () => {
    const prisma = makePrisma();
    const handler = getSendCampaignHandler(prisma);
    const result = await handler({ campaignId: 'c1', confirm: false });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('confirm must be true');
    expect(prisma.campaign.update).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('sends when confirm: true and reports success', async () => {
    const prisma = makePrisma();
    prisma.subscriber.findMany.mockResolvedValue(makeSubscribers(2));
    sendMail.mockResolvedValue(undefined);
    const handler = getSendCampaignHandler(prisma);
    const result = await handler({ campaignId: 'c1', confirm: true });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toMatchObject({ success: true, sent: 2, total: 2 });
  });
});

describe('MCP send_campaign — accurate status on delivery failure', () => {
  it('does not report success when every send fails', async () => {
    const prisma = makePrisma();
    prisma.subscriber.findMany.mockResolvedValue(makeSubscribers(3));
    sendMail.mockRejectedValue(new Error('no provider configured'));
    const handler = getSendCampaignHandler(prisma);
    const result = await handler({ campaignId: 'c1', confirm: true });
    expect(result.isError).toBe(true);
    const finalUpdate = prisma.campaign.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data.status).toBe('failed');
    expect(finalUpdate.data.sentCount).toBe(0);
  });

  it('reports partial success accurately', async () => {
    const prisma = makePrisma();
    prisma.subscriber.findMany.mockResolvedValue(makeSubscribers(3));
    sendMail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('bounced'))
      .mockResolvedValueOnce(undefined);
    const handler = getSendCampaignHandler(prisma);
    const result = await handler({ campaignId: 'c1', confirm: true });
    expect(result.isError).toBeUndefined();
    expect(JSON.parse(result.content[0].text)).toMatchObject({ success: true, sent: 2, total: 3 });
    const finalUpdate = prisma.campaign.update.mock.calls.at(-1)![0];
    expect(finalUpdate.data.status).toBe('sent');
  });
});
