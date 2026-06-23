import { prisma } from '../plugins/prisma.js';
import { fireWebhook } from '../utils/webhooks.js';

export async function publishScheduledPosts(): Promise<void> {
  const now = new Date();
  const posts = await prisma.post.findMany({
    where: { status: 'scheduled', publishedAt: { lte: now } },
    include: {
      authors: { include: { author: true } },
      categories: { include: { category: true } },
    },
  });

  if (posts.length === 0) return;

  await Promise.all(
    posts.map(async (post) => {
      await prisma.post.update({
        where: { id: post.id },
        data: { status: 'published' },
      });

      await fireWebhook('post.published', {
        id: post.id,
        title: post.title,
        slug: post.slug,
        publishedAt: post.publishedAt,
        authors: post.authors.map((a) => a.author.displayName),
        categories: post.categories.map((c) => c.category.name),
      });
    }),
  );

  console.log(`[scheduler] Published ${posts.length} scheduled post(s)`);
}

export function startScheduler(): NodeJS.Timeout {
  // Check every 60 seconds
  return setInterval(publishScheduledPosts, 60_000);
}
