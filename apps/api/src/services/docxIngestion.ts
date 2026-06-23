import mammoth from 'mammoth';
import JSZip from 'jszip';
import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../plugins/prisma.js';
import { uploadToS3 } from '../utils/s3.js';
import { slugify, computePublishTimestamp } from '@shacky/shared';
import type { IngestArticlePreview, IngestPreviewResult } from '@shacky/shared';

interface ParsedArticle {
  number: number;
  title: string;
  authorName: string;
  excerpt: string;
}

interface IngestOptions {
  issueId: string;
  categoryIds: string[];
  publishHour?: number;
  uploadedById: string;
}

// Parse Summary.docx — expects lines like "1. Title | Author | Excerpt"
// or "1. Title\nAuthor\nExcerpt" — flexible heuristic parser
export async function parseSummary(buffer: Buffer): Promise<ParsedArticle[]> {
  const result = await mammoth.extractRawText({ buffer: buffer as any });
  const lines = result.value.split('\n').map((l) => l.trim()).filter(Boolean);
  const articles: ParsedArticle[] = [];
  const articleLineRegex = /^(\d+)\.\s+(.+)/;

  let i = 0;
  while (i < lines.length) {
    const match = lines[i].match(articleLineRegex);
    if (match) {
      const number = parseInt(match[1]);
      const rest = match[2];
      // Try pipe-delimited: "Title | Author | Excerpt"
      const parts = rest.split('|').map((s) => s.trim());
      if (parts.length >= 3) {
        articles.push({ number, title: parts[0], authorName: parts[1], excerpt: parts[2] });
      } else if (parts.length === 2) {
        articles.push({ number, title: parts[0], authorName: parts[1], excerpt: '' });
      } else {
        // Multi-line format: next line = author, line after = excerpt
        const title = rest;
        const authorName = lines[i + 1] || '';
        const excerpt = lines[i + 2] || '';
        // Skip if next lines look like article headers too
        if (!authorName.match(articleLineRegex)) {
          articles.push({ number, title, authorName, excerpt });
          i += 3;
          continue;
        }
        articles.push({ number, title, authorName: '', excerpt: '' });
      }
    }
    i++;
  }

  return articles.sort((a, b) => a.number - b.number);
}

// Convert .docx to HTML preserving formatting
export async function docxToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer }, {
    styleMap: [
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Heading 4'] => h4:fresh",
    ],
    convertImage: mammoth.images.imgElement(async (image) => {
      const imgBuffer = Buffer.from(await image.read());
      const id = createId();
      // Convert to JPEG
      const jpeg = await sharp(imgBuffer).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
      const filename = `${id}.jpg`;
      const url = await uploadToS3(`media/inline/${filename}`, jpeg.data, 'image/jpeg');
      return { src: url };
    }),
  });
  return result.value;
}

// Resolve or create author by name
async function resolveAuthor(name: string): Promise<string> {
  const slug = slugify(name);
  let author = await prisma.author.findUnique({ where: { slug } });
  if (!author) {
    author = await prisma.author.create({ data: { displayName: name, slug } });
  }
  return author.id;
}

