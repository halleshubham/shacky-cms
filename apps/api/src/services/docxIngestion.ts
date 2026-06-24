import mammoth from 'mammoth';
import JSZip from 'jszip';
import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../plugins/prisma.js';
import { uploadToS3 } from '../utils/s3.js';
import { slugify, computePublishTimestamp } from '@shacky/shared';
import type { IngestArticlePreview, IngestPreviewResult } from '@shacky/shared';
import { getAIConfig, classifyCategories, generateArticleTags, buildImagePrompt, generateFeaturedImage } from './ai.js';
import { searchAllStock, downloadAndStoreStockImage } from './stockSearch.js';

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
    searchStockImage?: boolean;
  };
}

// ─── Stock image keyword extraction ──────────────────────────────────────────

// English stopwords inlined from keyword-extractor (MIT) to avoid CJS import complexity
const EN_STOPWORDS = new Set(["a","a's","able","about","above","according","accordingly","across","actually","after","afterwards","again","against","ain't","all","allow","allows","almost","alone","along","already","also","although","always","am","among","amongst","an","and","another","any","anybody","anyhow","anyone","anything","anyway","anyways","anywhere","apart","appear","appreciate","appropriate","are","aren't","around","as","aside","ask","asking","associated","at","available","away","awfully","b","be","became","because","become","becomes","becoming","been","before","beforehand","behind","being","believe","below","beside","besides","best","better","between","beyond","both","brief","but","by","c","c'mon","c's","came","can","can't","cannot","cant","cause","causes","certain","certainly","changes","clearly","co","com","come","comes","concerning","consequently","consider","considering","contain","containing","contains","corresponding","could","couldn't","course","currently","d","definitely","described","despite","did","didn't","different","do","does","doesn't","doing","don't","done","down","downwards","during","e","each","edu","eg","eight","either","else","elsewhere","enough","entirely","especially","et","etc","even","ever","every","everybody","everyone","everything","everywhere","ex","exactly","example","except","f","far","few","fifth","first","five","followed","following","follows","for","former","formerly","forth","four","from","further","furthermore","g","get","gets","getting","given","gives","go","goes","going","gone","got","gotten","greetings","h","had","hadn't","happens","hardly","has","hasn't","have","haven't","having","he","he's","hello","help","hence","her","here","here's","hereafter","hereby","herein","hereupon","hers","herself","hi","him","himself","his","hither","hopefully","how","howbeit","however","i","i'd","i'll","i'm","i've","ie","if","ignored","immediate","in","inasmuch","inc","indeed","indicate","indicated","indicates","inner","insofar","instead","into","inward","is","isn't","it","it'd","it'll","it's","its","itself","j","just","k","keep","keeps","kept","know","knows","known","l","last","lately","later","latter","latterly","least","less","lest","let","let's","like","liked","likely","little","look","looking","looks","ltd","m","mainly","many","may","maybe","me","mean","meanwhile","merely","might","more","moreover","most","mostly","much","must","my","myself","n","name","namely","nd","near","nearly","necessary","need","needs","neither","never","nevertheless","new","next","nine","no","nobody","non","none","noone","nor","normally","not","nothing","novel","now","nowhere","o","obviously","of","off","often","oh","ok","okay","old","on","once","one","ones","only","onto","or","other","others","otherwise","ought","our","ours","ourselves","out","outside","over","overall","own","p","particular","particularly","per","perhaps","placed","please","plus","possible","presumably","probably","provides","q","que","quite","qv","r","rather","rd","re","really","reasonably","regarding","regardless","regards","relatively","respectively","right","s","said","same","saw","say","saying","says","second","secondly","see","seeing","seem","seemed","seeming","seems","seen","self","selves","sensible","sent","serious","seriously","seven","several","shall","she","should","shouldn't","since","six","so","some","somebody","somehow","someone","something","sometime","sometimes","somewhat","somewhere","soon","sorry","specified","specify","specifying","still","sub","such","sup","sure","t","t's","take","taken","tell","tends","th","than","thank","thanks","thanx","that","that's","thats","the","their","theirs","them","themselves","then","thence","there","there's","thereafter","thereby","therefore","therein","theres","thereupon","these","they","they'd","they'll","they're","they've","think","third","this","thorough","thoroughly","those","though","three","through","throughout","thru","thus","to","together","too","took","toward","towards","tried","tries","truly","try","trying","twice","two","u","un","under","unfortunately","unless","unlikely","until","unto","up","upon","us","use","used","useful","uses","using","usually","uucp","v","value","various","very","via","viz","vs","w","want","wants","was","wasn't","way","we","we'd","we'll","we're","we've","welcome","well","went","were","weren't","what","what's","whatever","when","whence","whenever","where","where's","whereafter","whereas","whereby","wherein","whereupon","wherever","whether","which","while","whither","who","who's","whoever","whole","whom","whose","why","will","willing","wish","with","within","without","won't","wonder","would","wouldn't","x","y","yes","yet","you","you'd","you'll","you're","you've","your","yours","yourself","yourselves","z","zero"]);

// Words with these suffixes are abstract concepts that rarely map to a stock image
const ABSTRACT_SUFFIX = /(?:ment|ness|ism|tion|sion|ance|ence|ize|izing|ised|ising|ized|ified)$/i;

