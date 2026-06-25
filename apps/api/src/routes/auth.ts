import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { prisma } from '../plugins/prisma.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { hashPassword, verifyPassword, generateApplicationSecret, buildApplicationToken } from '../utils/password.js';
import { authenticate, requireSuperAdmin } from '../middleware/auth.js';
import { audit } from '../utils/audit.js';
import { env } from '../utils/env.js';
import { sendMail } from '../services/email.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1),
  role: z.enum(['superadmin', 'editor', 'author', 'subscriber_manager']).optional(),
});

const authRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /auth/login
  fastify.post('/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      await audit(req, 'auth.login.failed', { meta: { email: body.email } });
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid credentials' });
    }

    if (user.totpEnabled) {
      if (!body.totpCode) {
        return reply.status(200).send({ requireTotp: true });
      }
      const valid = authenticator.verify({ token: body.totpCode, secret: user.totpSecret! });
      if (!valid) {
        await audit(req, 'auth.login.totp_failed', { meta: { email: body.email } });
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid TOTP code' });
      }
    }

    const accessToken = await signAccessToken({ sub: user.id, email: user.email, role: user.role as any });
    const refreshToken = await signRefreshToken({ sub: user.id, email: user.email, role: user.role as any });

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: await bcrypt.hash(refreshToken, 8),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await audit(req, 'auth.login.success', { meta: { email: body.email } });

    reply
      .setCookie('access_token', accessToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60,
        path: '/',
      })
      .setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60,
        path: '/api/auth/refresh',
      });

    return reply.send({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, totpEnabled: user.totpEnabled },
      accessToken,
    });
  });

  // POST /auth/refresh
  fastify.post('/refresh', async (req, reply) => {
    const cookieToken = req.cookies?.['refresh_token'];
    const headerToken = (req.body as any)?.refreshToken;
    const token = cookieToken || headerToken;

    if (!token) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'No refresh token' });
    }

    try {
      const payload = await verifyRefreshToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user) throw new Error('User not found');

      const accessToken = await signAccessToken({ sub: user.id, email: user.email, role: user.role as any });
      const newRefreshToken = await signRefreshToken({ sub: user.id, email: user.email, role: user.role as any });

      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: await bcrypt.hash(newRefreshToken, 8),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      reply
        .setCookie('access_token', accessToken, {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 8 * 60 * 60,
          path: '/',
        })
        .setCookie('refresh_token', newRefreshToken, {
          httpOnly: true,
          secure: env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 30 * 24 * 60 * 60,
          path: '/api/auth/refresh',
        });

      return reply.send({ accessToken });
    } catch {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid refresh token' });
    }
  });

  // POST /auth/logout
  fastify.post('/logout', { preHandler: [authenticate] }, async (req, reply) => {
    await audit(req, 'auth.logout');
    reply
      .clearCookie('access_token', { path: '/' })
      .clearCookie('refresh_token', { path: '/api/auth/refresh' });
    return reply.send({ success: true });
  });

  // POST /auth/register (superadmin only after first user)
  fastify.post('/register', { preHandler: [authenticate, requireSuperAdmin] }, async (req, reply) => {
    const body = registerSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: body.email } });
    if (existing) {
      return reply.status(409).send({ statusCode: 409, error: 'Conflict', message: 'Email already in use' });
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        passwordHash: await hashPassword(body.password),
        name: body.name,
        role: body.role || 'author',
      },
    });

    await audit(req, 'user.created', { entity: 'user', entityId: user.id });

    const siteName = await prisma.setting.findUnique({ where: { key: 'site_title' } })
      .then((r) => r?.value || 'Shacky CMS');

    sendMail({
      to: user.email,
      subject: `Your ${siteName} account has been created`,
      html: `
        <p>Hi ${user.name},</p>
        <p>A <strong>${siteName}</strong> account has been created for you by an administrator.</p>
        <table>
          <tr><td><strong>Email:</strong></td><td>${user.email}</td></tr>
          <tr><td><strong>Password:</strong></td><td>${body.password}</td></tr>
          <tr><td><strong>Role:</strong></td><td>${user.role}</td></tr>
        </table>
        <p><a href="${env.APP_URL}/login">Log in now</a> and change your password after your first sign-in.</p>
      `,
      text: `Hi ${user.name},\n\nA ${siteName} account has been created for you.\n\nEmail: ${user.email}\nPassword: ${body.password}\nRole: ${user.role}\n\nLogin: ${env.APP_URL}/login\n\nPlease change your password after your first sign-in.`,
    }).catch((err) => fastify.log.warn({ err }, 'Failed to send welcome email'));

    return reply.status(201).send({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
  });

  // GET /auth/me
  fastify.get('/me', { preHandler: [authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, email: true, name: true, role: true, totpEnabled: true, createdAt: true },
    });
    return reply.send(user);
  });

  // PATCH /auth/me — update own profile or password
  fastify.patch('/me', { preHandler: [authenticate] }, async (req, reply) => {
    const body = z.object({
      name: z.string().min(1).optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().min(12).optional(),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });

    const data: any = {};
    if (body.name) data.name = body.name;

    if (body.newPassword) {
      if (!body.currentPassword) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'currentPassword required to set a new password' });
      }
      const valid = await verifyPassword(body.currentPassword, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Current password is incorrect' });
      }
      data.passwordHash = await hashPassword(body.newPassword);
    }

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Nothing to update' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: { id: true, email: true, name: true, role: true, totpEnabled: true, createdAt: true },
    });
    await audit(req, 'user.self_updated', { entity: 'user', entityId: user.id });
    return reply.send(updated);
  });

  // POST /auth/totp/setup
  fastify.post('/totp/setup', { preHandler: [authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'User not found' });

    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'Shacky CMS', secret);
    const qrCode = await QRCode.toDataURL(otpauth);

    await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });

    return reply.send({ secret, qrCode, otpauth });
  });

  // POST /auth/totp/verify
  fastify.post('/totp/verify', { preHandler: [authenticate] }, async (req, reply) => {
    const { code } = req.body as { code: string };
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user?.totpSecret) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'TOTP not set up' });
    }

    const valid = authenticator.verify({ token: code, secret: user.totpSecret });
    if (!valid) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid code' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
    await audit(req, 'auth.totp.enabled', { entity: 'user', entityId: user.id });
    return reply.send({ success: true });
  });

  // POST /auth/totp/disable
  fastify.post('/totp/disable', { preHandler: [authenticate, requireSuperAdmin] }, async (req, reply) => {
    const { userId } = req.body as { userId: string };
    await prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null },
    });
    await audit(req, 'auth.totp.disabled', { entity: 'user', entityId: userId });
    return reply.send({ success: true });
  });

  // GET /auth/application-passwords
  fastify.get('/application-passwords', { preHandler: [authenticate] }, async (req, reply) => {
    const passwords = await prisma.applicationPassword.findMany({
      where: { userId: req.user!.id },
      select: { id: true, name: true, lastUsed: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(passwords);
  });

  // POST /auth/application-passwords
  fastify.post('/application-passwords', { preHandler: [authenticate] }, async (req, reply) => {
    const { name } = req.body as { name: string };
    if (!name?.trim()) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Name required' });
    }

    const { secret, hash } = generateApplicationSecret();
    const tokenHash = await hash;
    const ap = await prisma.applicationPassword.create({
      data: { userId: req.user!.id, name: name.trim(), tokenHash },
    });
    const token = buildApplicationToken(ap.id, secret);

    await audit(req, 'auth.app_password.created', { entity: 'application_password', entityId: ap.id });
    return reply.status(201).send({ id: ap.id, name: ap.name, token, createdAt: ap.createdAt });
  });

  // DELETE /auth/application-passwords/:id
  fastify.delete('/application-passwords/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const ap = await prisma.applicationPassword.findFirst({
      where: { id, userId: req.user!.id },
    });
    if (!ap) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Not found' });

    await prisma.applicationPassword.delete({ where: { id } });
    await audit(req, 'auth.app_password.deleted', { entity: 'application_password', entityId: id });
    return reply.send({ success: true });
  });
};

export default authRoutes;
