import type { FastifyPluginAsync } from 'fastify';
import { authenticate, requireRoles } from '../middleware/auth.js';
import { listBotsabGroups } from '../services/botsab.js';

const isSuperAdmin = requireRoles('superadmin');

const integrationsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /integrations/botsab/groups — proxy group list from configured Botsab instance
  fastify.get('/botsab/groups', { preHandler: [authenticate, isSuperAdmin] }, async (req, reply) => {
    try {
      const groups = await listBotsabGroups();
      return reply.send(groups);
    } catch (err: any) {
      return reply.status(502).send({
        statusCode: 502,
        error: 'Bad Gateway',
        message: err.message || 'Failed to reach Botsab',
      });
    }
  });
};

export default integrationsRoutes;
