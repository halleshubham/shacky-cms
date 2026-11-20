import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { hashPassword } from '../utils/password.js';
import { audit } from '../utils/audit.js';
import { sendMail } from '../services/email.js';
import { env } from '../utils/env.js';
import { createPasswordResetToken } from '../utils/passwordReset.js';

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

    if (body.role && body.role !== 'superadmin') {
      const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (!target) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
      if (target.role === 'superadmin') {
        const superadminCount = await prisma.user.count({ where: { role: 'superadmin' } });
        if (superadminCount <= 1) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Cannot change the role of the last superadmin — promote another user first',
          });
        }
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true, totpEnabled: true, createdAt: true },
    });
    await audit(req, 'user.updated', { entity: 'user', entityId: id });

    if (body.password) {
      const siteName = await prisma.setting.findUnique({ where: { key: 'site_title' } })
        .then((r) => r?.value || 'Shacky CMS');

      // Send a one-time set-your-own-password link instead of the password
      // an admin typed into this request — email isn't a secure transport,
      // and a plaintext password sits in that inbox indefinitely. The admin's
      // own value still takes effect immediately above; this just lets the
      // user replace it with one of their own choosing right away.
      const resetToken = await createPasswordResetToken(user.id);
      const resetUrl = `${env.APP_URL}/set-password?token=${resetToken}`;

      sendMail({
        to: user.email,
        subject: `Your ${siteName} password has been reset`,
        html: `
          <p>Hi ${user.name},</p>
          <p>An administrator has reset your <strong>${siteName}</strong> password.</p>
          <p><a href="${resetUrl}">Choose a new password</a> now (link expires in 48 hours).</p>
          <p>If you did not expect this change, please contact your administrator.</p>
        `,
        text: `Hi ${user.name},\n\nAn administrator has reset your ${siteName} password.\n\nChoose a new password now (link expires in 48 hours):\n${resetUrl}\n\nIf you did not expect this change, please contact your administrator.`,
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
    const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
    if (!target) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });
    if (target.role === 'superadmin') {
      const superadminCount = await prisma.user.count({ where: { role: 'superadmin' } });
      if (superadminCount <= 1) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cannot delete the last superadmin — promote another user first',
        });
      }
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
