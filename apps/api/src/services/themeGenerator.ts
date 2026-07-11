import fs from 'fs/promises';
import path from 'path';
import { getAIConfig, type AIConfig } from './ai.js';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// __dirname is: <repo>/apps/api/src/services (dev) or <repo>/apps/api/dist/services (prod)
// 4 levels up reaches repo root in both cases.
const WEB_SRC             = path.resolve(__dirname, '../../../..', 'apps/web/src');
const THEMES_DIR          = path.join(WEB_SRC, 'components/public/themes');
const THEME_META_FILE     = path.join(WEB_SRC, 'lib/theme-meta.ts');
const THEME_REGISTRY_FILE = path.join(WEB_SRC, 'lib/theme-registry.tsx');
const GLOBALS_CSS_FILE    = path.join(WEB_SRC, 'styles/globals.css');

const CSS_MARKER_START = '/* ====== AI-GENERATED THEMES START ====== */';
const CSS_MARKER_END   = '/* ====== AI-GENERATED THEMES END ====== */';
const BUILT_IN_THEMES  = ['classic', 'medusa', 'coppper'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThemeMetaJson {
  id: string;
  label: string;
  description: string;
  dataTheme: string | null;
  wrapperClass: string;
  mainClass: string;
  css?: string | null;
  adminPreview: {
    background: string;
    border?: string;
    primaryBar: string;
    secondaryBar: string;
    accentBar: string;
  };
}

interface AIThemeResult {
  meta: ThemeMetaJson;
  header: string;
  footer: string;
  homePage: string;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function toPascalCase(id: string): string {
  return id.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

export function toThemeId(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ─── Meta scanning ────────────────────────────────────────────────────────────

export async function readAllMeta(): Promise<ThemeMetaJson[]> {
  const entries = await fs.readdir(THEMES_DIR, { withFileTypes: true });
  const metas: ThemeMetaJson[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const raw = await fs.readFile(path.join(THEMES_DIR, entry.name, 'meta.json'), 'utf-8');
      metas.push(JSON.parse(raw) as ThemeMetaJson);
    } catch {
      // directory without meta.json — skip
    }
  }
  return metas.sort((a, b) => {
    const ai = BUILT_IN_THEMES.indexOf(a.id);
    const bi = BUILT_IN_THEMES.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.label.localeCompare(b.label);
  });
}

// ─── Registry / CSS regeneration ──────────────────────────────────────────────

function escSingle(s: string) { return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

function generateThemeMetaTs(metas: ThemeMetaJson[]): string {
  const entries = metas.map((m) => {
    const p = m.adminPreview;
    return `  {
    id: '${escSingle(m.id)}',
    label: '${escSingle(m.label)}',
    description: '${escSingle(m.description)}',
    adminPreview: {
      background: '${p.background}',${p.border ? `\n      border: '${p.border}',` : ''}
      primaryBar: '${p.primaryBar}',
      secondaryBar: '${p.secondaryBar}',
      accentBar: '${p.accentBar}',
    },
  }`;
  }).join(',\n');

  return `export interface ThemeMeta {
  id: string;
  label: string;
  description: string;
  adminPreview: {
    background: string;
    border?: string;
    primaryBar: string;
    secondaryBar: string;
    accentBar: string;
  };
}

export const DEFAULT_THEME_ID = 'classic';

export const THEME_META: ThemeMeta[] = [
${entries},
];
`;
}

function generateThemeRegistryTs(metas: ThemeMetaJson[]): string {
  const imports = metas.map((m) => {
    const P = toPascalCase(m.id);
    return [
      `import { ${P}Header }   from '@/components/public/themes/${m.id}/Header';`,
      `import { ${P}Footer }   from '@/components/public/themes/${m.id}/Footer';`,
      `import { ${P}HomePage } from '@/components/public/themes/${m.id}/HomePage';`,
    ].join('\n');
  }).join('\n');

  const entries = metas.map((m) => {
    const P = toPascalCase(m.id);
    const p = m.adminPreview;
    return `  '${m.id}': {
    id: '${escSingle(m.id)}',
    label: '${escSingle(m.label)}',
    description: '${escSingle(m.description)}',
    dataTheme: ${m.dataTheme ? `'${m.dataTheme}'` : 'undefined'},
    wrapperClass: '${escSingle(m.wrapperClass)}',
    mainClass: '${escSingle(m.mainClass)}',
    Header:   ${P}Header,
    Footer:   ${P}Footer,
    HomePage: ${P}HomePage,
    adminPreview: {
      background: '${p.background}',${p.border ? `\n      border: '${p.border}',` : ''}
      primaryBar: '${p.primaryBar}',
      secondaryBar: '${p.secondaryBar}',
      accentBar: '${p.accentBar}',
    },
  }`;
  }).join(',\n\n');

  return `import type { ComponentType } from 'react';
import type { ThemeHeaderProps, ThemeFooterProps, ThemeHomeProps } from './theme-types';

export type { ThemeHeaderProps, ThemeFooterProps, ThemeHomeProps };

// ─── Theme config ──────────────────────────────────────────────────────────────

export interface ThemeConfig {
  id: string;
  label: string;
  description: string;
  dataTheme?: string;
  wrapperClass: string;
  mainClass: string;
  Header: ComponentType<ThemeHeaderProps>;
  Footer: ComponentType<ThemeFooterProps>;
  HomePage: ComponentType<ThemeHomeProps>;
  adminPreview: {
    background: string;
    border?: string;
    primaryBar: string;
    secondaryBar: string;
    accentBar: string;
  };
}

// ─── Theme component imports ───────────────────────────────────────────────────

${imports}

// ─── Registry ─────────────────────────────────────────────────────────────────
// To add a theme: POST /api/themes/generate from the admin Appearance panel.

export const THEME_REGISTRY: Record<string, ThemeConfig> = {
${entries},
};

export const DEFAULT_THEME_ID = 'classic';

export function getTheme(id?: string | null): ThemeConfig {
  return THEME_REGISTRY[id ?? DEFAULT_THEME_ID] ?? THEME_REGISTRY[DEFAULT_THEME_ID];
}

export function getAllThemes(): ThemeConfig[] {
  return Object.values(THEME_REGISTRY);
}
`;
}

async function updateGlobalsCss(metas: ThemeMetaJson[]): Promise<void> {
  const current = await fs.readFile(GLOBALS_CSS_FILE, 'utf-8');
  const generatedBlock = metas
    .filter((m) => m.css)
    .map((m) => m.css!)
    .join('\n\n');
  const replacement = `${CSS_MARKER_START}\n${generatedBlock ? generatedBlock + '\n' : ''}${CSS_MARKER_END}`;
  const escaped    = CSS_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = CSS_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}[\\s\\S]*?${escapedEnd}`);
  const updated = re.test(current)
    ? current.replace(re, replacement)
    : current + '\n\n' + replacement + '\n';
  await fs.writeFile(GLOBALS_CSS_FILE, updated, 'utf-8');
}

export async function regenerateRegistry(): Promise<void> {
  const metas = await readAllMeta();
  await Promise.all([
    fs.writeFile(THEME_META_FILE, generateThemeMetaTs(metas), 'utf-8'),
    fs.writeFile(THEME_REGISTRY_FILE, generateThemeRegistryTs(metas), 'utf-8'),
    updateGlobalsCss(metas),
  ]);
}

// ─── AI generation ────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are a React/Next.js UI theme generator for a news and magazine CMS. You generate complete, production-ready public-facing themes.

OUTPUT FORMAT: Respond with a single valid JSON object (no markdown fences, no explanation) with exactly these keys:
- "meta": theme metadata object
- "header": string — complete TypeScript source for Header.tsx
- "footer": string — complete TypeScript source for Footer.tsx
- "homePage": string — complete TypeScript source for HomePage.tsx

STRICT COMPONENT RULES (apply to ALL three component files):
1. First line must be: 'use client';
2. Header.tsx must: import type { ThemeHeaderProps } from '@/lib/theme-types';
3. Footer.tsx must: import type { ThemeFooterProps } from '@/lib/theme-types';
4. HomePage.tsx must: import type { ThemeHomeProps } from '@/lib/theme-types';
5. Use Tailwind CSS classes only — no css-in-js, no styled-components, no module css
6. Use next/link for all internal navigation
7. Use next/image for all images (never <img>)
8. Only import icons from lucide-react
9. No other external library imports (no framer-motion, no @headlessui, etc.)
10. Components must be complete and self-contained — no TODO, no placeholder code

CSS VARIABLE RULE — CRITICAL FOR PAGE BUILDER COMPATIBILITY:
ALL color classes in components MUST use Tailwind semantic tokens backed by CSS custom properties,
NOT hardcoded hex or RGB values. This ensures page builder blocks automatically inherit the theme palette.

Required class mapping (use these, never hardcoded colors):
  bg-background        text-foreground       border-border
  bg-card              text-card-foreground
  bg-muted             text-muted-foreground
  bg-primary           text-primary          ring-ring
  bg-secondary         text-secondary-foreground
  bg-accent            text-accent           text-accent-foreground
  hover:bg-muted       hover:text-foreground  hover:border-border/70
  opacity variants:    text-foreground/80    text-muted-foreground/50  text-muted-foreground/40

The theme's visual personality is defined ENTIRELY by the CSS custom property block in meta.css —
not by hardcoded colors in JSX. Components should look identical in structure across themes;
only the CSS variable values differ.

wrapperClass MUST be: "min-h-screen flex flex-col bg-background text-foreground"
(bg-background and text-foreground pick up the theme's CSS variable values automatically)

PROP TYPE REFERENCE:
ThemeHeaderProps = { categories: Array<{id:string;name:string;slug:string}>; siteTitle?:string; siteLogo?:string; navItems?:Array<{label:string;url:string}>; }
ThemeFooterProps = { categories: Array<{id:string;name:string;slug:string}>; siteTitle:string; siteDescription?:string; }
ThemeHomeProps = { hero: Post|null; gridPosts: Post[]; listPosts: Post[]; issue: Issue|null; }
  where Post = {id,slug,title,excerpt?,publishedAt?,isFeatured?,readingTime?,featuredMedia?:{url,altText?}|null,authors?:[{displayName,slug}],categories?:[{name,slug}]}
  and Issue = {id,title,volumeNumber,issueNumber,publishDate:string}

HEADER requirements — CRITICAL, follow exactly:
- Use sticky positioning: className must include "sticky top-0 z-50 w-full" — NEVER use "fixed"
  (fixed removes the header from document flow and overlaps page content)
- Logo/title MUST be wrapped in <Link href="/">...</Link> so clicking it goes to homepage:
    <Link href="/" className="flex items-center">
      {siteLogo ? <Image src={siteLogo} alt={siteTitle??''} width={120} height={40} className="object-contain" /> : <span>{siteTitle}</span>}
    </Link>
- Navigation: ALWAYS normalize to {label,url} pairs BEFORE rendering with static fallback:
    const nav = navItems?.length
      ? navItems
      : categories.length
        ? categories.slice(0, 5).map((c) => ({ label: c.name, url: \`/category/\${c.slug}\` }))
        : [{ label: 'Home', url: '/' }, { label: 'Issues', url: '/issues' }];
  Then render: nav.map((item) => <Link href={item.url}>{item.label}</Link>)
- Search: MUST include a search toggle button (Search icon from lucide-react) that shows/hides an inline search form.
  Use useRef<HTMLInputElement> to auto-focus the input when opened.
  On submit, call: router.push(\`/search?q=\${encodeURIComponent(query.trim())}\`); setSearchOpen(false); setQuery('');
  Import useRouter from 'next/navigation'.
- Mobile hamburger menu using useState for open/closed
- useEffect scroll listener for transparent-to-solid background transition

FOOTER requirements:
- Multi-column layout (brand column + nav columns)
- {new Date().getFullYear()} for copyright year
- Link categories as /category/{slug}
- Link to /issues for all issues

HOMEPAGE requirements:
- Import { format } from 'date-fns' for date display
- Import { formatDistanceToNow } from 'date-fns' for relative time
- Large hero section for the first article (link to /articles/{slug})
- Grid section for gridPosts
- Compact list section for listPosts
- Handle null hero with a pleasant empty state
- Issue banner if issue is provided (link to /issues/{id})
- Category links: /category/{slug}
- Article links: /articles/{slug}

META OBJECT SHAPE:
{
  "id": "<theme-id>",
  "label": "<Human Label>",
  "description": "<1-sentence description under 80 chars>",
  "dataTheme": "<theme-id>",
  "wrapperClass": "min-h-screen flex flex-col bg-background text-foreground",
  "mainClass": "<max-w + padding + flex-1 tailwind classes>",
  "css": "<full CSS string for [data-theme='<id>'] block with all HSL custom property overrides>",
  "adminPreview": { "background":"#hex","border":"#hex (optional)","primaryBar":"#hex","secondaryBar":"#hex","accentBar":"#hex" }
}

CSS block must override ALL these custom properties using HSL values (format: "H S% L%" without hsl()):
--background, --foreground, --card, --card-foreground, --popover, --popover-foreground,
--primary, --primary-foreground, --secondary, --secondary-foreground,
--muted, --muted-foreground, --accent, --accent-foreground,
--destructive, --destructive-foreground, --border, --input, --ring, --radius

EXPORT NAMES: The function exports must match exactly what the registry imports:
- Header:   export function {PascalCaseId}Header(...)
- Footer:   export function {PascalCaseId}Footer(...)
- HomePage: export function {PascalCaseId}HomePage(...)
(PascalCaseId will be given in the user prompt)

QUALITY BAR: Generate a fully unique, visually distinctive, professional design. Not a clone of classic or medusa.`;
}

function buildUserPrompt(id: string, pascalId: string, label: string, userPrompt: string): string {
  return `Generate a complete theme with these details:

Theme ID: ${id}
PascalCase ID (use for export names): ${pascalId}
Theme Name: ${label}
Visual Style: ${userPrompt}

Remember: exports must be named ${pascalId}Header, ${pascalId}Footer, ${pascalId}HomePage.
Output only the JSON object.`;
}

function extractJson(raw: string): string {
  const stripped = raw.trim();
  const fenceMatch = stripped.match(/^```(?:json)?\s*([\s\S]+?)\s*```$/);
  if (fenceMatch) return fenceMatch[1];
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start !== -1 && end !== -1) return stripped.slice(start, end + 1);
  return stripped;
}

function validateResult(result: AIThemeResult, id: string, P: string): void {
  if (!result.meta?.id) throw new Error('AI response missing meta.id');
  if (!result.header?.includes(`${P}Header`)) throw new Error(`Header component missing export ${P}Header`);
  if (!result.footer?.includes(`${P}Footer`)) throw new Error(`Footer component missing export ${P}Footer`);
  if (!result.homePage?.includes(`${P}HomePage`)) throw new Error(`HomePage component missing export ${P}HomePage`);
  if (!result.header.includes("'use client'") && !result.header.includes('"use client"')) {
    throw new Error("Header missing 'use client' directive");
  }
  result.meta.id = id;
  result.meta.dataTheme = result.meta.dataTheme || id;
}

async function callAIForTheme(config: AIConfig, id: string, P: string, label: string, userPrompt: string): Promise<AIThemeResult> {
  const systemPrompt = buildSystemPrompt();
  const prompt = buildUserPrompt(id, P, label, userPrompt);

  let raw: string;

  if (config.provider === 'gemini') {
    const client = new GoogleGenerativeAI(config.apiKey);
    const model = client.getGenerativeModel({
      model: config.textModel,
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 12000 },
    });
    const result = await model.generateContent(`${systemPrompt}\n\n${prompt}`);
    raw = result.response.text();
  } else {
    const baseOptions: ConstructorParameters<typeof OpenAI>[0] = { apiKey: config.apiKey };
    if (config.provider === 'groq') baseOptions.baseURL = 'https://api.groq.com/openai/v1';
    if (config.provider === 'ollama') {
      baseOptions.apiKey = 'ollama';
      baseOptions.baseURL = (config.apiUrl || 'http://localhost:11434') + '/v1';
    }
    const client = new OpenAI(baseOptions);
    const isJsonModeSupported = config.provider === 'openai' || config.provider === 'groq';
    const response = await client.chat.completions.create({
      model: config.textModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 12000,
      temperature: 0.7,
      ...(isJsonModeSupported ? { response_format: { type: 'json_object' } } : {}),
    });
    raw = response.choices[0]?.message?.content || '';
  }

  const jsonStr = extractJson(raw);
  let parsed: AIThemeResult;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('AI returned invalid JSON. Try again or switch to a larger model.');
  }

  validateResult(parsed, id, P);
  return parsed;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateTheme(label: string, userPrompt: string): Promise<ThemeMetaJson> {
  const id = toThemeId(label);
  if (!id) throw new Error('Invalid theme name — use letters, numbers, or hyphens.');

  try {
    await fs.access(path.join(THEMES_DIR, id));
    throw new Error(`Theme "${id}" already exists. Choose a different name.`);
  } catch (e: any) {
    if (e.message?.startsWith('Theme ')) throw e;
  }

  const config = await getAIConfig();
  if (!config) throw new Error('AI not configured. Set it up in Settings → AI Configuration.');

  const P = toPascalCase(id);
  const result = await callAIForTheme(config, id, P, label, userPrompt);

  const themeDir = path.join(THEMES_DIR, id);
  await fs.mkdir(themeDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(themeDir, 'Header.tsx'),   result.header,   'utf-8'),
    fs.writeFile(path.join(themeDir, 'Footer.tsx'),   result.footer,   'utf-8'),
    fs.writeFile(path.join(themeDir, 'HomePage.tsx'), result.homePage, 'utf-8'),
    fs.writeFile(path.join(themeDir, 'meta.json'),    JSON.stringify(result.meta, null, 2), 'utf-8'),
  ]);

  await regenerateRegistry();
  return result.meta;
}

export async function deleteTheme(id: string): Promise<void> {
  if (BUILT_IN_THEMES.includes(id)) throw new Error(`Cannot delete built-in theme "${id}".`);
  await fs.rm(path.join(THEMES_DIR, id), { recursive: true, force: true });
  await regenerateRegistry();
}

export async function listThemes(): Promise<Array<ThemeMetaJson & { isBuiltIn: boolean }>> {
  const metas = await readAllMeta();
  return metas.map((m) => ({ ...m, isBuiltIn: BUILT_IN_THEMES.includes(m.id) }));
}