// Process one numbered article image
async function processArticleImage(buffer: Buffer, articleNumber: number): Promise<string | null> {
  try {
    let img = sharp(buffer).rotate();
    const meta = await img.metadata();
    if ((meta.width || 0) > 1920) img = img.resize(1920, undefined, { withoutEnlargement: true });

    let jpeg = await img.jpeg({ quality: 85 }).toBuffer();
    if (jpeg.length > 800 * 1024) {
      jpeg = await sharp(buffer).rotate().resize(1920, undefined, { withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
    }

    const filename = `${createId()}.jpg`;
    const url = await uploadToS3(`media/${filename}`, jpeg, 'image/jpeg');

    // Save to media table — we'll link it as featured image
    const jpeqMeta = await sharp(jpeg).metadata();
    await prisma.media.create({
      data: {
        filename,
        originalName: `article-${articleNumber}.jpg`,
        mimeType: 'image/jpeg',
        size: jpeg.length,
        width: jpeqMeta.width,
        height: jpeqMeta.height,
        url,
        uploadedById: 'system',
      },
    });

    return url;
  } catch {
    return null;
  }
}

export async function previewIngestion(zipBuffer: Buffer): Promise<IngestPreviewResult> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const warnings: string[] = [];

  // Find Summary.docx
  const summaryFile = Object.keys(zip.files).find((f) =>
    f.toLowerCase().includes('summary') && f.endsWith('.docx'),
  );

  if (!summaryFile) {
    return { articles: [], totalArticles: 0, warnings: ['Summary.docx not found in ZIP'] };
  }

  const summaryBuffer = Buffer.from(await zip.files[summaryFile].async('arraybuffer'));
  const parsed = await parseSummary(summaryBuffer);

  // Count docx files
  const docxFiles = Object.keys(zip.files).filter((f) => {
    const name = f.split('/').pop() || '';
    return name.match(/^\d+\.docx$/) && !name.toLowerCase().includes('summary');
  });

  if (docxFiles.length !== parsed.length) {
    warnings.push(`Summary lists ${parsed.length} articles but found ${docxFiles.length} .docx files`);
  }

  return {
    articles: parsed.map((a) => ({
      number: a.number,
      title: a.title,
      authorName: a.authorName,
      excerpt: a.excerpt,
      wordCount: 0,
    })),
    totalArticles: parsed.length,
    warnings,
  };
}

export async function ingestIssue(zipBuffer: Buffer, options: IngestOptions): Promise<{
  created: number;
  warnings: string[];
}> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const warnings: string[] = [];

  const issue = await prisma.issue.findUnique({ where: { id: options.issueId } });
  if (!issue) throw new Error('Issue not found');

  // Parse summary
  const summaryFile = Object.keys(zip.files).find((f) =>
    f.toLowerCase().includes('summary') && f.endsWith('.docx'),
  );
  if (!summaryFile) throw new Error('Summary.docx not found');

  const summaryBuffer = Buffer.from(await zip.files[summaryFile].async('arraybuffer'));
  const summaryArticles = await parseSummary(summaryBuffer);
  const total = summaryArticles.length;

  let created = 0;

  for (const summary of summaryArticles) {
    try {
      // Find matching .docx
      const docxKey = Object.keys(zip.files).find((f) => {
        const name = f.split('/').pop() || '';
        return name === `${summary.number}.docx`;
      });

      let htmlContent = '';
      if (docxKey) {
        const docxBuffer = Buffer.from(await zip.files[docxKey].async('arraybuffer'));
        htmlContent = await docxToHtml(docxBuffer);
      } else {
        warnings.push(`No .docx found for article ${summary.number}`);
      }

      // Process featured image
      let featuredMediaId: string | null = null;
      const imgExts = ['jpg', 'jpeg', 'png', 'webp'];
      for (const ext of imgExts) {
        const imgKey = Object.keys(zip.files).find((f) => {
          const name = f.split('/').pop() || '';
          return name.match(new RegExp(`^${summary.number}\\.(${imgExts.join('|')})$`, 'i'));
        });
        if (imgKey) {
          const imgBuffer = Buffer.from(await zip.files[imgKey].async('arraybuffer'));
          const url = await processArticleImage(imgBuffer, summary.number);
          if (url) {
            const media = await prisma.media.findFirst({ where: { url } });
            if (media) featuredMediaId = media.id;
          }
          break;
        }
      }

      // Resolve/create author
      const authorId = summary.authorName ? await resolveAuthor(summary.authorName) : null;

      // Compute publish timestamp
      const publishedAt = computePublishTimestamp(issue.publishDate, summary.number, total, options.publishHour || 1);

      // Create slug
      const baseSlug = slugify(summary.title);
      let slug = baseSlug;
      let attempt = 0;
      while (await prisma.post.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${++attempt}`;
      }

      const post = await prisma.post.create({
        data: {
          title: summary.title,
          slug,
          content: htmlContent,
          excerpt: summary.excerpt || null,
          status: 'draft',
          publishedAt,
          featuredMediaId,
          issueId: options.issueId,
          issueOrder: summary.number,
          authors: authorId ? { create: [{ authorId, order: 0 }] } : undefined,
          categories: options.categoryIds.length > 0 ? {
            create: options.categoryIds.slice(0, 3).map((categoryId) => ({ categoryId })),
          } : undefined,
        },
      });

      created++;
    } catch (err) {
      warnings.push(`Failed to process article ${summary.number}: ${(err as Error).message}`);
    }
  }

  return { created, warnings };
}