// Common action verbs in political/news headlines that don't correspond to visual concepts
const SKIP_VERBS = new Set(["condemns","condemn","destroys","destroying","exposed","exposing","ruin","ruining","achieved","achieving","asked","asking","teach","teaches","paying","paid","organising","organizing","manufactured","manufacturing","facing","faces","shows","showing","live","lives","become","becomes","needs","done","choked","privatised","privatizing","privatized","asserted","demands","demanding","resist","resisting","destroy","continuing","happened","said","says","found","come","came","went","gone","give","given","got","told","taken","used","called","left","place"]);

// Extract visual search keywords from a news article title for stock image lookup.
// Returns up to 3 progressively simpler candidate queries.
function stockSearchQueries(title: string): string[] {
  // Strip "– N Articles" meta-suffix and short label prefixes like "SIR:", "BOOK:"
  let t = title
    .replace(/\s*[–-]\s*\d+\s+articles?$/i, '')
    .replace(/^[A-Z]{2,6}:\s+/, '');

  // Normalise possessives (India's → India) then strip loose quote chars ('Pushback' → Pushback)
  t = t.replace(/(\w+)['']\w*/g, '$1');
  t = t.replace(/[''""]+/g, '');

  // Tokenize on punctuation/whitespace; remove digits and stopwords
  const tokens = t
    .split(/[\s;,!?:/\\&–—\/]+/)
    .map((w) => w.replace(/[^a-zA-Z-]/g, '').trim())
    .filter((w) => w.length > 2 && w.length < 20)
    .filter((w) => !EN_STOPWORDS.has(w.toLowerCase()))
    .filter((w) => !/^\d+$/.test(w));

  // Further filter to visual terms: drop abstract suffixes and action verbs
  const visual = [...new Set(tokens)]
    .filter((w) => !ABSTRACT_SUFFIX.test(w))
    .filter((w) => !SKIP_VERBS.has(w.toLowerCase()));

  const q1 = visual.slice(0, 4).join(' ');
  const q2 = visual.slice(0, 2).join(' ');
  // Tail fallback: the last keyword not already in q2 (geographic anchors like "India",
  // "Kashmir", "Mexico" often appear at the end of compound headlines)
  const q3 = [...visual].reverse().find((w) => !q2.split(' ').includes(w)) ?? '';

  return [...new Set([q1, q2, q3])].filter((q) => q.length > 3);
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

export interface PostForAI {
  postId: string;
  articleNumber: number;
  title: string;
  excerpt: string;
  hasFeaturedMedia: boolean;
}

export async function ingestIssue(zipBuffer: Buffer, options: IngestOptions): Promise<{
  created: number;
  warnings: string[];
  postsForAI: PostForAI[];
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

      postsForAI.push({
        postId: post.id,
        articleNumber: summary.number,
        title: summary.title,
        excerpt: summary.excerpt || '',
        hasFeaturedMedia: !!featuredMediaId,
      });

      created++;
    } catch (err) {
      warnings.push(`Failed to process article ${summary.number}: ${(err as Error).message}`);
    }
  }

  return { created, warnings, postsForAI };
}

export type IngestAiOptions = NonNullable<IngestOptions['aiOptions']>;

// Phase 2: AI/stock enhancements — runs as a background BullMQ job so the HTTP
// request can return immediately after Phase 1 (article creation).
export async function runIngestEnhancements(
  postsForAI: PostForAI[],
  aiOptions: IngestAiOptions,
  uploadedById: string,
): Promise<string[]> {
  const { generateImage, mapCategories, generateTags, searchStockImage } = aiOptions;
  const warnings: string[] = [];

  const allCats = mapCategories
    ? await prisma.category.findMany({ select: { id: true, name: true } })
    : [];

  const perArticleWarnings = await Promise.all(
    postsForAI.map(async ({ postId, articleNumber, title, excerpt, hasFeaturedMedia }) => {
      const w: string[] = [];

      if (generateImage && !hasFeaturedMedia) {
        try {
          const imgPrompt = await buildImagePrompt(title, excerpt || undefined);
          const img = await generateFeaturedImage({ prompt: imgPrompt }, uploadedById);
          await prisma.post.update({ where: { id: postId }, data: { featuredMediaId: img.mediaId } });
          hasFeaturedMedia = true;
        } catch (e: any) {
          w.push(`AI image for article ${articleNumber}: ${e.message}`);
        }
      }

      if (searchStockImage && !hasFeaturedMedia) {
        try {
          const queries = stockSearchQueries(title);
          let stored: { mediaId: string; url: string } | null = null;
          outer: for (const q of queries) {
            const results = await searchAllStock(q, 1);
            for (const photo of results.slice(0, 3)) {
              stored = await downloadAndStoreStockImage(photo, uploadedById);
              if (stored) break outer;
            }
          }
          if (stored) {
            await prisma.post.update({ where: { id: postId }, data: { featuredMediaId: stored.mediaId } });
            hasFeaturedMedia = true;
          } else {
            w.push(`No stock image found for article ${articleNumber}: "${title}"`);
          }
        } catch (e: any) {
          w.push(`Stock image for article ${articleNumber}: ${e.message}`);
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
  return warnings;
}
