import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../plugins/prisma.js';
import { uploadToS3 } from '../utils/s3.js';
import { createId } from '@paralleldrive/cuid2';

export type AIProvider = 'openai' | 'gemini' | 'ollama' | 'groq';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;     // empty string for Ollama
  apiUrl?: string;    // Ollama base URL (e.g. http://localhost:11434)
  textModel: string;
  imageModel: string;
}

export interface GenerateContentInput {
  title: string;
  brief?: string;
  tone?: 'neutral' | 'formal' | 'casual' | 'journalistic';
  wordCount?: number;
  existingContent?: string;
  instruction?: string;
}

export interface GeneratedContent {
  content: string;         // HTML
  excerpt: string;
  seoTitle: string;
  seoDescription: string;
}

export interface GenerateImageInput {
  prompt: string;
  style?: 'photorealistic' | 'illustrated' | 'abstract' | 'documentary';
}

export interface GeneratedImage {
  url: string;
  mediaId: string;
}

// ─── Config helpers ──────────────────────────────────────────────────────────

export async function getAIConfig(): Promise<AIConfig | null> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['ai_provider', 'ai_api_key', 'ai_text_model', 'ai_image_model', 'ai_api_url'] } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  if (!map['ai_provider']) return null;
  // Ollama doesn't require an API key — all other providers do
  if (!map['ai_api_key'] && map['ai_provider'] !== 'ollama') return null;

  const provider = map['ai_provider'] as AIProvider;
  return {
    provider,
    apiKey: map['ai_api_key'] || '',
    apiUrl: map['ai_api_url'],
    textModel: map['ai_text_model'] || defaultTextModel(provider),
    imageModel: map['ai_image_model'] || defaultImageModel(provider),
  };
}

export async function saveAIConfig(config: Partial<AIConfig>): Promise<void> {
  const entries: { key: string; value: string }[] = [];
  if (config.provider) entries.push({ key: 'ai_provider', value: config.provider });
  if (config.apiKey) entries.push({ key: 'ai_api_key', value: config.apiKey }); // only write when explicitly set
  if (config.apiUrl !== undefined) entries.push({ key: 'ai_api_url', value: config.apiUrl });
  if (config.textModel) entries.push({ key: 'ai_text_model', value: config.textModel });
  if (config.imageModel) entries.push({ key: 'ai_image_model', value: config.imageModel });

  await Promise.all(
    entries.map((e) =>
      prisma.setting.upsert({
        where: { key: e.key },
        create: e,
        update: { value: e.value },
      }),
    ),
  );
}

function defaultTextModel(provider: AIProvider): string {
  switch (provider) {
    case 'openai': return 'gpt-4o-mini';
    case 'gemini': return 'gemini-2.0-flash';
    case 'groq':   return 'llama-3.3-70b-versatile';
    case 'ollama': return 'llama3.2';
  }
}

function defaultImageModel(provider: AIProvider): string {
  switch (provider) {
    case 'openai': return 'dall-e-3';
    case 'gemini': return 'imagen-3.0-generate-002';
    default:       return ''; // not supported
  }
}

// ─── OpenAI-compatible client factory ────────────────────────────────────────

function openAICompatClient(config: AIConfig): OpenAI {
  switch (config.provider) {
    case 'openai':
      return new OpenAI({ apiKey: config.apiKey });
    case 'groq':
      return new OpenAI({ apiKey: config.apiKey, baseURL: 'https://api.groq.com/openai/v1' });
    case 'ollama':
      return new OpenAI({
        apiKey: 'ollama',
        baseURL: (config.apiUrl || 'http://localhost:11434') + '/v1',
      });
    default:
      throw new Error(`Provider ${config.provider} is not OpenAI-compatible`);
  }
}

// ─── Text generation ─────────────────────────────────────────────────────────

const CONTENT_SYSTEM_PROMPT = `You are a professional journalist and content writer for "Shacky CMS", an independent weekly publication covering politics, economy, society, culture, and environment. Write well-structured, factual, engaging articles in a journalistic style. Output ONLY valid HTML using these tags: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <blockquote>, <strong>, <em>. No markdown, no code blocks, no outer wrapper divs.`;

