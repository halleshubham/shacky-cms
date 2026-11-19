import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

vi.mock('../src/services/ai.js', () => ({
  getAIConfig: vi.fn(),
  saveAIConfig: vi.fn(),
  generateContent: vi.fn(),
  generateExcerpt: vi.fn(),
  suggestSEO: vi.fn(),
  generateFeaturedImage: vi.fn(),
  buildImagePrompt: vi.fn(),
}));
vi.mock('../src/utils/audit.js', () => ({ audit: vi.fn() }));

const mockUser = vi.hoisted(() => ({ current: { id: 'u1', email: 'a@b.test', role: 'author' } }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async (req: any) => { req.user = mockUser.current; },
  requireAdmin: async (req: any, reply: any) => {
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'editor') {
      reply.status(403).send({ statusCode: 403, error: 'Forbidden' });
    }
  },
}));

// A fetch spy proves whether the SSRF-able outbound request was attempted at
// all — the real regression check, not just the status code.
const fetchSpy = vi.fn();
vi.stubGlobal('fetch', fetchSpy);

import aiRoutes from '../src/routes/ai';

const app = Fastify();
app.register(aiRoutes, { prefix: '/api/ai' });
afterAll(() => app.close());

beforeEach(() => {
  fetchSpy.mockReset();
  fetchSpy.mockResolvedValue({ ok: false }); // falls back to the static model list either way
  mockUser.current = { id: 'u1', email: 'a@b.test', role: 'author' };
});

describe('GET /api/ai/models — SSRF fix', () => {
  it.each(['author', 'subscriber_manager'])(
    'blocks %s from triggering the server-side Ollama fetch at all',
    async (role) => {
      mockUser.current = { ...mockUser.current, role };
      const res = await app.inject({ url: '/api/ai/models?ollamaUrl=http://169.254.169.254/latest/meta-data' });
      expect(res.statusCode).toBe(403);
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it.each(['superadmin', 'editor'])('allows %s through to fetch their own configured Ollama URL', async (role) => {
    mockUser.current = { ...mockUser.current, role };
    const res = await app.inject({ url: '/api/ai/models?ollamaUrl=http://localhost:11434' });
    expect(res.statusCode).toBe(200);
    expect(fetchSpy).toHaveBeenCalledWith('http://localhost:11434/api/tags', expect.anything());
  });
});
