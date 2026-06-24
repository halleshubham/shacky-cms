import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create superadmin
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@shacky.local';
  const adminPass = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe@123!';

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  let admin;
  if (!existing) {
    admin = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash: await bcrypt.hash(adminPass, 12),
        name: 'Super Admin',
        role: 'superadmin',
      },
    });
    console.log(`Created superadmin: ${adminEmail} / ${adminPass}`);
  } else {
    admin = existing;
    console.log(`Superadmin already exists: ${adminEmail}`);
  }

  // Create default categories
  const categoryNames = ['Politics', 'Economy', 'Society', 'Culture', 'Environment', 'Technology'];
  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const cat = await prisma.category.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });
    categories[name] = cat.id;
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

  // Create sample authors
  const authorData = [
    { displayName: 'Priya Sharma', slug: 'priya-sharma', bio: 'Senior correspondent', email: 'priya@shacky.local' },
    { displayName: 'Rahul Verma', slug: 'rahul-verma', bio: 'Political analyst', email: 'rahul@shacky.local' },
    { displayName: 'Anita Desai', slug: 'anita-desai', bio: 'Culture & Society writer', email: 'anita@shacky.local' },
  ];
  const authors: string[] = [];
  for (const a of authorData) {
    const author = await prisma.author.upsert({
      where: { slug: a.slug },
      create: a,
      update: {},
    });
    authors.push(author.id);
  }
  console.log('Created sample authors');

  // Create sample issue
  const issueExists = await prisma.issue.findFirst({
    where: { volumeNumber: 1, issueNumber: 1 },
  });

  if (!issueExists) {
    const issue = await prisma.issue.create({
      data: {
        volumeNumber: 1,
        issueNumber: 1,
        title: 'Janata Weekly — Vol. 1, No. 1',
        publishDate: new Date('2026-06-23T00:00:00Z'),
        type: 'combined',
      },
    });

    const articleData = [
      {
        number: 1,
        title: 'The State of Democracy: A Year in Review',
        excerpt: 'As we enter a new year, our political landscape faces unprecedented challenges that demand careful examination.',
        authorIdx: 0,
        categoryName: 'Politics',
      },
      {
        number: 2,
        title: 'Economic Inequality and the Road Ahead',
        excerpt: 'Widening income gaps continue to define economic discourse, with new data painting a sobering picture.',
        authorIdx: 1,
        categoryName: 'Economy',
      },
      {
        number: 3,
        title: 'Cultural Resilience in Changing Times',
        excerpt: 'Communities across the country are finding new ways to preserve and celebrate their heritage.',
        authorIdx: 2,
        categoryName: 'Culture',
      },
    ];

    for (const article of articleData) {
      const publishedAt = new Date('2026-06-23T01:00:00Z');
      publishedAt.setMinutes(articleData.length + 1 - article.number);

      const slug = article.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-');

      await prisma.post.create({
        data: {
          title: article.title,
          slug,
          content: `<p>${article.excerpt}</p><p>This is sample content for the article. The full text would appear here with rich formatting, images, and detailed analysis.</p><h2>Background</h2><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>`,
          excerpt: article.excerpt,
          status: 'published',
          publishedAt,
          issueId: issue.id,
          issueOrder: article.number,
          authors: {
            create: [{ authorId: authors[article.authorIdx], order: 0 }],
          },
          categories: {
            create: [{ categoryId: categories[article.categoryName] }],
          },
        },
      });
    }

    console.log(`Created sample issue with ${articleData.length} articles`);
  } else {
    console.log('Sample issue already exists, skipping');
  }

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
