/**
 * Applies the "samvidhan" theme + sample content (settings, homepage blocks, posters
 * and contact pages) to the database. Idempotent — safe to re-run.
 *
 *   pnpm --filter api exec tsx --env-file=.env scripts/seed-samvidhan-demo.ts
 *
 * This only touches site settings and the two pages below; it never deletes anything.
 */
import { PrismaClient } from '@prisma/client';
import { SETTINGS, HOMEPAGE_SECTIONS, POSTERS_PAGE, CONTACT_PAGE } from './samvidhan-content.js';

const prisma = new PrismaClient();

async function upsertSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

async function upsertPage(p: { title: string; slug: string; excerpt: string; sections: unknown[] }) {
  const data = {
    title: p.title,
    excerpt: p.excerpt,
    content: '',
    sectionsJson: JSON.stringify(p.sections),
    status: 'published' as const,
    publishedAt: new Date(),
  };
  await prisma.page.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: data });
}

async function main() {
  for (const [k, v] of Object.entries(SETTINGS)) await upsertSetting(k, v);
  await upsertSetting('homepage_sections', JSON.stringify(HOMEPAGE_SECTIONS));
  await upsertPage(POSTERS_PAGE);
  await upsertPage(CONTACT_PAGE);
  console.log(`Applied theme "samvidhan": ${Object.keys(SETTINGS).length + 1} settings, 2 pages.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
