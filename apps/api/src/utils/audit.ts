import type { FastifyRequest } from 'fastify';
import { prisma } from '../plugins/prisma.js';

export async function audit(
  req: FastifyRequest,
  action: string,
  opts?: { entity?: string; entityId?: string; meta?: Record<string, unknown> },
): Promise<void> {
  const userId = (req as any).user?.id as string | undefined;
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      entity: opts?.entity,
      entityId: opts?.entityId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      meta: opts?.meta as any,
    },
  });
}
