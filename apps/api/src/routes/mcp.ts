import type { FastifyInstance } from 'fastify';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { env } from '../utils/env.js';
import { createMcpServer } from '../services/mcpServer.js';

const RESOURCE_METADATA_URL = `${env.API_URL}/.well-known/oauth-protected-resource`;

async function validateToken(fastify: FastifyInstance, authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const record = await fastify.prisma.oAuthAccessToken.findUnique({ where: { token } });
  if (!record || record.expiresAt < new Date()) return null;
  return record;
}

export default async function mcpRoutes(fastify: FastifyInstance) {
  // ── MCP HTTP endpoint (Streamable HTTP transport, stateless) ──────────────
  fastify.post('/mcp', async (request, reply) => {
    const session = await validateToken(fastify, request.headers.authorization);
    if (!session) {
      return reply
        .status(401)
        .header('WWW-Authenticate', `Bearer realm="shacky-cms", resource_metadata="${RESOURCE_METADATA_URL}"`)
        .send({ error: 'unauthorized', error_description: 'Valid OAuth2 Bearer token required' });
    }

    // Hand off to MCP transport — it writes the response directly to reply.raw
    reply.hijack();

    const server = createMcpServer(fastify.prisma, session.userId, session.scopes);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless: no session persistence
    });

    await server.connect(transport);
    try {
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } finally {
      await server.close();
    }
  });

  // ── SSE stream (GET) — not needed for stateless; return 405 ──────────────
  fastify.get('/mcp', async (_request, reply) => {
    reply
      .status(405)
      .header('WWW-Authenticate', `Bearer realm="shacky-cms", resource_metadata="${RESOURCE_METADATA_URL}"`)
      .send({ error: 'method_not_allowed', error_description: 'Use POST for MCP requests' });
  });

  // ── Session termination (DELETE) ──────────────────────────────────────────
  fastify.delete('/mcp', async (_request, reply) => {
    reply.status(200).send({});
  });
}
