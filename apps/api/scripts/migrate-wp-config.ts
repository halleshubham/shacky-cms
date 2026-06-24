/**
 * One-time migration: move hardcoded WordPress connection credentials into
 * the settings table so they are stored in the DB and never baked into source.
 *
 * Usage — set env vars then run:
 *
 *   WP_BASE_URL=https://example.com \
 *   WP_USERNAME=admin@example.com \
 *   WP_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx" \
 *   pnpm --filter api exec tsx --env-file=apps/api/.env scripts/migrate-wp-config.ts
 *
 * Idempotent — skips any key that already exists in the DB.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const baseUrl     = process.env.WP_BASE_URL;
  const username    = process.env.WP_USERNAME;
  const appPassword = process.env.WP_APP_PASSWORD;

  if (!baseUrl || !username || !appPassword) {
    console.error('Set WP_BASE_URL, WP_USERNAME, and WP_APP_PASSWORD before running this script.');
    process.exit(1);
  }

  const entries = [
    { key: 'wp_base_url',     value: baseUrl },
    { key: 'wp_username',     value: username },
    { key: 'wp_app_password', value: appPassword },
  ];

  console.log('Migrating WordPress credentials to settings table…');
  for (const s of entries) {
    const existing = await prisma.setting.findUnique({ where: { key: s.key } });
    if (existing) {
      console.log(`  SKIP  ${s.key} (already in DB)`);
    } else {
      await prisma.setting.create({ data: s });
      console.log(`  WRITE ${s.key}`);
    }
  }
  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