const CONTENT_USER_TEMPLATE = (input: GenerateContentInput) => `
Write a complete, well-researched article for the following:

Title: ${input.title}
${input.brief ? `Brief/Context: ${input.brief}` : ''}
Tone: ${input.tone || 'journalistic'}
Target word count: ${input.wordCount || 600} words

${input.existingContent ? `Existing draft to improve/expand:\n${input.existingContent}\n\nInstruction: ${input.instruction || 'Improve and expand this content.'}` : ''}

Output requirements:
1. Start directly with the article body (no title heading — it will be shown separately)
2. Use <h2> for major sections, <h3> for subsections
3. Use <p> for paragraphs, <blockquote> for notable quotes
4. After the article HTML, output on a new line: EXCERPT: [2-sentence summary]
5. After that: SEO_TITLE: [60-char optimized title]
6. After that: SEO_DESC: [155-char meta description]
`;

function parseGeneratedText(raw: string): GeneratedContent {
  const excerptMatch = raw.match(/EXCERPT:\s*(.+?)(?=SEO_TITLE:|$)/s);
  const seoTitleMatch = raw.match(/SEO_TITLE:\s*(.+?)(?=SEO_DESC:|$)/s);
  const seoDescMatch = raw.match(/SEO_DESC:\s*(.+?)$/s);

  const content = raw
    .replace(/EXCERPT:[\s\S]+$/, '')
    .trim();

  return {
    content,
    excerpt: excerptMatch?.[1]?.trim() || '',
    seoTitle: seoTitleMatch?.[1]?.trim() || '',
    seoDescription: seoDescMatch?.[1]?.trim() || '',
  };
}

async function generateWithOpenAICompat(config: AIConfig, input: GenerateContentInput): Promise<GeneratedContent> {
  const client = openAICompatClient(config);
  const response = await client.chat.completions.create({
    model: config.textModel,
    messages: [
      { role: 'system', content: CONTENT_SYSTEM_PROMPT },
      { role: 'user', content: CONTENT_USER_TEMPLATE(input) },
    ],
    temperature: 0.7,
    max_tokens: 3000,
  });
  return parseGeneratedText(response.choices[0]?.message?.content || '');
}

async function generateWithGemini(config: AIConfig, input: GenerateContentInput): Promise<GeneratedContent> {
  const client = new GoogleGenerativeAI(config.apiKey);
  const model = client.getGenerativeModel({ model: config.textModel });
  const prompt = `${CONTENT_SYSTEM_PROMPT}\n\n${CONTENT_USER_TEMPLATE(input)}`;
  const result = await model.generateContent(prompt);
  return parseGeneratedText(result.response.text());
}

export async function generateContent(input: GenerateContentInput): Promise<GeneratedContent> {
  const config = await getAIConfig();
  if (!config) throw new Error('AI not configured. Please add your API key in Settings → AI.');

  if (config.provider === 'gemini') return generateWithGemini(config, input);
  return generateWithOpenAICompat(config, input);
}

// ─── Excerpt / SEO helpers ───────────────────────────────────────────────────

async function chatOnce(config: AIConfig, userPrompt: string, maxTokens = 200): Promise<string> {
  if (config.provider === 'gemini') {
    const client = new GoogleGenerativeAI(config.apiKey);
    const model = client.getGenerativeModel({ model: config.textModel });
    const result = await model.generateContent(userPrompt);
    return result.response.text().trim();
  }
  const client = openAICompatClient(config);
  const res = await client.chat.completions.create({
    model: config.textModel,
    messages: [{ role: 'user', content: userPrompt }],
    max_tokens: maxTokens,
  });
  return res.choices[0]?.message?.content?.trim() || '';
}

export async function generateExcerpt(htmlContent: string, title: string): Promise<string> {
  const config = await getAIConfig();
  if (!config) throw new Error('AI not configured');
  const text = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 3000);
  const prompt = `Write a compelling 2-sentence excerpt for this article titled "${title}". Output only the excerpt text, no quotes.\n\n${text}`;
  return chatOnce(config, prompt, 150);
}

export async function suggestSEO(title: string, htmlContent: string): Promise<{ seoTitle: string; seoDescription: string }> {
  const config = await getAIConfig();
  if (!config) throw new Error('AI not configured');
  const text = htmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 2000);
  const prompt = `For an article titled "${title}", suggest:
1. An SEO-optimized title (max 60 characters) — output as: TITLE: <title>
2. A meta description (max 155 characters) — output as: DESC: <description>

Article content summary: ${text}`;

  const raw = await chatOnce(config, prompt, 200);
  return {
    seoTitle: raw.match(/TITLE:\s*(.+)/)?.[1]?.trim() || '',
    seoDescription: raw.match(/DESC:\s*(.+)/)?.[1]?.trim() || '',
  };
}

