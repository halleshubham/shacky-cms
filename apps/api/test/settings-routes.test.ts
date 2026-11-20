import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  setting: { findMany: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));

const mockUser = vi.hoisted(() => ({ current: { id: 'me', role: 'superadmin' as string } }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = mockUser.current; },
  requireAdmin: async (req: any, reply: any) => {
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'editor') {
      reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
    }
  },
}));

import settingsRoutes from '../src/routes/settings';

const app = Fastify();
app.register(settingsRoutes, { prefix: '/api/settings' });
afterAll(() => app.close());

const SECRET_ROWS = [
  { key: 'ai_api_key', value: 'sk-real-secret-123' },
  { key: 'smtp_pass', value: 'real-smtp-password' },
  { key: 'resend_api_key', value: 're_real_key' },
  { key: 'botsab_api_key', value: 'botsab-real-key' },
  { key: 'stock_unsplash_key', value: 'unsplash-real-key' },
  { key: 'site_title', value: 'My Site' },
];

beforeEach(() => {
  vi.resetAllMocks();
  mockUser.current = { id: 'me', role: 'superadmin' };
  prisma.setting.findMany.mockResolvedValue(SECRET_ROWS);
});

// Regression coverage: GET /settings returned every secret-bearing key
// (AI provider key, SMTP password, Botsab/Resend/stock-photo API keys) in
// plaintext to the editor role too, not just superadmin — requireAdmin lets
// both through, but only superadmin should ever see the real credential value.
describe('GET /api/settings — secret redaction', () => {
  it('superadmin sees real secret values', async () => {
    const res = await app.inject({ url: '/api/settings' });
    const body = res.json();
    expect(body.ai_api_key).toBe('sk-real-secret-123');
    expect(body.smtp_pass).toBe('real-smtp-password');
    expect(body.resend_api_key).toBe('re_real_key');
    expect(body.botsab_api_key).toBe('botsab-real-key');
    expect(body.stock_unsplash_key).toBe('unsplash-real-key');
  });

  it('editor gets every secret key redacted to a fixed placeholder, not the real value', async () => {
    mockUser.current = { id: 'ed1', role: 'editor' };
    const res = await app.inject({ url: '/api/settings' });
    const body = res.json();
    expect(body.ai_api_key).toBe('***');
    expect(body.smtp_pass).toBe('***');
    expect(body.resend_api_key).toBe('***');
    expect(body.botsab_api_key).toBe('***');
    expect(body.stock_unsplash_key).toBe('***');
  });

  it('non-secret keys are returned unredacted regardless of role', async () => {
    mockUser.current = { id: 'ed1', role: 'editor' };
    const res = await app.inject({ url: '/api/settings' });
    expect(res.json().site_title).toBe('My Site');
  });

  it('an unset secret stays empty rather than becoming a fake "***" value', async () => {
    mockUser.current = { id: 'ed1', role: 'editor' };
    prisma.setting.findMany.mockResolvedValue([{ key: 'site_title', value: 'My Site' }]);
    const res = await app.inject({ url: '/api/settings' });
    expect(res.json().ai_api_key).toBeUndefined();
  });

  it('a role below editor/superadmin is rejected entirely by requireAdmin (unchanged)', async () => {
    mockUser.current = { id: 'a1', role: 'author' };
    const res = await app.inject({ url: '/api/settings' });
    expect(res.statusCode).toBe(403);
  });
});
