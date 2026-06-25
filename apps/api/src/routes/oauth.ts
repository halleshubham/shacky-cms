import type { FastifyInstance } from 'fastify';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../utils/env.js';
import { authenticate } from '../middleware/auth.js';

const SCOPES_SUPPORTED = ['posts:read', 'posts:write', 'media:read', 'subscribers:read'];
const TOKEN_TTL_SECONDS = 3600; // 1 hour

function genSecret(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

function verifyPkce(verifier: string, challenge: string, method: string): boolean {
  if (method === 'S256') {
    return createHash('sha256').update(verifier).digest().toString('base64url') === challenge;
  }
  if (method === 'plain') return verifier === challenge;
  return false;
}

export default async function oauthRoutes(fastify: FastifyInstance) {
  // ── Discovery ─────────────────────────────────────────────────────────────

  // All public-facing URLs use APP_URL (the Next.js public domain).
  // API_URL may be an internal address only reachable within the container network.
  fastify.get('/.well-known/oauth-authorization-server', async (_req, reply) => {
    reply.send({
      issuer: env.APP_URL,
      authorization_endpoint: `${env.APP_URL}/oauth/authorize`,
      token_endpoint: `${env.APP_URL}/oauth/token`,
      registration_endpoint: `${env.APP_URL}/oauth/register`,
      revocation_endpoint: `${env.APP_URL}/oauth/revoke`,
      scopes_supported: SCOPES_SUPPORTED,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      token_endpoint_auth_methods_supported: ['none', 'client_secret_post'],
      code_challenge_methods_supported: ['S256', 'plain'],
    });
  });

  fastify.get('/.well-known/oauth-protected-resource', async (_req, reply) => {
    reply.send({
      resource: `${env.APP_URL}/mcp`,
      authorization_servers: [env.APP_URL],
      scopes_supported: SCOPES_SUPPORTED,
      bearer_methods_supported: ['header'],
    });
  });

  // ── Dynamic Client Registration (RFC 7591) ────────────────────────────────

  fastify.post('/oauth/register', async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    const name = String(body.client_name || 'OAuth Client');
    const redirectUris: string[] = Array.isArray(body.redirect_uris)
      ? (body.redirect_uris as string[]).filter((u) => typeof u === 'string')
      : [];
    const grantTypes: string[] = Array.isArray(body.grant_types)
      ? (body.grant_types as string[]).filter((g) => g === 'authorization_code')
      : ['authorization_code'];
    const requestedScopes = typeof body.scope === 'string' ? body.scope.split(' ') : SCOPES_SUPPORTED;
    const scopes = requestedScopes.filter((s) => SCOPES_SUPPORTED.includes(s));
    const tokenMethod = String(body.token_endpoint_auth_method || 'none');

    if (redirectUris.length === 0) {
      return reply.status(400).send({ error: 'invalid_client_metadata', error_description: 'redirect_uris is required' });
    }

    const clientId = genSecret(16);
    const clientSecret = tokenMethod !== 'none' ? genSecret(32) : null;

    const client = await fastify.prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret,
        name,
        redirectUris,
        scopes,
        grantTypes,
        tokenEndpointAuthMethod: tokenMethod,
      },
    });

    reply.status(201).send({
      client_id: client.clientId,
      client_secret: clientSecret ?? undefined,
      client_name: name,
      redirect_uris: redirectUris,
      grant_types: grantTypes,
      response_types: ['code'],
      scope: scopes.join(' '),
      token_endpoint_auth_method: tokenMethod,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
    });
  });

  // ── Authorization endpoint — redirect to web consent UI ──────────────────
  // Claude.ai will send the user here; we bounce to the Next.js page.
  fastify.get('/oauth/authorize', async (request, reply) => {
    const q = request.query as Record<string, string>;
    const params = new URLSearchParams();
    for (const key of ['client_id', 'redirect_uri', 'response_type', 'scope', 'state', 'code_challenge', 'code_challenge_method']) {
      if (q[key]) params.set(key, q[key]);
    }
    reply.redirect(`${env.APP_URL}/oauth/authorize?${params}`);
  });

  // ── Consent approval — called by the web UI after user approves ───────────
  // Requires the user to be logged in via the normal CMS cookie.
  fastify.post('/api/oauth/approve', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user as { id: string };
    const body = request.body as Record<string, unknown>;

    const clientId = String(body.client_id || '');
    const redirectUri = String(body.redirect_uri || '');
    const scope = String(body.scope || '');
    const state = body.state ? String(body.state) : undefined;
    const codeChallenge = body.code_challenge ? String(body.code_challenge) : undefined;
    const codeChallengeMethod = body.code_challenge_method ? String(body.code_challenge_method) : undefined;

    const client = await fastify.prisma.oAuthClient.findUnique({ where: { clientId } });
    if (!client) return reply.status(400).send({ error: 'invalid_client' });
    if (!client.redirectUris.includes(redirectUri)) {
      return reply.status(400).send({ error: 'invalid_redirect_uri' });
    }

    const grantedScopes = scope
      .split(' ')
      .filter((s) => s && SCOPES_SUPPORTED.includes(s) && client.scopes.includes(s));

    const code = genSecret(24);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    await fastify.prisma.oAuthAuthCode.create({
      data: {
        code,
        clientId: client.id,
        userId: user.id,
        scopes: grantedScopes,
        redirectUri,
        codeChallenge,
        codeChallengeMethod,
        expiresAt,
      },
    });

    reply.send({ code, redirect_uri: redirectUri, state });
  });

  // ── Token endpoint ────────────────────────────────────────────────────────
  fastify.post('/oauth/token', async (request, reply) => {
    const body = request.body as Record<string, unknown>;

    if (body.grant_type !== 'authorization_code') {
      return reply.status(400).send({ error: 'unsupported_grant_type' });
    }

    const code = String(body.code || '');
    const redirectUri = String(body.redirect_uri || '');
    const clientId = String(body.client_id || '');
    const codeVerifier = body.code_verifier ? String(body.code_verifier) : undefined;

    const authCode = await fastify.prisma.oAuthAuthCode.findUnique({
      where: { code },
      include: { client: true },
    });

    if (!authCode || authCode.client.clientId !== clientId) {
      return reply.status(400).send({ error: 'invalid_grant' });
    }
    if (authCode.redirectUri !== redirectUri) {
      return reply.status(400).send({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    }
    if (authCode.expiresAt < new Date()) {
      await fastify.prisma.oAuthAuthCode.delete({ where: { id: authCode.id } });
      return reply.status(400).send({ error: 'invalid_grant', error_description: 'code expired' });
    }

    // PKCE verification
    if (authCode.codeChallenge) {
      if (!codeVerifier) return reply.status(400).send({ error: 'invalid_grant', error_description: 'code_verifier required' });
      const method = authCode.codeChallengeMethod || 'S256';
      if (!verifyPkce(codeVerifier, authCode.codeChallenge, method)) {
        return reply.status(400).send({ error: 'invalid_grant', error_description: 'code_verifier mismatch' });
      }
    }

    // Client secret verification (if client uses secret auth)
    if (authCode.client.clientSecret) {
      const providedSecret = String(body.client_secret || '');
      if (providedSecret !== authCode.client.clientSecret) {
        return reply.status(401).send({ error: 'invalid_client' });
      }
    }

    // Consume the code (one-time use)
    await fastify.prisma.oAuthAuthCode.delete({ where: { id: authCode.id } });

    // Issue access token
    const token = genSecret(32);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);

    await fastify.prisma.oAuthAccessToken.create({
      data: {
        token,
        clientId: authCode.client.id,
        userId: authCode.userId,
        scopes: authCode.scopes,
        expiresAt,
      },
    });

    reply.send({
      access_token: token,
      token_type: 'Bearer',
      expires_in: TOKEN_TTL_SECONDS,
      scope: authCode.scopes.join(' '),
    });
  });

  // ── Revocation endpoint ───────────────────────────────────────────────────
  fastify.post('/oauth/revoke', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const token = String(body.token || '');
    await fastify.prisma.oAuthAccessToken.deleteMany({ where: { token } });
    reply.send({});
  });

  // ── MCP info (public — lets the web UI show the correct MCP server URL) ──
  fastify.get('/api/oauth/mcp-info', async (_req, reply) => {
    reply.send({ apiUrl: env.API_URL, mcpUrl: `${env.API_URL}/mcp` });
  });

  // ── Public client info (used by the consent page) ─────────────────────────
  fastify.get('/api/oauth/clients/:clientId', async (request, reply) => {
    const { clientId } = request.params as { clientId: string };
    const client = await fastify.prisma.oAuthClient.findUnique({
      where: { clientId },
      select: { name: true, scopes: true, redirectUris: true },
    });
    if (!client) return reply.status(404).send({ error: 'client_not_found' });
    reply.send({ name: client.name, scopes: client.scopes });
  });

  // ── List current user's active OAuth tokens ───────────────────────────────
  fastify.get('/api/oauth/tokens', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user as { id: string };
    const tokens = await fastify.prisma.oAuthAccessToken.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      include: { client: { select: { name: true, clientId: true } } },
      orderBy: { createdAt: 'desc' },
    });
    reply.send(
      tokens.map((t) => ({
        id: t.id,
        clientName: t.client.name,
        scopes: t.scopes,
        createdAt: t.createdAt,
        expiresAt: t.expiresAt,
      })),
    );
  });

  // ── Revoke a specific token by DB id ──────────────────────────────────────
  fastify.delete('/api/oauth/tokens/:id', { preHandler: [authenticate] }, async (request, reply) => {
    const user = (request as any).user as { id: string };
    const { id } = request.params as { id: string };
    const deleted = await fastify.prisma.oAuthAccessToken.deleteMany({
      where: { id, userId: user.id },
    });
    if (deleted.count === 0) return reply.status(404).send({ error: 'not_found' });
    reply.send({ success: true });
  });
}
