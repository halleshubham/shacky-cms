import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create superadmin
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@shacky.local';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe@123!';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existing) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPass, 12),
        name: 'Super Admin',
        role: 'superadmin',
      },
    });
    console.log(`Created superadmin: ${adminEmail} / ${adminPass}`);
  } else {
    console.log(`Superadmin already exists: ${adminEmail}`);
  }

  // Create default categories
  const categoryNames = ['Politics', 'Economy', 'Society', 'Culture', 'Environment', 'Technology'];
  for (const name of categoryNames) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    await prisma.category.upsert({ where: { slug }, create: { name, slug }, update: {} });
  }
  console.log('Created default categories');

  // Create default subscriber lists
  const listNames = ['Janata Readers', 'Lokayat Members', 'Abhivyakti Subscribers'];
  for (const name of listNames) {
    await prisma.subscriberList.upsert({
      where: { name },
      create: { name, description: `Default list: ${name}` },
      update: {},
    });
  }
  console.log('Created default subscriber lists');

  // Default settings
  const defaultSettings = [
    { key: 'site_name', value: 'Shacky CMS' },
    { key: 'site_tagline', value: 'Independent. Informed. Impactful.' },
    { key: 'publish_hour', value: '1' },
    { key: 'whatsapp_channels', value: JSON.stringify(['janata', 'lokayat', 'abhivyakti']) },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      create: s,
      update: {},
    });
  }
  console.log('Created default settings');

  console.log('\nSeed complete!');
  console.log(`Admin login: ${adminEmail} / ${adminPass}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
