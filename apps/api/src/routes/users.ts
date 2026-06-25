import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { hashPassword } from '../utils/password.js';
import { audit } from '../utils/audit.js';
import { sendMail } from '../services/email.js';
import { env } from '../utils/env.js';

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['superadmin', 'editor', 'author', 'subscriber_manager']).optional(),
  password: z.string().min(12).optional(),
});

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /users
  fastify.get('/', { preHandler: [authenticate, requireSuperAdmin] }, async (req, reply) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, totpEnabled: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(users);
  });

  // PATCH /users/:id
  fastify.patch('/:id', { preHandler: [authenticate, requireSuperAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = updateUserSchema.parse(req.body);
    const data: any = {};
    if (body.name) data.name = body.name;
    if (body.role) data.role = body.role;
    if (body.password) data.passwordHash = await hashPassword(body.password);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, totpEnabled: true, createdAt: true },
    });
    await audit(req, 'user.updated', { entity: 'user', entityId: id });

    if (body.password) {
      const siteName = await prisma.setting.findUnique({ where: { key: 'site_title' } })
        .then((r) => r?.value || 'Shacky CMS');

      sendMail({
        to: user.email,
        subject: `Your ${siteName} password has been reset`,
        html: `
          <p>Hi ${user.name},</p>
          <p>An administrator has reset your <strong>${siteName}</strong> password.</p>
          <p><strong>New password:</strong> ${body.password}</p>
          <p><a href="${env.APP_URL}/login">Log in now</a> and change your password from your profile settings.</p>
          <p>If you did not expect this change, please contact your administrator.</p>
        `,
        text: `Hi ${user.name},\n\nAn administrator has reset your ${siteName} password.\n\nNew password: ${body.password}\n\nLogin: ${env.APP_URL}/login\n\nIf you did not expect this change, please contact your administrator.`,
      }).catch((err) => fastify.log.warn({ err }, 'Failed to send password-reset notification'));
    }

    return reply.send(user);
  });

  // DELETE /users/:id
  fastify.delete('/:id', { preHandler: [authenticate, requireSuperAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (id === req.user!.id) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Cannot delete yourself' });
    }
    await prisma.user.delete({ where: { id } });
    await audit(req, 'user.deleted', { entity: 'user', entityId: id });
    return reply.send({ success: true });
  });

  // GET /users/audit-log
  fastify.get('/audit-log', { preHandler: [authenticate, requireSuperAdmin] }, async (req, reply) => {
    const { page = 1, pageSize = 50 } = req.query as any;
    const skip = (page - 1) * pageSize;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: Number(pageSize),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.auditLog.count(),
    ]);
    return reply.send({ data: logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
  });
};

export default usersRoutes;
