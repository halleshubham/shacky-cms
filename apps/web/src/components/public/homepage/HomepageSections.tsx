import type React from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { BookOpen, ArrowRight, Download as DownloadIcon } from 'lucide-react';
import { ArticleCard } from '@/components/public/ArticleCard';
import type {
  Section, HeroConfig, PostGridConfig, LatestIssueConfig, IssueArticlesConfig,
  CategoryRowConfig, DownloadBannerConfig, HtmlEmbedConfig, DividerConfig, SpacerConfig,
  ImageBlockConfig, RichTextConfig, HeadingBlockConfig, ButtonRowConfig,
  FileDownloadsConfig, ImageGalleryConfig, ColumnsBlockConfig, ColumnItem,
} from '@/lib/page-builder';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchPosts(params: Record<string, string | number>): Promise<any[]> {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  ).toString();
  try {
    const res = await fetch(`${API}/api/public/posts?${qs}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data ?? data ?? [];
  } catch { return []; }
}

async function fetchLatestIssue(): Promise<any | null> {
  try {
    const res = await fetch(`${API}/api/public/issues/latest`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function fetchIssueById(id: string): Promise<any | null> {
  try {
    const res = await fetch(`${API}/api/public/issues/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function fetchFeaturedPosts(limit: number): Promise<any[]> {
  try {
    const res = await fetch(`${API}/api/public/featured?limit=${limit}`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

// ─── Section renderers ─────────────────────────────────────────────────────────

async function HeroSection({ config }: { config: HeroConfig }) {
  const heroCount = config.heroCount ?? 1;
  const sidebarCount = config.layout === 'split' ? (config.sidebarCount ?? 3) : 0;
  const total = heroCount + sidebarCount;

  let posts: any[] = [];
  if (config.source === 'latest_issue') {
    const issue = await fetchLatestIssue();
    posts = issue?.posts?.slice(0, total) ?? [];
  } else if (config.source === 'category' && config.categorySlug) {
    posts = await fetchPosts({ categorySlug: config.categorySlug, pageSize: total });
  } else {
    posts = await fetchPosts({ pageSize: total });
  }

  const heroes = posts.slice(0, heroCount);
  if (!heroes.length) return null;

  if (config.layout === 'single') {
    return (
      <section className="space-y-8">
        {heroes.map((p: any) => <ArticleCard key={p.id} post={p} size="large" />)}
      </section>
    );
  }

  const side = posts.slice(heroCount, heroCount + sidebarCount);
  return (
    <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-8">
        {heroes.map((p: any) => <ArticleCard key={p.id} post={p} size="large" />)}
      </div>
      {side.length > 0 && (
        <div className="space-y-6">
          {side.map((p: any) => <ArticleCard key={p.id} post={p} size="default" />)}
        </div>
      )}
    </section>
  );
}

async function PostGridSection({ config }: { config: PostGridConfig }) {
  let posts: any[];
  if (config.source === 'featured') {
    posts = await fetchFeaturedPosts(config.count);
  } else {
    const params: Record<string, string | number> = { pageSize: config.count };
    if (config.source === 'category' && config.slug) params.categorySlug = config.slug;
    if (config.source === 'tag' && config.slug) params.tagSlug = config.slug;
    posts = await fetchPosts(params);
  }
  if (!posts.length) return null;

  const colClass = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[config.columns] ?? 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <section>
      {config.title && (
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">{config.title}</h2>
        </div>
      )}
      <div className={`grid ${colClass} gap-6`}>
        {posts.map((p: any) => <ArticleCard key={p.id} post={p} size={config.size === 'compact' ? 'compact' : 'default'} />)}
      </div>
    </section>
  );
}

async function LatestIssueSection({ config }: { config: LatestIssueConfig }) {
  const issue = await fetchLatestIssue();
  if (!issue) return null;
  const posts: any[] = config.showPosts ? (issue.posts ?? []).slice(0, config.postCount) : [];

  return (
    <section>
      <div className="flex items-center justify-between border border-border rounded-lg px-5 py-3 bg-muted/40">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary shrink-0" />
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Latest Issue</span>
            <p className="font-semibold text-sm">
              Vol. {issue.volumeNumber}, No. {issue.issueNumber} — {issue.title}
              <span className="text-muted-foreground font-normal ml-2">
                {format(new Date(issue.publishDate), 'MMMM d, yyyy')}
              </span>
            </p>
          </div>
        </div>
        <Link href={`/issues/${issue.id}`} className="flex items-center gap-1 text-sm font-medium text-primary hover:underline shrink-0">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {posts.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
          {posts.map((p: any) => <ArticleCard key={p.id} post={p} size="default" />)}
        </div>
      )}
    </section>
  );
}

async function IssueArticlesSection({ config }: { config: IssueArticlesConfig }) {
  const issue = config.source === 'specific' && config.issueId
    ? await fetchIssueById(config.issueId)
    : await fetchLatestIssue();
  if (!issue?.posts?.length) return null;

  const coverCount = Math.max(0, Math.min(config.coverCount ?? 1, issue.posts.length));
  const covers = issue.posts.slice(0, coverCount);
  const rest = issue.posts.slice(coverCount);
  const colClass = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[config.columns] ?? 'sm:grid-cols-2 lg:grid-cols-4';

  return (
    <section className="space-y-8">
      {covers.map((p: any) => <ArticleCard key={p.id} post={p} size="large" />)}
      {rest.length > 0 && (
        <div className={`grid ${colClass} gap-6`}>
          {rest.map((p: any) => <ArticleCard key={p.id} post={p} size="default" />)}
        </div>
      )}
    </section>
  );
}

function SpacerSection({ config }: { config: SpacerConfig }) {
  return <div style={{ height: config.height }} aria-hidden="true" />;
}

async function CategoryRowSection({ config }: { config: CategoryRowConfig }) {
  if (!config.categorySlug) return null;
  const posts = await fetchPosts({ categorySlug: config.categorySlug, pageSize: config.count });
  if (!posts.length) return null;

  const label = config.label || config.categorySlug;

  if (config.layout === 'featured' && posts.length > 1) {
    return (
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{label}</h2>
          <Link href={`/category/${config.categorySlug}`} className="text-sm text-primary hover:underline flex items-center gap-1">
            More <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ArticleCard post={posts[0]} size="large" />
          </div>
          <div className="space-y-4">
            {posts.slice(1).map((p: any) => <ArticleCard key={p.id} post={p} size="compact" />)}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">{label}</h2>
        <Link href={`/category/${config.categorySlug}`} className="text-sm text-primary hover:underline flex items-center gap-1">
          More <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {posts.map((p: any) => <ArticleCard key={p.id} post={p} size="default" />)}
      </div>
    </section>
  );
}

function DownloadBannerSection({ config }: { config: DownloadBannerConfig }) {
  return (
    <section className="rounded-xl border border-border bg-primary/5 px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold">{config.title}</h2>
        {config.description && <p className="text-muted-foreground mt-1 text-sm">{config.description}</p>}
      </div>
      <Link
        href={config.buttonUrl}
        className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
      >
        <DownloadIcon className="h-4 w-4" />
        {config.buttonLabel}
      </Link>
    </section>
  );
}

function HtmlEmbedSection({ config }: { config: HtmlEmbedConfig }) {
  if (!config.code.trim()) return null;
  return (
    <section dangerouslySetInnerHTML={{ __html: config.code }} />
  );
}

function DividerSection({ config }: { config: DividerConfig }) {
  if (config.label) {
    return (
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest whitespace-nowrap">{config.label}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return <hr className="border-border" />;
}

function ImageBlockSection({ config }: { config: ImageBlockConfig }) {
  if (!config.src) return null;
  const alignClass = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto', full: 'w-full' }[config.align] ?? 'mx-auto';
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={config.src}
      alt={config.alt || ''}
      style={{ maxWidth: config.maxWidth || '100%' }}
      className={`block h-auto rounded-md ${alignClass}`}
    />
  );
  return (
    <figure className="space-y-2">
      {config.linkUrl ? (
        <a href={config.linkUrl} target={config.linkNewTab ? '_blank' : '_self'} rel={config.linkNewTab ? 'noopener noreferrer' : undefined} className="block hover:opacity-90 transition-opacity">
          {img}
        </a>
      ) : img}
      {config.caption && (
        <figcaption className={`text-sm text-muted-foreground text-${config.align === 'full' ? 'center' : config.align}`}>
          {config.caption}
        </figcaption>
      )}
    </figure>
  );
}

function RichTextSection({ config }: { config: RichTextConfig }) {
  if (!config.html) return null;
  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline"
      dangerouslySetInnerHTML={{ __html: config.html }}
    />
  );
}

function HeadingBlockSection({ config }: { config: HeadingBlockConfig }) {
  const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' }[config.align] ?? 'text-left';
  const sizeClass = { 1: 'text-4xl', 2: 'text-2xl', 3: 'text-xl' }[config.level] ?? 'text-2xl';
  const Tag = `h${config.level}` as 'h1' | 'h2' | 'h3';

  const heading = (
    <Tag className={`font-bold leading-tight ${sizeClass} ${alignClass}`}>{config.text}</Tag>
  );

  return (
    <div className={`space-y-1 ${alignClass}`}>
      {config.linkUrl ? (
        <a href={config.linkUrl} target={config.linkNewTab ? '_blank' : '_self'} rel={config.linkNewTab ? 'noopener noreferrer' : undefined} className="hover:opacity-80 transition-opacity">
          {heading}
        </a>
      ) : heading}
      {config.subtext && (
        <p className={`text-muted-foreground ${alignClass}`}>{config.subtext}</p>
      )}
    </div>
  );
}

function ButtonRowSection({ config }: { config: ButtonRowConfig }) {
  const alignClass = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }[config.align] ?? 'justify-start';
  const variantClass = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-border hover:bg-muted text-foreground',
    ghost:   'hover:bg-muted text-foreground',
  };

  return (
    <div className={`flex flex-wrap gap-3 ${alignClass}`}>
      {config.buttons.map((btn, i) => (
        <a
          key={i}
          href={btn.url}
          target={btn.newTab ? '_blank' : '_self'}
          rel={btn.newTab ? 'noopener noreferrer' : undefined}
          className={`inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${variantClass[btn.variant] ?? variantClass.primary}`}
        >
          {btn.label}
        </a>
      ))}
    </div>
  );
}

function FileDownloadsSection({ config }: { config: FileDownloadsConfig }) {
  if (!config.files.length) return null;

  const EXT_COLORS: Record<string, string> = {
    pdf:   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    docx:  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    ppt:   'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    mp4:   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    other: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  const LANG_LABEL: Record<string, string> = { mr: 'मराठी', hi: 'हिंदी', en: 'EN' };

  const colClass = config.layout === 'grid' ? 'grid sm:grid-cols-2 lg:grid-cols-3 gap-3' : 'space-y-2';

  return (
    <section>
      {config.title && <h2 className="text-xl font-bold mb-2">{config.title}</h2>}
      {config.description && <p className="text-muted-foreground text-sm mb-4">{config.description}</p>}
      <div className={colClass}>
        {config.files.map((f, i) => (
          <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" download
            className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 hover:bg-muted transition-colors group">
            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${EXT_COLORS[f.fileType || 'other'] ?? EXT_COLORS.other}`}>
              {f.fileType || 'FILE'}
            </span>
            <span className="flex-1 text-sm font-medium truncate group-hover:underline">{f.label}</span>
            {f.lang && <span className="text-xs text-muted-foreground shrink-0">{LANG_LABEL[f.lang] || f.lang}</span>}
            <DownloadIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          </a>
        ))}
      </div>
    </section>
  );
}

function ImageGallerySection({ config }: { config: ImageGalleryConfig }) {
  if (!config.images.length) return null;
  const colClass = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[config.columns] ?? 'sm:grid-cols-3';

  return (
    <section>
      {config.title && <h2 className="text-xl font-bold mb-4">{config.title}</h2>}
      <div className={`grid ${colClass} gap-3`}>
        {config.images.map((img, i) => {
          const imgEl = (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.src} alt={img.alt || ''} className="aspect-square w-full object-cover rounded-lg" />
          );
          return (
            <figure key={i} className="space-y-1">
              {img.linkUrl ? (
                <a href={img.linkUrl} target={img.linkNewTab ? '_blank' : '_self'} rel={img.linkNewTab ? 'noopener noreferrer' : undefined}
                  className="block hover:opacity-90 transition-opacity">
                  {imgEl}
                </a>
              ) : imgEl}
              {config.showCaptions && img.caption && (
                <figcaption className="text-xs text-muted-foreground text-center">{img.caption}</figcaption>
              )}
            </figure>
          );
        })}
      </div>
    </section>
  );
}

function ColumnNestedSection({ col }: { col: ColumnItem }) {
  if (!col.contentType || col.contentType === 'card' || !col.nestedConfig) return null;
  const cfg = col.nestedConfig;
  switch (col.contentType) {
    case 'hero':            return <HeroSection config={cfg as HeroConfig} /> as React.ReactNode;
    case 'post_grid':       return <PostGridSection config={cfg as PostGridConfig} /> as React.ReactNode;
    case 'latest_issue':    return <LatestIssueSection config={cfg as LatestIssueConfig} /> as React.ReactNode;
    case 'issue_articles':  return <IssueArticlesSection config={cfg as IssueArticlesConfig} /> as React.ReactNode;
    case 'category_row':    return <CategoryRowSection config={cfg as CategoryRowConfig} /> as React.ReactNode;
    case 'download_banner': return <DownloadBannerSection config={cfg as DownloadBannerConfig} />;
    case 'html_embed':      return <HtmlEmbedSection config={cfg as HtmlEmbedConfig} />;
    case 'divider':         return <DividerSection config={cfg as DividerConfig} />;
    case 'spacer':          return <SpacerSection config={cfg as SpacerConfig} />;
    case 'image_block':     return <ImageBlockSection config={cfg as ImageBlockConfig} />;
    case 'rich_text':       return <RichTextSection config={cfg as RichTextConfig} />;
    case 'heading_block':   return <HeadingBlockSection config={cfg as HeadingBlockConfig} />;
    case 'button_row':      return <ButtonRowSection config={cfg as ButtonRowConfig} />;
    case 'file_downloads':  return <FileDownloadsSection config={cfg as FileDownloadsConfig} />;
    case 'image_gallery':   return <ImageGallerySection config={cfg as ImageGalleryConfig} />;
    default:                return null;
  }
}

function ColumnsBlockSection({ config }: { config: ColumnsBlockConfig }) {
  if (!config.columns || config.columns.length === 0) return null;
  const colClass: Record<number, string> = { 1: 'grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 md:grid-cols-3', 4: 'sm:grid-cols-2 md:grid-cols-4' };
  const gridClass = colClass[config.columnsPerRow] ?? 'sm:grid-cols-2';
  const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' }[config.textAlign] ?? 'text-left';
  const variantClass: Record<string, string> = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-border hover:bg-muted text-foreground',
    ghost:   'hover:bg-muted text-foreground',
  };
  return (
    <div className={`grid grid-cols-1 ${gridClass} gap-6 lg:gap-8`}>
      {config.columns.map((col: ColumnItem, i: number) => {
        // Nested block mode
        if (col.contentType && col.contentType !== 'card') {
          return (
            <div key={i} className="flex flex-col min-w-0">
              <ColumnNestedSection col={col} />
            </div>
          );
        }

        // Card mode (default)
        const imgEl = col.imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={col.imageSrc} alt={col.imageAlt || col.title || ''} className="w-full rounded-lg object-cover aspect-video" />
        ) : null;

        return (
          <div key={i} className={`flex flex-col gap-3 ${alignClass}`}>
            {imgEl && (
              col.imageLink ? (
                <a
                  href={col.imageLink}
                  target={col.imageLinkNewTab ? '_blank' : '_self'}
                  rel={col.imageLinkNewTab ? 'noopener noreferrer' : undefined}
                  download={col.imageDownload ? true : undefined}
                  className="block hover:opacity-90 transition-opacity"
                >
                  {imgEl}
                </a>
              ) : imgEl
            )}
            {col.title && <h3 className="font-bold text-lg leading-snug">{col.title}</h3>}
            {col.text && <p className="text-muted-foreground leading-relaxed text-sm">{col.text}</p>}
            {col.buttonLabel && col.buttonUrl && (
              <div className={`mt-auto pt-1 flex ${config.textAlign === 'center' ? 'justify-center' : config.textAlign === 'right' ? 'justify-end' : 'justify-start'}`}>
                <a
                  href={col.buttonUrl}
                  target={col.buttonNewTab ? '_blank' : '_self'}
                  rel={col.buttonNewTab ? 'noopener noreferrer' : undefined}
                  className={`inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${variantClass[col.buttonVariant || 'primary'] ?? variantClass.primary}`}
                >
                  {col.buttonLabel}
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
export async function HomepageSections({ sections }: { sections: Section[] }) {
  return (
    <div className="space-y-12">
      {sections.map((section) => {
        switch (section.type) {
          case 'hero':            return <HeroSection key={section.id} config={section.config as HeroConfig} />;
          case 'post_grid':       return <PostGridSection key={section.id} config={section.config as PostGridConfig} />;
          case 'latest_issue':    return <LatestIssueSection key={section.id} config={section.config as LatestIssueConfig} />;
          case 'issue_articles':  return <IssueArticlesSection key={section.id} config={section.config as IssueArticlesConfig} />;
          case 'category_row':    return <CategoryRowSection key={section.id} config={section.config as CategoryRowConfig} />;
          case 'download_banner': return <DownloadBannerSection key={section.id} config={section.config as DownloadBannerConfig} />;
          case 'html_embed':      return <HtmlEmbedSection key={section.id} config={section.config as HtmlEmbedConfig} />;
          case 'divider':         return <DividerSection key={section.id} config={section.config as DividerConfig} />;
          case 'spacer':          return <SpacerSection key={section.id} config={section.config as SpacerConfig} />;
          case 'image_block':     return <ImageBlockSection key={section.id} config={section.config as ImageBlockConfig} />;
          case 'rich_text':       return <RichTextSection key={section.id} config={section.config as RichTextConfig} />;
          case 'heading_block':   return <HeadingBlockSection key={section.id} config={section.config as HeadingBlockConfig} />;
          case 'button_row':      return <ButtonRowSection key={section.id} config={section.config as ButtonRowConfig} />;
          case 'file_downloads':  return <FileDownloadsSection key={section.id} config={section.config as FileDownloadsConfig} />;
          case 'image_gallery':   return <ImageGallerySection key={section.id} config={section.config as ImageGalleryConfig} />;
          case 'columns_block':   return <ColumnsBlockSection key={section.id} config={section.config as ColumnsBlockConfig} />;
          default:                return null;
        }
      })}
    </div>
  );
}
