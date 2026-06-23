import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Role } from '@shacky/shared';
import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../plugins/prisma.js';
import { parseApplicationToken } from '../utils/password.js';
import bcrypt from 'bcryptjs';

declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: string;
      email: string;
      role: Role;
      name: string;
    };
  }
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);

      // Try JWT first
      try {
        const payload = await verifyAccessToken(token);
        const user = await prisma.user.findUnique({ where: { id: payload.sub } });
        if (!user) {
          reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'User not found' });
          return;
        }
        req.user = { id: user.id, email: user.email, role: user.role as Role, name: user.name };
        return;
      } catch {
        // Not a JWT — try application password (O(1): ID embedded in token)
        const parsed = parseApplicationToken(token);
        if (parsed) {
          const ap = await prisma.applicationPassword.findUnique({
            where: { id: parsed.recordId },
            include: { user: true },
          });
          if (ap && await bcrypt.compare(parsed.secret, ap.tokenHash)) {
            await prisma.applicationPassword.update({
              where: { id: ap.id },
              data: { lastUsed: new Date() },
            });
            req.user = {
              id: ap.user.id,
              email: ap.user.email,
              role: ap.user.role as Role,
              name: ap.user.name,
            };
            return;
          }
        }
      }
    }

    // Try cookie-based access token
    const cookieToken = req.cookies?.['access_token'];
    if (cookieToken) {
      const payload = await verifyAccessToken(cookieToken);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (user) {
        req.user = { id: user.id, email: user.email, role: user.role as Role, name: user.name };
        return;
      }
    }

    reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' });
  } catch {
    reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid token' });
  }
}

export function requireRoles(...roles: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!req.user) {
      reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      reply.status(403).send({ statusCode: 403, error: 'Forbidden', message: 'Insufficient permissions' });
    }
  };
}

export const requireAdmin = requireRoles('superadmin', 'editor');
export const requireSuperAdmin = requireRoles('superadmin');
