import mammoth from 'mammoth';
import JSZip from 'jszip';
import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../plugins/prisma.js';
import { uploadToS3 } from '../utils/s3.js';
import { slugify, computePublishTimestamp } from '@shacky/shared';
import type { IngestArticlePreview, IngestPreviewResult } from '@shacky/shared';
import { getAIConfig, classifyCategories, generateArticleTags, buildImagePrompt, generateFeaturedImage } from './ai.js';

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
  aiOptions?: {
    generateImage?: boolean;
    mapCategories?: boolean;
    generateTags?: boolean;
  };
}

// Normalise an author line: strip leading "by " and clean up semicolons → commas
function normaliseAuthor(raw: string): string {
  return raw.replace(/^by\s+/i, '').replace(/\s*;\s*/g, ', ').trim();
}

// Strip leading fancy/straight single/double quote characters from excerpts
function normaliseExcerpt(raw: string): string {
  return raw.replace(/^[‘’‚‛“”"'‹›]+/, '').trim();
}

// Parse Summary.docx — supports three formats:
//   Pipe-delimited:  "1. Title | Author | Excerpt"
//   Multi-line:      "1. Title\n[by] Author\nExcerpt"
//   Real-world ZIPs: numbered docx named "1-Title_Author.docx" — no summary needed
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
        articles.push({ number, title: parts[0], authorName: normaliseAuthor(parts[1]), excerpt: normaliseExcerpt(parts[2]) });
      } else if (parts.length === 2) {
        articles.push({ number, title: parts[0], authorName: normaliseAuthor(parts[1]), excerpt: '' });
      } else {
        // Multi-line format: next line = [by] author, line after = excerpt
        const title = rest;
        const rawAuthor = lines[i + 1] || '';
        const rawExcerpt = lines[i + 2] || '';
        if (!rawAuthor.match(articleLineRegex)) {
          articles.push({
            number,
            title,
            authorName: normaliseAuthor(rawAuthor),
            excerpt: rawExcerpt.match(articleLineRegex) ? '' : normaliseExcerpt(rawExcerpt),
          });
          i += rawExcerpt.match(articleLineRegex) ? 2 : 3;
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

  // Count docx files — matches "1.docx" and "1-Title_Author.docx" style names
  const docxFiles = Object.keys(zip.files).filter((f) => {
    const name = f.split('/').pop() || '';
    return name.match(/^\d+[-. ]/) && name.endsWith('.docx') && !name.toLowerCase().includes('summary');
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

interface PostForAI {
  postId: string;
  articleNumber: number;
  title: string;
  excerpt: string;
  hasFeaturedMedia: boolean;
}

export async function ingestIssue(zipBuffer: Buffer, options: IngestOptions): Promise<{
  created: number;
  warnings: string[];
}> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const warnings: string[] = [];

  const issue = await prisma.issue.findUnique({ where: { id: options.issueId } });
  if (!issue) throw new Error('Issue not found');

  const summaryFile = Object.keys(zip.files).find((f) =>
    f.toLowerCase().includes('summary') && f.endsWith('.docx'),
  );
  if (!summaryFile) throw new Error('Summary.docx not found');

  const summaryBuffer = Buffer.from(await zip.files[summaryFile].async('arraybuffer'));
  const summaryArticles = await parseSummary(summaryBuffer);
  const total = summaryArticles.length;

  let created = 0;
  const postsForAI: PostForAI[] = [];

  // Phase 1: create all posts sequentially (ZIP reading + DB writes must stay serial)
  for (const summary of summaryArticles) {
    try {
      const docxKey = Object.keys(zip.files).find((f) => {
        const name = f.split('/').pop() || '';
        return name.match(new RegExp(`^${summary.number}[-.\\s]`)) && name.endsWith('.docx');
      });

      let htmlContent = '';
      if (docxKey) {
        const docxBuffer = Buffer.from(await zip.files[docxKey].async('arraybuffer'));
        htmlContent = await docxToHtml(docxBuffer);
      } else {
        warnings.push(`No .docx found for article ${summary.number}`);
      }

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

      const authorId = summary.authorName ? await resolveAuthor(summary.authorName) : null;
      const publishedAt = computePublishTimestamp(issue.publishDate, summary.number, total, options.publishHour || 1);

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
        },
      });

      if (options.aiOptions) {
        postsForAI.push({
          postId: post.id,
          articleNumber: summary.number,
          title: summary.title,
          excerpt: summary.excerpt || '',
          hasFeaturedMedia: !!featuredMediaId,
        });
      }

      created++;
    } catch (err) {
      warnings.push(`Failed to process article ${summary.number}: ${(err as Error).message}`);
    }
  }

  // Phase 2: AI post-processing — all articles in parallel so total time ≈ one AI call
  if (options.aiOptions && postsForAI.length > 0) {
    const { generateImage, mapCategories, generateTags } = options.aiOptions;

    // Fetch categories once shared across all articles
    const allCats = mapCategories
      ? await prisma.category.findMany({ select: { id: true, name: true } })
      : [];

    const perArticleWarnings = await Promise.all(
      postsForAI.map(async ({ postId, articleNumber, title, excerpt, hasFeaturedMedia }) => {
        const w: string[] = [];

        if (generateImage && !hasFeaturedMedia) {
          try {
            const imgPrompt = await buildImagePrompt(title, excerpt || undefined);
            const img = await generateFeaturedImage({ prompt: imgPrompt }, options.uploadedById);
            await prisma.post.update({ where: { id: postId }, data: { featuredMediaId: img.mediaId } });
          } catch (e: any) {
            w.push(`AI image for article ${articleNumber}: ${e.message}`);
          }
        }

        if (mapCategories) {
          try {
            const catIds = await classifyCategories(title, excerpt, allCats);
            if (catIds.length > 0) {
              await prisma.postCategory.createMany({
                data: catIds.slice(0, 3).map((categoryId) => ({ postId, categoryId })),
                skipDuplicates: true,
              });
            }
          } catch (e: any) {
            w.push(`AI categories for article ${articleNumber}: ${e.message}`);
          }
        }

        if (generateTags) {
          try {
            const tagNames = await generateArticleTags(title, excerpt);
            for (const name of tagNames) {
              const tagSlug = slugify(name);
              if (!tagSlug) continue;
              const tag = await prisma.tag.upsert({ where: { slug: tagSlug }, update: {}, create: { name, slug: tagSlug } });
              await prisma.postTag.createMany({ data: [{ postId, tagId: tag.id }], skipDuplicates: true });
            }
          } catch (e: any) {
            w.push(`AI tags for article ${articleNumber}: ${e.message}`);
          }
        }

        return w;
      }),
    );

    warnings.push(...perArticleWarnings.flat());
  }

  return { created, warnings };
}
