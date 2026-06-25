import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { env } from './utils/env.js';
import prismaPlugin from './plugins/prisma.js';

import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import pagesRoutes from './routes/pages.js';
import issuesRoutes from './routes/issues.js';
import authorsRoutes from './routes/authors.js';
import categoriesRoutes from './routes/categories.js';
import tagsRoutes from './routes/tags.js';
import mediaRoutes from './routes/media.js';
import subscribersRoutes from './routes/subscribers.js';
import campaignsRoutes from './routes/campaigns.js';
import ingestRoutes from './routes/ingest.js';
import usersRoutes from './routes/users.js';
import aiRoutes from './routes/ai.js';
import publicRoutes from './routes/public.js';
import webhooksRoutes from './routes/webhooks.js';
import settingsRoutes from './routes/settings.js';
import stockRoutes from './routes/stock.js';
import statsRoutes from './routes/stats.js';
import migrationRoutes from './routes/migration.js';
import integrationsRoutes from './routes/integrations.js';
import formsRoutes from './routes/forms.js';
import { startScheduler } from './workers/scheduler.js';
import { startIngestWorker } from './workers/ingestWorker.js';

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'production' ? 'warn' : 'info',
    transport: env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
  },
  trustProxy: true,
  maxParamLength: 500,
});

async function main() {
  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  });

  // CORS: reflect the request's Origin header verbatim so credentials work from any origin.
  // Using origin:true (not '*') is required — browsers reject credentials with wildcard origins.
  // Safe because cookie auth uses sameSite:strict (won't be sent cross-site) and app-password
  // auth is stateless Bearer tokens.
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Rate limiting (in-memory for dev, use ioredis adapter in prod)
  await fastify.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  // Cookies
  await fastify.register(cookie, { secret: env.JWT_ACCESS_SECRET });

  // Multipart (file upload)
  await fastify.register(multipart, {
    limits: { fileSize: 500 * 1024 * 1024 },
  });

  // Database
  await fastify.register(prismaPlugin);

  // OpenAPI / Swagger
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Shacky CMS API',
        description: 'CMS API for Shacky CMS',
        version: '1.0.0',
      },
      servers: [{ url: env.API_URL }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // Routes
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(postsRoutes, { prefix: '/api/posts' });
  fastify.register(pagesRoutes, { prefix: '/api/pages' });
  fastify.register(issuesRoutes, { prefix: '/api/issues' });
  fastify.register(authorsRoutes, { prefix: '/api/authors' });
  fastify.register(categoriesRoutes, { prefix: '/api/categories' });
  fastify.register(tagsRoutes, { prefix: '/api/tags' });
  fastify.register(mediaRoutes, { prefix: '/api/media' });
  fastify.register(subscribersRoutes, { prefix: '/api/subscribers' });
  fastify.register(campaignsRoutes, { prefix: '/api/campaigns' });
  fastify.register(ingestRoutes, { prefix: '/api/ingest' });
  fastify.register(usersRoutes, { prefix: '/api/users' });
  fastify.register(aiRoutes, { prefix: '/api/ai' });
  fastify.register(publicRoutes, { prefix: '/api/public' });
  fastify.register(webhooksRoutes, { prefix: '/api/webhooks' });
  fastify.register(settingsRoutes, { prefix: '/api/settings' });
  fastify.register(stockRoutes, { prefix: '/api/stock' });
  fastify.register(statsRoutes, { prefix: '/api/stats' });
  fastify.register(migrationRoutes, { prefix: '/api/migration' });
  fastify.register(integrationsRoutes, { prefix: '/api/integrations' });
  fastify.register(formsRoutes, { prefix: '/api/forms' });

  // Global error handler
  fastify.setErrorHandler((error, req, reply) => {
    fastify.log.error(error);
    if (error.name === 'ZodError') {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Validation Error',
        message: 'Invalid request data',
        issues: (error as any).issues,
      });
    }
    if (error.statusCode) {
      return reply.status(error.statusCode).send({
        statusCode: error.statusCode,
        error: error.name,
        message: error.message,
      });
    }
    return reply.status(500).send({
      statusCode: 500,
      error: 'Internal Server Error',
      message: env.NODE_ENV === 'production' ? 'An unexpected error occurred' : error.message,
    });
  });

  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`API running at http://0.0.0.0:${env.PORT}`);
  console.log(`Docs at http://0.0.0.0:${env.PORT}/docs`);
  startScheduler();
  console.log('[scheduler] Post scheduler started (60s interval)');
  startIngestWorker();
  console.log('[ingest-worker] BullMQ enhancement worker started');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