export async function buildImagePrompt(title: string, excerpt?: string): Promise<string> {
  const config = await getAIConfig();
  if (!config) return title;

  const prompt = `Generate a concise image generation prompt (max 80 words) for a news article image.
Article: "${title}"
${excerpt ? `Context: ${excerpt}` : ''}
Output only the image prompt, no explanations.`;

  return (await chatOnce(config, prompt, 120)) || title;
}

// ─── Image generation ─────────────────────────────────────────────────────────

const IMAGE_STYLE_SUFFIXES: Record<string, string> = {
  photorealistic: 'photorealistic, high quality, professional photography, editorial style',
  illustrated: 'illustration, vector art, colorful, editorial',
  abstract: 'abstract art, conceptual, modern',
  documentary: 'documentary photography, candid, natural lighting',
};

async function generateImageWithOpenAI(config: AIConfig, input: GenerateImageInput): Promise<Buffer> {
  const client = new OpenAI({ apiKey: config.apiKey });
  const styleSuffix = IMAGE_STYLE_SUFFIXES[input.style || 'photorealistic'];
  const fullPrompt = `${input.prompt}. ${styleSuffix}. No text, no watermarks.`;

  // response_format is deprecated in the current OpenAI API — omit it for all models.
  // dall-e-3/2 → returns data[0].url; gpt-image-1 → returns data[0].b64_json.
  const isGptImage = config.imageModel === 'gpt-image-1';
  const response = await client.images.generate({
    model: config.imageModel as any,
    prompt: fullPrompt,
    n: 1,
    size: isGptImage ? '1536x1024' : '1792x1024',
  } as any);

  // gpt-image-1 always returns b64_json; dall-e models return a URL
  const b64 = (response.data?.[0] as any)?.b64_json;
  if (b64) return Buffer.from(b64, 'base64');

  const url = (response.data?.[0] as any)?.url;
  if (url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download generated image: ${res.statusText}`);
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error('No image data returned from OpenAI');
}

async function generateImageWithGemini(config: AIConfig, input: GenerateImageInput): Promise<Buffer> {
  const styleSuffix = IMAGE_STYLE_SUFFIXES[input.style || 'photorealistic'];
  const fullPrompt = `${input.prompt}. ${styleSuffix}. No text overlay.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.imageModel}:predict?key=${config.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt: fullPrompt }],
      parameters: { sampleCount: 1, aspectRatio: '16:9' },
    }),
  });

  if (!res.ok) throw new Error(`Gemini Imagen error: ${await res.text()}`);
  const data = await res.json() as any;
  const b64 = data.predictions?.[0]?.bytesBase64Encoded;
  if (!b64) throw new Error('No image data returned from Gemini');
  return Buffer.from(b64, 'base64');
}

export async function generateFeaturedImage(
  input: GenerateImageInput,
  uploadedById: string,
): Promise<GeneratedImage> {
  const config = await getAIConfig();
  if (!config) throw new Error('AI not configured');

  if (config.provider === 'ollama' || config.provider === 'groq') {
    throw new Error(
      `Image generation is not supported with ${config.provider === 'ollama' ? 'Ollama' : 'Groq'}. ` +
      'Switch to OpenAI (DALL-E) or Gemini (Imagen) for featured image generation.',
    );
  }

  const imageBuffer = config.provider === 'openai'
    ? await generateImageWithOpenAI(config, input)
    : await generateImageWithGemini(config, input);

  const { default: sharp } = await import('sharp');
  const processed = await sharp(imageBuffer)
    .jpeg({ quality: 88 })
    .toBuffer({ resolveWithObject: true });

  const filename = `ai-${createId()}.jpg`;
  const url = await uploadToS3(`media/${filename}`, processed.data, 'image/jpeg');

  const media = await prisma.media.create({
    data: {
      filename,
      originalName: `ai-generated-${Date.now()}.jpg`,
      mimeType: 'image/jpeg',
      size: processed.data.length,
      width: processed.info.width,
      height: processed.info.height,
      url,
      altText: input.prompt.slice(0, 120),
      uploadedById,
    },
  });

  return { url, mediaId: media.id };
}
