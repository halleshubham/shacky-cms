import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../plugins/prisma.js';
import { authenticate } from '../middleware/auth.js';

const statsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /stats — unified dashboard statistics
  fastify.get('/', { preHandler: [authenticate] }, async (_req, reply) => {
    const [
      postCounts,
      totalIssues,
      totalSubscribers,
      activeSubscribers,
      totalMedia,
      totalCampaigns,
      sentCampaigns,
      recentPosts,
      recentIssues,
      topPosts,
    ] = await Promise.all([
      prisma.post.groupBy({ by: ['status'], _count: true }),
      prisma.issue.count(),
      prisma.subscriber.count(),
      prisma.subscriber.count({ where: { status: 'active' } }),
      prisma.media.count(),
      prisma.campaign.count(),
      prisma.campaign.count({ where: { status: 'sent' } }),
      prisma.post.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, title: true, slug: true, status: true,
          createdAt: true, publishedAt: true, viewCount: true,
          authors: { include: { author: { select: { displayName: true } } } },
        },
      }),
      prisma.issue.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, title: true, volumeNumber: true, issueNumber: true, publishDate: true, type: true },
      }),
      prisma.post.findMany({
        take: 5,
        where: { status: 'published' },
        orderBy: { viewCount: 'desc' },
        select: { id: true, title: true, slug: true, viewCount: true },
      }),
    ]);

    const counts = { draft: 0, published: 0, scheduled: 0 };
    for (const row of postCounts) {
      if (row.status === 'draft') counts.draft = row._count;
      if (row.status === 'published') counts.published = row._count;
      if (row.status === 'scheduled') counts.scheduled = row._count;
    }

    return reply.send({
      posts: {
        total: counts.draft + counts.published + counts.scheduled,
        published: counts.published,
        draft: counts.draft,
        scheduled: counts.scheduled,
      },
      issues: { total: totalIssues },
      subscribers: { total: totalSubscribers, active: activeSubscribers },
      media: { total: totalMedia },
      campaigns: { total: totalCampaigns, sent: sentCampaigns },
      recentPosts: recentPosts.map((p) => ({
        ...p,
        authors: p.authors.map((a) => a.author),
      })),
      recentIssues,
      topPosts,
    });
  });
};

export default statsRoutes;
