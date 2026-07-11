import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import {
  getAIConfig,
  saveAIConfig,
  generateContent,
  generateExcerpt,
  suggestSEO,
  generateFeaturedImage,
  buildImagePrompt,
  generateTheme,
} from '../services/ai.js';
import { audit } from '../utils/audit.js';

const generateContentSchema = z.object({
  title: z.string().min(1),
  brief: z.string().optional(),
  tone: z.enum(['neutral', 'formal', 'casual', 'journalistic']).optional(),
  wordCount: z.coerce.number().int().min(100).max(5000).optional(),
  existingContent: z.string().optional(),
  instruction: z.string().optional(),
});

const generateImageSchema = z.object({
  prompt: z.string().min(1),
  style: z.enum(['photorealistic', 'illustrated', 'abstract', 'documentary']).optional(),
});

const aiConfigSchema = z.object({
  provider: z.enum(['openai', 'gemini', 'ollama', 'groq']),
  apiKey: z.string().optional(),   // omitted = don't change stored key
  apiUrl: z.string().optional(),
  textModel: z.string().optional(),
  imageModel: z.string().optional(),
});

const OPENAI_TEXT_MODELS   = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini', 'o4-mini', 'o3-mini'];
const OPENAI_IMAGE_MODELS  = ['gpt-image-1', 'dall-e-3'];
const GEMINI_TEXT_MODELS   = ['gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro-preview', 'gemini-3-flash-preview'];
const GEMINI_IMAGE_MODELS  = ['gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image', 'imagen-3.0-generate-002'];
const GROQ_TEXT_MODELS     = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'llama3-8b-8192', 'gemma2-9b-it', 'compound-beta'];
const OLLAMA_FALLBACK_MODELS = ['llama3.2', 'llama3.1', 'mistral', 'gemma2', 'phi4', 'qwen2.5', 'deepseek-r1', 'codellama'];

async function fetchOllamaModels(baseUrl: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return OLLAMA_FALLBACK_MODELS;
    const data = await res.json() as any;
    const names: string[] = data.models?.map((m: any) => m.name) || [];
    return names.length > 0 ? names : OLLAMA_FALLBACK_MODELS;
  } catch {
    return OLLAMA_FALLBACK_MODELS;
  }
}

const aiRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /ai/config — returns masked config
  fastify.get('/config', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const config = await getAIConfig();
    if (!config) return reply.send({ configured: false });

    return reply.send({
      configured: true,
      provider: config.provider,
      apiKeyMasked: config.apiKey ? `***${config.apiKey.slice(-4)}` : undefined,
      apiUrl: config.apiUrl,
      textModel: config.textModel,
      imageModel: config.imageModel,
    });
  });

  // GET /ai/models — available models per provider
  // Pass ?ollamaUrl=http://localhost:11434 to dynamically fetch installed Ollama models
  fastify.get('/models', { preHandler: [authenticate] }, async (req, reply) => {
    const { ollamaUrl } = req.query as { ollamaUrl?: string };

    const ollamaBase = ollamaUrl || 'http://localhost:11434';
    const ollamaModels = await fetchOllamaModels(ollamaBase);

    return reply.send({
      openai:  { text: OPENAI_TEXT_MODELS,  image: OPENAI_IMAGE_MODELS },
      gemini:  { text: GEMINI_TEXT_MODELS,  image: GEMINI_IMAGE_MODELS },
      groq:    { text: GROQ_TEXT_MODELS,    image: [] },
      ollama:  { text: ollamaModels,        image: [] },
    });
  });

  // POST /ai/config — save config (admin only)
  fastify.post('/config', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const body = aiConfigSchema.parse(req.body);
    await saveAIConfig({
      provider: body.provider,
      apiKey: body.apiKey,
      apiUrl: body.apiUrl,
      textModel: body.textModel,
      imageModel: body.imageModel,
    });
    await audit(req, 'ai.config.updated', { meta: { provider: body.provider, textModel: body.textModel } });
    return reply.send({ success: true });
  });

  // DELETE /ai/config — remove AI config
  fastify.delete('/config', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { prisma } = fastify;
    await prisma.setting.deleteMany({
      where: { key: { in: ['ai_provider', 'ai_api_key', 'ai_text_model', 'ai_image_model', 'ai_api_url'] } },
    });
    await audit(req, 'ai.config.deleted');
    return reply.send({ success: true });
  });

  // POST /ai/generate-content
  fastify.post('/generate-content', { preHandler: [authenticate] }, async (req, reply) => {
    const body = generateContentSchema.parse(req.body);
    try {
      const result = await generateContent(body);
      await audit(req, 'ai.content.generated', { meta: { title: body.title, wordCount: body.wordCount } });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(503).send({ statusCode: 503, error: 'AI Error', message: err.message || 'Content generation failed' });
    }
  });

  // POST /ai/generate-excerpt
  fastify.post('/generate-excerpt', { preHandler: [authenticate] }, async (req, reply) => {
    const { content, title } = req.body as { content: string; title: string };
    if (!content || !title) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'content and title required' });
    try {
      const excerpt = await generateExcerpt(content, title);
      return reply.send({ excerpt });
    } catch (err: any) {
      return reply.status(503).send({ statusCode: 503, error: 'AI Error', message: err.message });
    }
  });

  // POST /ai/suggest-seo
  fastify.post('/suggest-seo', { preHandler: [authenticate] }, async (req, reply) => {
    const { title, content } = req.body as { title: string; content: string };
    if (!title || !content) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'title and content required' });
    try {
      const result = await suggestSEO(title, content);
      return reply.send(result);
    } catch (err: any) {
      return reply.status(503).send({ statusCode: 503, error: 'AI Error', message: err.message });
    }
  });

  // POST /ai/build-image-prompt
  fastify.post('/build-image-prompt', { preHandler: [authenticate] }, async (req, reply) => {
    const { title, excerpt } = req.body as { title: string; excerpt?: string };
    if (!title) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'title required' });
    try {
      const prompt = await buildImagePrompt(title, excerpt);
      return reply.send({ prompt });
    } catch (err: any) {
      return reply.status(503).send({ statusCode: 503, error: 'AI Error', message: err.message });
    }
  });

  // POST /ai/generate-theme — generate CSS variable theme from a description
  fastify.post('/generate-theme', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { description } = req.body as { description?: string };
    if (!description?.trim()) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'description required' });
    try {
      const vars = await generateTheme(description);
      await audit(req, 'ai.theme.generated', { meta: { description: description.slice(0, 80) } });
      return reply.send({ vars });
    } catch (err: any) {
      return reply.status(503).send({ statusCode: 503, error: 'AI Error', message: err.message || 'Theme generation failed' });
    }
  });

  // POST /ai/generate-image
  fastify.post('/generate-image', { preHandler: [authenticate] }, async (req, reply) => {
    const body = generateImageSchema.parse(req.body);
    try {
      const result = await generateFeaturedImage(body, req.user!.id);
      await audit(req, 'ai.image.generated', { meta: { prompt: body.prompt.slice(0, 80) } });
      return reply.send(result);
    } catch (err: any) {
      return reply.status(503).send({ statusCode: 503, error: 'AI Error', message: err.message || 'Image generation failed' });
    }
  });
};

export default aiRoutes;
