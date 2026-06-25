import { prisma } from '../plugins/prisma.js';
import { fireWebhook } from '../utils/webhooks.js';
import { sendMail } from '../services/email.js';
import { digestEmailHtml } from '../routes/forms.js';
import type { FormField } from '../routes/forms.js';

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

function isSendDay(digest: string, now: Date, lastSent: Date | null): boolean {
  if (!lastSent) return true;
  const diffMs = now.getTime() - lastSent.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (digest === 'daily') return diffHours >= 23; // allow a little slack
  if (digest === 'weekly') return diffHours >= 23 * 7;
  if (digest === 'monthly') {
    return now.getMonth() !== lastSent.getMonth() || now.getFullYear() !== lastSent.getFullYear();
  }
  return false;
}

export async function sendFormDigests(): Promise<void> {
  const now = new Date();
  const forms = await prisma.form.findMany({
    where: {
      notifyEmail: { not: null },
      notifyDigest: { in: ['daily', 'weekly', 'monthly'] },
      isActive: true,
    },
  });

  for (const form of forms) {
    if (!form.notifyDigest || !form.notifyEmail) continue;
    if (!isSendDay(form.notifyDigest, now, form.lastDigestSentAt)) continue;

    const since = form.lastDigestSentAt ?? new Date(0);
    const entries = await prisma.formEntry.findMany({
      where: { formId: form.id, createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
    });

    if (entries.length === 0) continue;

    const fields = (form.fields as unknown as FormField[]) ?? [];
    const html = digestEmailHtml(form.name, fields, entries.map((e) => ({ data: e.data, createdAt: e.createdAt })));
    if (!html) continue;

    try {
      await sendMail({
        to: form.notifyEmail.split(',').map((e) => e.trim()).filter(Boolean),
        subject: `[${form.notifyDigest} digest] ${entries.length} new entr${entries.length === 1 ? 'y' : 'ies'} — ${form.name}`,
        html,
      });
      await prisma.form.update({ where: { id: form.id }, data: { lastDigestSentAt: now } });
    } catch (err) {
      console.error(`[scheduler] Failed to send ${form.notifyDigest} digest for form ${form.slug}:`, err);
    }
  }
}

export function startScheduler(): NodeJS.Timeout {
  let digestTick = 0;
  return setInterval(async () => {
    await publishScheduledPosts().catch((err) => console.error('[scheduler] post publish error:', err));
    // Run digest check every 10 minutes (every 10th 60-second tick)
    digestTick++;
    if (digestTick >= 10) {
      digestTick = 0;
      await sendFormDigests().catch((err) => console.error('[scheduler] digest error:', err));
    }
  }, 60_000);
}
