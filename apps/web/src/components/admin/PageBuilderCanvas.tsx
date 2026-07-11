'use client';
import { useState, useCallback, useId } from 'react';
import {
  DndContext, DragOverlay, closestCenter,
  KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, arrayMove, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, X, Plus, Save, LayoutTemplate, Grid3X3, Newspaper,
  AlignJustify, Download, Code, Minus, ImageIcon, Type, Heading,
  MousePointerClick, Trash2, AlignLeft, AlignCenter, AlignRight,
  ExternalLink, ChevronUp, ChevronDown, BookOpen, ArrowRight,
  Monitor, Tablet, Smartphone, ArrowLeft, Settings2, Columns2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import {
  type Section, type SectionType, type SectionConfig,
  type HeroConfig, type PostGridConfig, type LatestIssueConfig,
  type CategoryRowConfig, type DownloadBannerConfig, type HtmlEmbedConfig,
  type DividerConfig, type ImageBlockConfig, type RichTextConfig,
  type HeadingBlockConfig, type ButtonRowConfig, type ButtonDef,
  type FileDownloadsConfig, type FileItem, type ImageGalleryConfig, type GalleryImage,
  type ColumnsBlockConfig, type ColumnItem, type ColumnContentType,
  SECTION_META, createSection, defaultConfig,
} from '@/lib/page-builder';

export interface Category { id: string; name: string; slug: string }

// ─── Block palette meta ────────────────────────────────────────────────────────
const SECTION_ICONS: Record<SectionType, React.ReactNode> = {
  hero:            <LayoutTemplate className="h-4 w-4" />,
  post_grid:       <Grid3X3 className="h-4 w-4" />,
  latest_issue:    <Newspaper className="h-4 w-4" />,
  category_row:    <AlignJustify className="h-4 w-4" />,
  download_banner: <Download className="h-4 w-4" />,
  html_embed:      <Code className="h-4 w-4" />,
  divider:         <Minus className="h-4 w-4" />,
  image_block:     <ImageIcon className="h-4 w-4" />,
  rich_text:       <Type className="h-4 w-4" />,
  heading_block:   <Heading className="h-4 w-4" />,
  button_row:      <MousePointerClick className="h-4 w-4" />,
  file_downloads:  <Download className="h-4 w-4" />,
  image_gallery:   <Grid3X3 className="h-4 w-4" />,
  columns_block:   <Columns2 className="h-4 w-4" />,
};

const PALETTE_GROUPS = [
  { label: 'CMS Blocks', types: ['hero', 'post_grid', 'latest_issue', 'category_row'] as SectionType[] },
  { label: 'Content',    types: ['heading_block', 'rich_text', 'image_block', 'button_row', 'columns_block'] as SectionType[] },
  { label: 'Layout',     types: ['download_banner', 'divider', 'html_embed'] as SectionType[] },
  { label: 'Media',      types: ['file_downloads', 'image_gallery'] as SectionType[] },
];

// ─── Skeleton primitives ───────────────────────────────────────────────────────
function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-muted animate-pulse ${className}`} />;
}
function SkeletonCard() {
  return (
    <div className="space-y-2">
      <SkeletonBox className="aspect-[16/10] w-full" />
      <SkeletonBox className="h-3 w-2/3" />
      <SkeletonBox className="h-2.5 w-full" />
      <SkeletonBox className="h-2.5 w-4/5" />
    </div>
  );
}
function SkeletonCompactCard() {
  return (
    <div className="flex gap-2.5">
      <SkeletonBox className="h-14 w-20 shrink-0" />
      <div className="flex-1 space-y-1.5 pt-0.5">
        <SkeletonBox className="h-2.5 w-full" />
        <SkeletonBox className="h-2.5 w-4/5" />
        <SkeletonBox className="h-2 w-1/3" />
      </div>
    </div>
  );
}

// ─── Visual previews ───────────────────────────────────────────────────────────
function HeroPreview({ config }: { config: HeroConfig }) {
  const sourceLabel = config.source === 'category' ? `Category: ${config.categorySlug || '…'}` : config.source === 'latest_issue' ? 'Latest Issue' : 'Latest Posts';
  const heroCount = config.heroCount ?? 1;
  const sidebarCount = config.sidebarCount ?? 3;
  if (config.layout === 'single') {
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{sourceLabel} · {heroCount} hero article{heroCount > 1 ? 's' : ''}</p>
        {Array.from({ length: heroCount }).map((_, i) => (
          <div key={i} className="space-y-1">
            <SkeletonBox className="aspect-[21/9] w-full" />
            <SkeletonBox className="h-6 w-3/4 mt-1" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{sourceLabel} · {heroCount} hero + {sidebarCount} sidebar</p>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-3">
          {Array.from({ length: heroCount }).map((_, i) => (
            <div key={i} className="space-y-1">
              <SkeletonBox className="aspect-[16/10] w-full" />
              <SkeletonBox className="h-5 w-3/4" />
            </div>
          ))}
        </div>
        <div className="space-y-4">{Array.from({ length: Math.min(sidebarCount, 4) }).map((_, i) => <SkeletonCard key={i} />)}</div>
      </div>
    </div>
  );
}

function PostGridPreview({ config }: { config: PostGridConfig }) {
  const colClass = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[config.columns] ?? 'grid-cols-4';
  const cards = Array.from({ length: Math.min(config.count, config.columns * 2) });
  return (
    <div className="space-y-3">
      {config.title && <p className="font-bold text-base">{config.title}</p>}
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">{config.source}{config.slug ? `: ${config.slug}` : ''} · {config.count} posts · {config.columns} cols</p>
      <div className={`grid ${colClass} gap-4`}>
        {cards.map((_, i) => config.size === 'compact' ? <SkeletonCompactCard key={i} /> : <SkeletonCard key={i} />)}
      </div>
    </div>
  );
}

function LatestIssuePreview({ config }: { config: LatestIssueConfig }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border border-border rounded-lg px-5 py-3 bg-muted/40">
        <div className="flex items-center gap-3">
          <BookOpen className="h-5 w-5 text-primary shrink-0" />
          <div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Latest Issue</span>
            <p className="font-semibold text-sm">Vol. XX, No. XX — Issue Title</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-sm font-medium text-primary shrink-0">View all <ArrowRight className="h-3.5 w-3.5" /></span>
      </div>
      {config.showPosts && (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: Math.min(config.postCount, 4) }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}
    </div>
  );
}

function CategoryRowPreview({ config }: { config: CategoryRowConfig }) {
  const label = config.label || config.categorySlug || 'Category';
  if (config.layout === 'featured') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between"><p className="font-bold text-xl">{label}</p><span className="text-sm text-primary">More →</span></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2"><SkeletonCard /></div>
          <div className="space-y-3">{Array.from({ length: Math.min(config.count - 1, 3) }).map((_, i) => <SkeletonCompactCard key={i} />)}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between"><p className="font-bold text-xl">{label}</p><span className="text-sm text-primary">More →</span></div>
      <div className="grid grid-cols-4 gap-4">{Array.from({ length: Math.min(config.count, 4) }).map((_, i) => <SkeletonCard key={i} />)}</div>
    </div>
  );
}

function DownloadBannerPreview({ config }: { config: DownloadBannerConfig }) {
  return (
    <div className="rounded-xl border border-border bg-primary/5 px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div>
        <h2 className="text-xl font-bold">{config.title || 'Banner Title'}</h2>
        {config.description && <p className="text-muted-foreground mt-1 text-sm">{config.description}</p>}
      </div>
      <div className="shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
        <Download className="h-4 w-4" />{config.buttonLabel || 'Download'}
      </div>
    </div>
  );
}

function HtmlEmbedPreview({ config }: { config: HtmlEmbedConfig }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-4 bg-muted/20 text-center">
      <Code className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
      <p className="text-sm font-medium text-muted-foreground">{config.label || 'HTML Embed'}</p>
      {config.code && <p className="text-xs text-muted-foreground/60 mt-1 font-mono truncate max-w-xs mx-auto">{config.code.slice(0, 80)}</p>}
    </div>
  );
}

function DividerPreview({ config }: { config: DividerConfig }) {
  if (config.label) {
    return (
      <div className="flex items-center gap-4 py-1">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{config.label}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return <hr className="border-border" />;
}

function ImageBlockPreview({ config }: { config: ImageBlockConfig }) {
  const alignClass = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto', full: 'w-full' }[config.align] ?? 'mx-auto';
  if (!config.src) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg flex items-center justify-center h-40 bg-muted/20">
        <div className="text-center text-muted-foreground"><ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-40" /><p className="text-xs">No image URL set</p></div>
      </div>
    );
  }
  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={config.src} alt={config.alt || ''} style={{ maxWidth: config.maxWidth || '100%' }} className={`block h-auto rounded-md ${alignClass}`} />
      {config.caption && <figcaption className="text-sm text-muted-foreground text-center">{config.caption}</figcaption>}
    </figure>
  );
}

function RichTextPreview({ config }: { config: RichTextConfig }) {
  if (!config.html || config.html === '<p></p>') {
    return (
      <div className="border-2 border-dashed border-border rounded-lg flex items-center justify-center h-20 bg-muted/20">
        <p className="text-xs text-muted-foreground">Empty rich text — click Edit to write content</p>
      </div>
    );
  }
  return <div className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline pointer-events-none" dangerouslySetInnerHTML={{ __html: config.html }} />;
}

function HeadingPreview({ config }: { config: HeadingBlockConfig }) {
  const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' }[config.align] ?? 'text-left';
  const sizeClass = { 1: 'text-4xl', 2: 'text-2xl', 3: 'text-xl' }[config.level] ?? 'text-2xl';
  const Tag = `h${config.level}` as 'h1' | 'h2' | 'h3';
  return (
    <div className={`space-y-1 ${alignClass}`}>
      <Tag className={`font-bold leading-tight ${sizeClass}`}>{config.text || 'Heading'}</Tag>
      {config.subtext && <p className="text-muted-foreground">{config.subtext}</p>}
      {config.linkUrl && <p className="text-xs text-primary opacity-70">↗ {config.linkUrl}</p>}
    </div>
  );
}

function ButtonRowPreview({ config }: { config: ButtonRowConfig }) {
  const alignClass = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }[config.align] ?? 'justify-start';
  const variantClass = { primary: 'bg-primary text-primary-foreground', outline: 'border border-border text-foreground', ghost: 'text-foreground' };
  return (
    <div className={`flex flex-wrap gap-3 ${alignClass}`}>
      {config.buttons.map((btn, i) => (
        <span key={i} className={`inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold ${variantClass[btn.variant] ?? variantClass.primary}`}>
          {btn.label}{btn.newTab && <ExternalLink className="h-3 w-3 ml-1.5 opacity-60" />}
        </span>
      ))}
    </div>
  );
}

function FileDownloadsPreview({ config }: { config: FileDownloadsConfig }) {
  const EXT_COLORS: Record<string, string> = { pdf: 'bg-red-100 text-red-700', docx: 'bg-blue-100 text-blue-700', ppt: 'bg-orange-100 text-orange-700', mp4: 'bg-purple-100 text-purple-700', other: 'bg-slate-100 text-slate-700' };
  return (
    <div className="space-y-3">
      {config.title && <p className="font-bold text-base">{config.title}</p>}
      {config.files.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-lg flex items-center justify-center h-20 bg-muted/20"><p className="text-xs text-muted-foreground">No files added yet</p></div>
      ) : (
        <div className={config.layout === 'grid' ? 'grid grid-cols-3 gap-2' : 'space-y-2'}>
          {config.files.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 p-2 rounded-md border border-border bg-muted/20">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${EXT_COLORS[f.fileType || 'other'] ?? EXT_COLORS.other}`}>{f.fileType || 'FILE'}</span>
              <span className="text-sm truncate flex-1">{f.label || 'File'}</span>
              {f.lang && <span className="text-[10px] text-muted-foreground shrink-0 uppercase">{f.lang}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ImageGalleryPreview({ config }: { config: ImageGalleryConfig }) {
  const colClass = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[config.columns] ?? 'grid-cols-3';
  return (
    <div className="space-y-3">
      {config.title && <p className="font-bold text-base">{config.title}</p>}
      {config.images.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-lg flex items-center justify-center h-24 bg-muted/20"><p className="text-xs text-muted-foreground">No images added yet</p></div>
      ) : (
        <div className={`grid ${colClass} gap-2`}>
          {config.images.map((img, i) => (
            <figure key={i} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={img.alt || ''} className="aspect-square object-cover rounded-md w-full border border-border" />
              {config.showCaptions && img.caption && <figcaption className="text-xs text-muted-foreground text-center truncate">{img.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}

function ColumnsBlockPreview({ config }: { config: ColumnsBlockConfig }) {
  const colClass = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[config.columnsPerRow] ?? 'grid-cols-2';
  const alignClass = { left: 'text-left', center: 'text-center', right: 'text-right' }[config.textAlign] ?? 'text-left';
  return (
    <div className={`grid ${colClass} gap-4`}>
      {config.columns.map((col, i) => {
        if (col.contentType && col.contentType !== 'card') {
          const meta = SECTION_META[col.contentType];
          const icon = SECTION_ICONS[col.contentType];
          return (
            <div key={i} className="rounded-md border border-dashed border-border bg-muted/20 p-3 space-y-1.5">
              <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium ${meta.color}`}>
                {icon} {meta.label}
              </div>
              <p className="text-[10px] text-muted-foreground/70 leading-snug">{meta.description}</p>
            </div>
          );
        }
        return (
          <div key={i} className={`space-y-2 ${alignClass}`}>
            {col.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={col.imageSrc} alt={col.imageAlt || ''} className="w-full aspect-video object-cover rounded-md border border-border" />
            ) : (
              <div className="w-full aspect-video rounded-md border-2 border-dashed border-border bg-muted/20 flex items-center justify-center">
                <ImageIcon className="h-5 w-5 text-muted-foreground/30" />
              </div>
            )}
            {col.title && <p className="font-semibold text-sm">{col.title}</p>}
            {col.text && <p className="text-xs text-muted-foreground line-clamp-3">{col.text}</p>}
            {col.buttonLabel && (
              <span className="inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold bg-primary text-primary-foreground">{col.buttonLabel}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionPreview({ section }: { section: Section }) {
  switch (section.type) {
    case 'hero':            return <HeroPreview config={section.config as HeroConfig} />;
    case 'post_grid':       return <PostGridPreview config={section.config as PostGridConfig} />;
    case 'latest_issue':    return <LatestIssuePreview config={section.config as LatestIssueConfig} />;
    case 'category_row':    return <CategoryRowPreview config={section.config as CategoryRowConfig} />;
    case 'download_banner': return <DownloadBannerPreview config={section.config as DownloadBannerConfig} />;
    case 'html_embed':      return <HtmlEmbedPreview config={section.config as HtmlEmbedConfig} />;
    case 'divider':         return <DividerPreview config={section.config as DividerConfig} />;
    case 'image_block':     return <ImageBlockPreview config={section.config as ImageBlockConfig} />;
    case 'rich_text':       return <RichTextPreview config={section.config as RichTextConfig} />;
    case 'heading_block':   return <HeadingPreview config={section.config as HeadingBlockConfig} />;
    case 'button_row':      return <ButtonRowPreview config={section.config as ButtonRowConfig} />;
    case 'file_downloads':  return <FileDownloadsPreview config={section.config as FileDownloadsConfig} />;
    case 'image_gallery':   return <ImageGalleryPreview config={section.config as ImageGalleryConfig} />;
    case 'columns_block':   return <ColumnsBlockPreview config={section.config as ColumnsBlockConfig} />;
    default:                return null;
  }
}

// ─── Visual sortable section ───────────────────────────────────────────────────
interface VisualSectionProps {
  section: Section; isSelected: boolean; isFirst: boolean; isLast: boolean; isDragging: boolean;
  onSelect: () => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}

function VisualSection({ section, isSelected, isFirst, isLast, isDragging, onSelect, onRemove, onMoveUp, onMoveDown }: VisualSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const meta = SECTION_META[section.type];
  const icon = SECTION_ICONS[section.type];
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div onClick={onSelect} className={`relative rounded-xl border-2 transition-all cursor-pointer px-6 py-5 ${isSelected ? 'border-primary shadow-[0_0_0_4px] shadow-primary/10' : 'border-transparent hover:border-muted-foreground/20 hover:shadow-sm'}`}>
        <div className={`absolute -top-px left-4 right-4 flex items-center justify-between transition-opacity z-10 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
          <div className="flex items-center gap-1">
            <button {...attributes} {...listeners} type="button" onClick={(e) => e.stopPropagation()}
              className={`cursor-grab active:cursor-grabbing flex items-center gap-1.5 px-2 py-0.5 rounded-b-md text-xs font-medium border-x border-b touch-none ${meta.color}`} title="Drag to reorder">
              <GripVertical className="h-3 w-3" />{icon}{meta.label}
            </button>
          </div>
          <div className="flex items-center gap-0.5 bg-background border border-border rounded-b-md px-1 py-0.5 shadow-sm">
            <button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground hover:text-foreground transition-colors" title="Move up"><ChevronUp className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} className="p-1 rounded hover:bg-muted disabled:opacity-30 text-muted-foreground hover:text-foreground transition-colors" title="Move down"><ChevronDown className="h-3.5 w-3.5" /></button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Remove section"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="pointer-events-none select-none"><SectionPreview section={section} /></div>
      </div>
    </div>
  );
}

// ─── Insert-between button ─────────────────────────────────────────────────────
function InsertButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="flex items-center gap-2 group/insert py-1">
      <div className="h-px flex-1 bg-border/50 group-hover/insert:bg-primary/30 transition-colors" />
      <button type="button" onClick={onClick} className="flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-dashed border-border text-muted-foreground text-xs hover:border-primary hover:text-primary hover:bg-primary/5 transition-all opacity-0 group-hover/insert:opacity-100">
        <Plus className="h-3 w-3" /> Add block
      </button>
      <div className="h-px flex-1 bg-border/50 group-hover/insert:bg-primary/30 transition-colors" />
    </div>
  );
}

// ─── Config form helpers ───────────────────────────────────────────────────────
function LinkFields({ url, newTab, onChange }: { url: string; newTab?: boolean; onChange: (url: string, newTab: boolean) => void }) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3 bg-muted/30">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Hyperlink</p>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">URL</Label>
        <Input className="h-8 text-sm" placeholder="/page-slug or https://..." value={url} onChange={(e) => onChange(e.target.value, newTab ?? false)} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="link-newtab" checked={!!newTab} onChange={(e) => onChange(url, e.target.checked)} className="h-4 w-4 rounded" />
        <Label htmlFor="link-newtab" className="text-xs font-medium cursor-pointer flex items-center gap-1"><ExternalLink className="h-3 w-3" /> Open in new tab</Label>
      </div>
    </div>
  );
}

function AlignControl({ value, onChange }: { value: 'left' | 'center' | 'right'; onChange: (v: 'left' | 'center' | 'right') => void }) {
  return (
    <div className="flex gap-1">
      {(['left', 'center', 'right'] as const).map((a) => {
        const icons = { left: <AlignLeft className="h-3.5 w-3.5" />, center: <AlignCenter className="h-3.5 w-3.5" />, right: <AlignRight className="h-3.5 w-3.5" /> };
        return (
          <button key={a} type="button" onClick={() => onChange(a)} className={`p-1.5 rounded border transition-colors ${value === a ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>{icons[a]}</button>
        );
      })}
    </div>
  );
}

function CategorySelect({ value, onChange, categories, placeholder = 'Choose category' }: { value: string; onChange: (slug: string) => void; categories: Category[]; placeholder?: string }) {
  if (categories.length === 0) {
    return <Input className="h-8 text-sm" placeholder="category-slug" value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">— {placeholder} —</SelectItem>
        {categories.map((c) => <SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

// ─── Config forms ──────────────────────────────────────────────────────────────
function HeroConfigForm({ config, onChange, categories }: { config: HeroConfig; onChange: (c: HeroConfig) => void; categories: Category[] }) {
  const heroCount = config.heroCount ?? 1;
  const sidebarCount = config.sidebarCount ?? 3;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Post Source</Label>
        <Select value={config.source} onValueChange={(v) => onChange({ ...config, source: v as HeroConfig['source'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="latest_issue">Latest Issue Posts</SelectItem>
            <SelectItem value="latest">Latest Published</SelectItem>
            <SelectItem value="category">Specific Category</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {config.source === 'category' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Category</Label>
          <CategorySelect value={config.categorySlug || ''} onChange={(slug) => onChange({ ...config, categorySlug: slug })} categories={categories} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Layout</Label>
        <Select value={config.layout} onValueChange={(v) => onChange({ ...config, layout: v as HeroConfig['layout'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="split">Split (hero + sidebar cards)</SelectItem>
            <SelectItem value="single">Single hero only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Hero articles</Label>
          <Input type="number" min={1} max={5} className="h-8 text-sm" value={heroCount}
            onChange={(e) => onChange({ ...config, heroCount: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
        </div>
        {config.layout === 'split' && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Sidebar articles</Label>
            <Input type="number" min={0} max={6} className="h-8 text-sm" value={sidebarCount}
              onChange={(e) => onChange({ ...config, sidebarCount: Math.max(0, Math.min(6, Number(e.target.value) || 0)) })} />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="hero-excerpt" checked={config.showExcerpt} onChange={(e) => onChange({ ...config, showExcerpt: e.target.checked })} className="h-4 w-4 rounded" />
        <Label htmlFor="hero-excerpt" className="text-xs font-medium cursor-pointer">Show excerpt</Label>
      </div>
    </div>
  );
}

function PostGridConfigForm({ config, onChange, categories }: { config: PostGridConfig; onChange: (c: PostGridConfig) => void; categories: Category[] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs font-medium">Section Title</Label><Input className="h-8 text-sm" placeholder="e.g. Recent Articles" value={config.title || ''} onChange={(e) => onChange({ ...config, title: e.target.value })} /></div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Source</Label>
        <Select value={config.source} onValueChange={(v) => onChange({ ...config, source: v as PostGridConfig['source'], slug: '' })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest Published</SelectItem>
            <SelectItem value="featured">Featured Posts</SelectItem>
            <SelectItem value="category">By Category</SelectItem>
            <SelectItem value="tag">By Tag</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {config.source === 'category' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Category</Label>
          <CategorySelect value={config.slug || ''} onChange={(slug) => onChange({ ...config, slug })} categories={categories} />
        </div>
      )}
      {config.source === 'tag' && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Tag Slug</Label>
          <Input className="h-8 text-sm" placeholder="e.g. sports" value={config.slug || ''} onChange={(e) => onChange({ ...config, slug: e.target.value })} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Count</Label>
          <Select value={String(config.count)} onValueChange={(v) => onChange({ ...config, count: Number(v) })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{[3, 4, 6, 8, 12].map((n) => <SelectItem key={n} value={String(n)}>{n} posts</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Columns</Label>
          <Select value={String(config.columns)} onValueChange={(v) => onChange({ ...config, columns: Number(v) as 2|3|4 })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="2">2 columns</SelectItem><SelectItem value="3">3 columns</SelectItem><SelectItem value="4">4 columns</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Card Size</Label>
        <Select value={config.size} onValueChange={(v) => onChange({ ...config, size: v as PostGridConfig['size'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="default">Default (image + text)</SelectItem><SelectItem value="compact">Compact (thumbnail)</SelectItem></SelectContent>
        </Select>
      </div>
    </div>
  );
}

function LatestIssueConfigForm({ config, onChange }: { config: LatestIssueConfig; onChange: (c: LatestIssueConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input type="checkbox" id="li-posts" checked={config.showPosts} onChange={(e) => onChange({ ...config, showPosts: e.target.checked })} className="h-4 w-4 rounded" />
        <Label htmlFor="li-posts" className="text-xs font-medium cursor-pointer">Show posts below banner</Label>
      </div>
      {config.showPosts && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Post Count</Label>
          <Select value={String(config.postCount)} onValueChange={(v) => onChange({ ...config, postCount: Number(v) })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{[3,4,5,6,8].map((n) => <SelectItem key={n} value={String(n)}>{n} posts</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function CategoryRowConfigForm({ config, onChange, categories }: { config: CategoryRowConfig; onChange: (c: CategoryRowConfig) => void; categories: Category[] }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Category</Label>
        <CategorySelect value={config.categorySlug} onChange={(slug) => onChange({ ...config, categorySlug: slug })} categories={categories} />
      </div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">Display Label (optional)</Label><Input className="h-8 text-sm" placeholder="Leave blank for category name" value={config.label || ''} onChange={(e) => onChange({ ...config, label: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Count</Label>
          <Select value={String(config.count)} onValueChange={(v) => onChange({ ...config, count: Number(v) })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>{[3,4,5,6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Layout</Label>
          <Select value={config.layout} onValueChange={(v) => onChange({ ...config, layout: v as CategoryRowConfig['layout'] })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="row">Equal row</SelectItem><SelectItem value="featured">Featured + small</SelectItem></SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function DownloadBannerConfigForm({ config, onChange }: { config: DownloadBannerConfig; onChange: (c: DownloadBannerConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs font-medium">Title</Label><Input className="h-8 text-sm" value={config.title} onChange={(e) => onChange({ ...config, title: e.target.value })} /></div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">Description</Label><Textarea className="text-sm min-h-[60px]" value={config.description || ''} onChange={(e) => onChange({ ...config, description: e.target.value })} /></div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">Button Label</Label><Input className="h-8 text-sm" value={config.buttonLabel} onChange={(e) => onChange({ ...config, buttonLabel: e.target.value })} /></div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">Button URL</Label><Input className="h-8 text-sm" placeholder="/issues or https://..." value={config.buttonUrl} onChange={(e) => onChange({ ...config, buttonUrl: e.target.value })} /></div>
    </div>
  );
}

function HtmlEmbedConfigForm({ config, onChange }: { config: HtmlEmbedConfig; onChange: (c: HtmlEmbedConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs font-medium">Label</Label><Input className="h-8 text-sm" placeholder="Newsletter Widget" value={config.label || ''} onChange={(e) => onChange({ ...config, label: e.target.value })} /></div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">HTML Code</Label><Textarea className="text-xs font-mono min-h-[160px]" value={config.code} onChange={(e) => onChange({ ...config, code: e.target.value })} /></div>
    </div>
  );
}

function DividerConfigForm({ config, onChange }: { config: DividerConfig; onChange: (c: DividerConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs font-medium">Label (optional)</Label><Input className="h-8 text-sm" placeholder="e.g. More from this week" value={config.label || ''} onChange={(e) => onChange({ ...config, label: e.target.value })} /></div>
    </div>
  );
}

function ImageBlockConfigForm({ config, onChange }: { config: ImageBlockConfig; onChange: (c: ImageBlockConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Image URL</Label>
        <Input className="h-8 text-sm" placeholder="https://… or /s3/…" value={config.src} onChange={(e) => onChange({ ...config, src: e.target.value })} />
        {config.src && <img src={config.src} alt="" className="mt-2 rounded-md max-h-32 object-contain border border-border" />}
      </div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">Alt Text</Label><Input className="h-8 text-sm" value={config.alt || ''} onChange={(e) => onChange({ ...config, alt: e.target.value })} /></div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">Caption</Label><Input className="h-8 text-sm" value={config.caption || ''} onChange={(e) => onChange({ ...config, caption: e.target.value })} /></div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">Max Width</Label><Input className="h-8 text-sm" placeholder="100% or 600px" value={config.maxWidth || '100%'} onChange={(e) => onChange({ ...config, maxWidth: e.target.value })} /></div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Alignment</Label>
        <Select value={config.align} onValueChange={(v) => onChange({ ...config, align: v as ImageBlockConfig['align'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem><SelectItem value="full">Full width</SelectItem></SelectContent>
        </Select>
      </div>
      <LinkFields url={config.linkUrl || ''} newTab={config.linkNewTab} onChange={(linkUrl, linkNewTab) => onChange({ ...config, linkUrl, linkNewTab })} />
    </div>
  );
}

function RichTextConfigForm({ config, onChange }: { config: RichTextConfig; onChange: (c: RichTextConfig) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Content</Label>
      <p className="text-[11px] text-muted-foreground">Use the toolbar to add links, bold, headings, etc.</p>
      <RichTextEditor value={config.html} onChange={(html) => onChange({ ...config, html })} className="min-h-[200px] text-sm" />
    </div>
  );
}

function HeadingBlockConfigForm({ config, onChange }: { config: HeadingBlockConfig; onChange: (c: HeadingBlockConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs font-medium">Heading Text</Label><Input className="h-8 text-sm" value={config.text} onChange={(e) => onChange({ ...config, text: e.target.value })} /></div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">Subtext</Label><Input className="h-8 text-sm" placeholder="Optional subtitle" value={config.subtext || ''} onChange={(e) => onChange({ ...config, subtext: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Level</Label>
          <Select value={String(config.level)} onValueChange={(v) => onChange({ ...config, level: Number(v) as 1|2|3 })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1">H1 — Page title</SelectItem><SelectItem value="2">H2 — Section</SelectItem><SelectItem value="3">H3 — Sub-section</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Alignment</Label>
          <AlignControl value={config.align} onChange={(align) => onChange({ ...config, align })} />
        </div>
      </div>
      <LinkFields url={config.linkUrl || ''} newTab={config.linkNewTab} onChange={(linkUrl, linkNewTab) => onChange({ ...config, linkUrl, linkNewTab })} />
    </div>
  );
}

function ButtonRowConfigForm({ config, onChange }: { config: ButtonRowConfig; onChange: (c: ButtonRowConfig) => void }) {
  const updateButton = (i: number, patch: Partial<ButtonDef>) => onChange({ ...config, buttons: config.buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b) });
  const addButton = () => { if (config.buttons.length < 3) onChange({ ...config, buttons: [...config.buttons, { label: 'Button', url: '/', variant: 'outline', newTab: false }] }); };
  const removeButton = (i: number) => onChange({ ...config, buttons: config.buttons.filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs font-medium">Row Alignment</Label><AlignControl value={config.align} onChange={(align) => onChange({ ...config, align })} /></div>
      <div className="space-y-3">
        {config.buttons.map((btn, i) => (
          <div key={i} className="rounded-md border border-border p-3 space-y-2.5 bg-muted/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Button {i + 1}</p>
              <button type="button" onClick={() => removeButton(i)} disabled={config.buttons.length <= 1} className="p-1 rounded text-muted-foreground hover:text-destructive disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Label</Label><Input className="h-7 text-sm" value={btn.label} onChange={(e) => updateButton(i, { label: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">URL</Label><Input className="h-7 text-sm" placeholder="/page or https://..." value={btn.url} onChange={(e) => updateButton(i, { url: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Style</Label>
                <Select value={btn.variant} onValueChange={(v) => updateButton(i, { variant: v as ButtonDef['variant'] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="primary">Primary</SelectItem><SelectItem value="outline">Outline</SelectItem><SelectItem value="ghost">Ghost</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={!!btn.newTab} onChange={(e) => updateButton(i, { newTab: e.target.checked })} className="h-3.5 w-3.5 rounded" />
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5"><ExternalLink className="h-3 w-3" /> New tab</span>
                </label>
              </div>
            </div>
          </div>
        ))}
        {config.buttons.length < 3 && (
          <button type="button" onClick={addButton} className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center justify-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add button
          </button>
        )}
      </div>
    </div>
  );
}

function FileDownloadsConfigForm({ config, onChange }: { config: FileDownloadsConfig; onChange: (c: FileDownloadsConfig) => void }) {
  const updateFile = (i: number, patch: Partial<FileItem>) => onChange({ ...config, files: config.files.map((f, idx) => idx === i ? { ...f, ...patch } : f) });
  const addFile = () => onChange({ ...config, files: [...config.files, { label: '', url: '', lang: '', fileType: 'pdf' }] });
  const removeFile = (i: number) => onChange({ ...config, files: config.files.filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs font-medium">Section Title</Label><Input className="h-8 text-sm" placeholder="Downloads" value={config.title || ''} onChange={(e) => onChange({ ...config, title: e.target.value })} /></div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">Description</Label><Input className="h-8 text-sm" placeholder="Optional description" value={config.description || ''} onChange={(e) => onChange({ ...config, description: e.target.value })} /></div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Layout</Label>
        <Select value={config.layout} onValueChange={(v) => onChange({ ...config, layout: v as FileDownloadsConfig['layout'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="list">List</SelectItem><SelectItem value="grid">Grid (3 columns)</SelectItem></SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium">Files</Label>
        {config.files.map((f, i) => (
          <div key={i} className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted-foreground">File {i + 1}</p><button type="button" onClick={() => removeFile(i)} className="p-1 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div>
            <div className="space-y-1.5"><Label className="text-xs">Label</Label><Input className="h-7 text-sm" placeholder="Document name" value={f.label} onChange={(e) => updateFile(i, { label: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">URL</Label><Input className="h-7 text-sm" placeholder="/s3/... or https://..." value={f.url} onChange={(e) => updateFile(i, { url: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select value={f.fileType || 'other'} onValueChange={(v) => updateFile(i, { fileType: v as FileItem['fileType'] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="pdf">PDF</SelectItem><SelectItem value="docx">DOCX</SelectItem><SelectItem value="ppt">PPT</SelectItem><SelectItem value="mp4">MP4</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Language</Label>
                <Select value={f.lang || ''} onValueChange={(v) => updateFile(i, { lang: v as FileItem['lang'] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                  <SelectContent><SelectItem value="">Any</SelectItem><SelectItem value="mr">Marathi</SelectItem><SelectItem value="hi">Hindi</SelectItem><SelectItem value="en">English</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={addFile} className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center justify-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add file</button>
      </div>
    </div>
  );
}

function ImageGalleryConfigForm({ config, onChange }: { config: ImageGalleryConfig; onChange: (c: ImageGalleryConfig) => void }) {
  const updateImage = (i: number, patch: Partial<GalleryImage>) => onChange({ ...config, images: config.images.map((img, idx) => idx === i ? { ...img, ...patch } : img) });
  const addImage = () => onChange({ ...config, images: [...config.images, { src: '', alt: '', caption: '' }] });
  const removeImage = (i: number) => onChange({ ...config, images: config.images.filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs font-medium">Gallery Title</Label><Input className="h-8 text-sm" placeholder="Optional title" value={config.title || ''} onChange={(e) => onChange({ ...config, title: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Columns</Label>
          <Select value={String(config.columns)} onValueChange={(v) => onChange({ ...config, columns: Number(v) as 2|3|4 })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="2">2 columns</SelectItem><SelectItem value="3">3 columns</SelectItem><SelectItem value="4">4 columns</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 flex flex-col justify-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={config.showCaptions} onChange={(e) => onChange({ ...config, showCaptions: e.target.checked })} className="h-4 w-4 rounded" />
            <span className="text-xs font-medium">Show captions</span>
          </label>
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-xs font-medium">Images</Label>
        {config.images.map((img, i) => (
          <div key={i} className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold text-muted-foreground">Image {i + 1}</p><button type="button" onClick={() => removeImage(i)} className="p-1 rounded text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Image URL</Label>
              <Input className="h-7 text-sm" placeholder="/s3/... or https://..." value={img.src} onChange={(e) => updateImage(i, { src: e.target.value })} />
              {img.src && <img src={img.src} alt="" className="mt-1 rounded max-h-20 object-cover border border-border" />}
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Alt Text</Label><Input className="h-7 text-sm" value={img.alt || ''} onChange={(e) => updateImage(i, { alt: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">Caption</Label><Input className="h-7 text-sm" value={img.caption || ''} onChange={(e) => updateImage(i, { caption: e.target.value })} /></div>
            <LinkFields url={img.linkUrl || ''} newTab={img.linkNewTab} onChange={(linkUrl, linkNewTab) => updateImage(i, { linkUrl, linkNewTab })} />
          </div>
        ))}
        <button type="button" onClick={addImage} className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center justify-center gap-1.5"><Plus className="h-3.5 w-3.5" /> Add image</button>
      </div>
    </div>
  );
}

const COLUMN_CONTENT_OPTIONS: { value: ColumnContentType; label: string }[] = [
  { value: 'card',           label: 'Card (image + title + text + button)' },
  { value: 'heading_block',  label: 'Heading' },
  { value: 'rich_text',      label: 'Rich Text' },
  { value: 'image_block',    label: 'Image' },
  { value: 'button_row',     label: 'Buttons' },
  { value: 'html_embed',     label: 'HTML Embed' },
  { value: 'divider',        label: 'Divider' },
  { value: 'file_downloads', label: 'Downloads' },
  { value: 'image_gallery',  label: 'Gallery' },
  { value: 'download_banner',label: 'Download Banner' },
  { value: 'hero',           label: 'Hero (CMS)' },
  { value: 'post_grid',      label: 'Post Grid (CMS)' },
  { value: 'latest_issue',   label: 'Latest Issue (CMS)' },
  { value: 'category_row',   label: 'Category Row (CMS)' },
];

function ColumnsBlockConfigForm({ config, onChange, categories }: { config: ColumnsBlockConfig; onChange: (c: ColumnsBlockConfig) => void; categories: Category[] }) {
  const updateColumn = (i: number, patch: Partial<ColumnItem>) =>
    onChange({ ...config, columns: config.columns.map((col, idx) => idx === i ? { ...col, ...patch } : col) });
  const addColumn = () => {
    if (config.columns.length < 4)
      onChange({ ...config, columns: [...config.columns, { contentType: 'card', title: `Column ${config.columns.length + 1}`, text: '', imageSrc: '', buttonLabel: '', buttonUrl: '', buttonVariant: 'primary', buttonNewTab: false }] });
  };
  const removeColumn = (i: number) => onChange({ ...config, columns: config.columns.filter((_, idx) => idx !== i) });

  const changeContentType = (i: number, ct: ColumnContentType) => {
    if (ct === 'card') {
      updateColumn(i, { contentType: 'card', nestedConfig: undefined });
    } else {
      updateColumn(i, { contentType: ct, nestedConfig: defaultConfig(ct) });
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Columns per row</Label>
          <Select value={String(config.columnsPerRow)} onValueChange={(v) => onChange({ ...config, columnsPerRow: Number(v) as 1|2|3|4 })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 — Full width</SelectItem>
              <SelectItem value="2">2 columns</SelectItem>
              <SelectItem value="3">3 columns</SelectItem>
              <SelectItem value="4">4 columns</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Text alignment</Label>
          <AlignControl value={config.textAlign} onChange={(textAlign) => onChange({ ...config, textAlign })} />
        </div>
      </div>
      <div className="space-y-3">
        <Label className="text-xs font-medium">Columns ({config.columns.length})</Label>
        {config.columns.map((col, i) => {
          const ct: ColumnContentType = col.contentType ?? 'card';
          const isCard = ct === 'card';
          return (
            <div key={i} className="rounded-md border border-border p-3 space-y-2.5 bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Column {i + 1}</p>
                <button type="button" onClick={() => removeColumn(i)} disabled={config.columns.length <= 1}
                  className="p-1 rounded text-muted-foreground hover:text-destructive disabled:opacity-30">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Content type selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Content type</Label>
                <Select value={ct} onValueChange={(v) => changeContentType(i, v as ColumnContentType)}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {COLUMN_CONTENT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isCard ? (
                /* ── Card fields ── */
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Image URL</Label>
                    <Input className="h-7 text-sm" placeholder="/s3/... or https://..." value={col.imageSrc || ''} onChange={(e) => updateColumn(i, { imageSrc: e.target.value })} />
                    {col.imageSrc && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={col.imageSrc} alt="" className="mt-1 rounded max-h-20 w-full object-cover border border-border" />
                    )}
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Image alt text</Label><Input className="h-7 text-sm" value={col.imageAlt || ''} onChange={(e) => updateColumn(i, { imageAlt: e.target.value })} /></div>
                  {/* Image link / download */}
                  <div className="space-y-2 rounded-md border border-border p-2.5 bg-background/50">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Image link</p>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Link URL</Label>
                      <Input className="h-7 text-sm" placeholder="/page or https://... (optional)" value={col.imageLink || ''} onChange={(e) => updateColumn(i, { imageLink: e.target.value })} />
                    </div>
                    {col.imageLink && (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={!!col.imageLinkNewTab} onChange={(e) => updateColumn(i, { imageLinkNewTab: e.target.checked })} className="h-3.5 w-3.5 rounded" />
                          <span className="text-xs text-muted-foreground flex items-center gap-0.5"><ExternalLink className="h-3 w-3" /> Open in new tab</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={!!col.imageDownload} onChange={(e) => updateColumn(i, { imageDownload: e.target.checked })} className="h-3.5 w-3.5 rounded" />
                          <span className="text-xs text-muted-foreground">Download file on click</span>
                        </label>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Title</Label><Input className="h-7 text-sm" value={col.title || ''} onChange={(e) => updateColumn(i, { title: e.target.value })} /></div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Text</Label>
                    <Textarea className="text-xs min-h-[60px] resize-none" placeholder="Paragraph text…" value={col.text || ''} onChange={(e) => updateColumn(i, { text: e.target.value })} />
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs">Button label</Label><Input className="h-7 text-sm" placeholder="Learn More" value={col.buttonLabel || ''} onChange={(e) => updateColumn(i, { buttonLabel: e.target.value })} /></div>
                  {col.buttonLabel && (
                    <>
                      <div className="space-y-1.5"><Label className="text-xs">Button URL</Label><Input className="h-7 text-sm" placeholder="/page or https://..." value={col.buttonUrl || ''} onChange={(e) => updateColumn(i, { buttonUrl: e.target.value })} /></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Button style</Label>
                          <Select value={col.buttonVariant || 'primary'} onValueChange={(v) => updateColumn(i, { buttonVariant: v as ColumnItem['buttonVariant'] })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="primary">Primary</SelectItem><SelectItem value="outline">Outline</SelectItem><SelectItem value="ghost">Ghost</SelectItem></SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" checked={!!col.buttonNewTab} onChange={(e) => updateColumn(i, { buttonNewTab: e.target.checked })} className="h-3.5 w-3.5 rounded" />
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5"><ExternalLink className="h-3 w-3" /> New tab</span>
                          </label>
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                /* ── Nested block config ── */
                <div className="space-y-2">
                  <SectionConfigForm
                    section={{ id: `col-cfg-${i}`, type: ct, config: col.nestedConfig ?? defaultConfig(ct) }}
                    onChange={(newCfg) => updateColumn(i, { nestedConfig: newCfg })}
                    categories={categories}
                  />
                </div>
              )}
            </div>
          );
        })}
        {config.columns.length < 4 && (
          <button type="button" onClick={addColumn}
            className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center justify-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add column
          </button>
        )}
      </div>
    </div>
  );
}

function SectionConfigForm({ section, onChange, categories }: { section: Section; onChange: (config: SectionConfig) => void; categories: Category[] }) {
  switch (section.type) {
    case 'hero':            return <HeroConfigForm config={section.config as HeroConfig} onChange={onChange} categories={categories} />;
    case 'post_grid':       return <PostGridConfigForm config={section.config as PostGridConfig} onChange={onChange} categories={categories} />;
    case 'latest_issue':    return <LatestIssueConfigForm config={section.config as LatestIssueConfig} onChange={onChange} />;
    case 'category_row':    return <CategoryRowConfigForm config={section.config as CategoryRowConfig} onChange={onChange} categories={categories} />;
    case 'download_banner': return <DownloadBannerConfigForm config={section.config as DownloadBannerConfig} onChange={onChange} />;
    case 'html_embed':      return <HtmlEmbedConfigForm config={section.config as HtmlEmbedConfig} onChange={onChange} />;
    case 'divider':         return <DividerConfigForm config={section.config as DividerConfig} onChange={onChange} />;
    case 'image_block':     return <ImageBlockConfigForm config={section.config as ImageBlockConfig} onChange={onChange} />;
    case 'rich_text':       return <RichTextConfigForm config={section.config as RichTextConfig} onChange={onChange} />;
    case 'heading_block':   return <HeadingBlockConfigForm config={section.config as HeadingBlockConfig} onChange={onChange} />;
    case 'button_row':      return <ButtonRowConfigForm config={section.config as ButtonRowConfig} onChange={onChange} />;
    case 'file_downloads':  return <FileDownloadsConfigForm config={section.config as FileDownloadsConfig} onChange={onChange} />;
    case 'image_gallery':   return <ImageGalleryConfigForm config={section.config as ImageGalleryConfig} onChange={onChange} />;
    case 'columns_block':   return <ColumnsBlockConfigForm config={section.config as ColumnsBlockConfig} onChange={onChange} categories={categories} />;
    default:                return <p className="text-sm text-muted-foreground">No config for this block.</p>;
  }
}

// ─── Block picker dialog ───────────────────────────────────────────────────────
function BlockPickerDialog({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (type: SectionType) => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Insert Block</DialogTitle></DialogHeader>
        <div className="space-y-5 pt-1">
          {PALETTE_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">{group.label}</p>
              <div className="grid grid-cols-2 gap-2">
                {group.types.map((type) => {
                  const meta = SECTION_META[type];
                  const icon = SECTION_ICONS[type];
                  return (
                    <button key={type} type="button" onClick={() => { onSelect(type); onClose(); }}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg text-left border border-border hover:border-primary hover:bg-primary/5 transition-colors group">
                      <span className={`flex items-center justify-center h-8 w-8 rounded-md border shrink-0 ${meta.color}`}>{icon}</span>
                      <div><p className="text-sm font-medium leading-none">{meta.label}</p><p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{meta.description}</p></div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Viewport options ──────────────────────────────────────────────────────────
const VIEWPORTS = [
  { id: 'desktop', icon: <Monitor className="h-4 w-4" />, label: 'Desktop', width: '100%' },
  { id: 'tablet',  icon: <Tablet className="h-4 w-4" />,  label: 'Tablet',  width: '768px' },
  { id: 'mobile',  icon: <Smartphone className="h-4 w-4" />, label: 'Mobile', width: '390px' },
] as const;
type ViewportId = typeof VIEWPORTS[number]['id'];

// ─── Main canvas component ─────────────────────────────────────────────────────
export interface PageBuilderCanvasProps {
  sections: Section[];
  onSectionsChange: (sections: Section[]) => void;
  categories: Category[];
  title: string;
  backHref: string;
  previewHref?: string;
  onSave: () => Promise<void>;
  saving: boolean;
  savedOk: boolean;
}

export function PageBuilderCanvas({
  sections, onSectionsChange, categories,
  title, backHref, previewHref,
  onSave, saving, savedOk,
}: PageBuilderCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportId>('desktop');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (e: DragStartEvent) => { setActiveId(e.active.id as string); setSelectedId(null); };
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (e.over && e.active.id !== e.over.id) {
      onSectionsChange(arrayMove(sections, sections.findIndex((s) => s.id === e.active.id), sections.findIndex((s) => s.id === e.over!.id)));
    }
  };

  const openPickerAt = (idx: number | null) => { setInsertAt(idx); setPickerOpen(true); };

  const addSection = useCallback((type: SectionType, forceAt?: number | null) => {
    const s = createSection(type);
    const at = forceAt !== undefined ? forceAt : insertAt;
    onSectionsChange(at === null ? [...sections, s] : (() => { const next = [...sections]; next.splice(at + 1, 0, s); return next; })());
    setSelectedId(s.id);
    setInsertAt(null);
  }, [sections, onSectionsChange, insertAt]);

  const removeSection = useCallback((id: string) => {
    onSectionsChange(sections.filter((s) => s.id !== id));
    setSelectedId((sel) => sel === id ? null : sel);
  }, [sections, onSectionsChange]);

  const moveSection = useCallback((id: string, dir: -1 | 1) => {
    const i = sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= sections.length) return;
    onSectionsChange(arrayMove(sections, i, j));
  }, [sections, onSectionsChange]);

  const updateConfig = useCallback((id: string, config: SectionConfig) => {
    onSectionsChange(sections.map((s) => s.id === id ? { ...s, config } : s));
  }, [sections, onSectionsChange]);

  const selectedSection = sections.find((s) => s.id === selectedId) ?? null;
  const activeSection   = sections.find((s) => s.id === activeId)   ?? null;
  const canvasWidth = VIEWPORTS.find((v) => v.id === viewport)?.width ?? '100%';

  return (
    <div className="flex flex-col -m-4 sm:-m-6" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-background shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Link>
          <div className="w-px h-4 bg-border" />
          <h1 className="font-bold text-base truncate max-w-xs">{title}</h1>
          <span className="text-xs text-muted-foreground">{sections.length} block{sections.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {VIEWPORTS.map((v) => (
            <button key={v.id} type="button" onClick={() => setViewport(v.id)} title={v.label}
              className={`p-1.5 rounded-md transition-colors ${viewport === v.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {v.icon}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {previewHref && (
            <a href={previewHref} target="_blank" rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-1.5 border rounded-md hover:bg-muted transition-colors">
              Preview ↗
            </a>
          )}
          <Button onClick={onSave} disabled={saving} size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : savedOk ? '✓ Saved' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left palette */}
        <div className="w-56 shrink-0 border-r border-border overflow-y-auto bg-muted/20">
          <div className="p-3 space-y-5">
            {PALETTE_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 px-1">{group.label}</p>
                <div className="space-y-0.5">
                  {group.types.map((type) => {
                    const meta = SECTION_META[type];
                    const icon = SECTION_ICONS[type];
                    return (
                      <button key={type} type="button" onClick={() => addSection(type, null)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-left hover:bg-background border border-transparent hover:border-border transition-all group text-sm">
                        <span className={`flex items-center justify-center h-6 w-6 rounded border shrink-0 text-[10px] ${meta.color}`}>{icon}</span>
                        <span className="font-medium truncate">{meta.label}</span>
                        <Plus className="h-3 w-3 ml-auto shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center canvas */}
        <div className="flex-1 overflow-y-auto bg-muted/10">
          <div className="py-8 px-6 transition-all duration-300">
            <div className="mx-auto transition-all duration-300" style={{ maxWidth: canvasWidth }}>
              {sections.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] border-2 border-dashed border-border rounded-2xl text-center">
                  <LayoutTemplate className="h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="font-semibold text-muted-foreground">Your page is empty</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Click a block in the left panel to start building</p>
                  <button type="button" onClick={() => openPickerAt(null)}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-primary text-primary text-sm hover:bg-primary/5 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add first block
                  </button>
                </div>
              ) : (
                <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-0">
                      <InsertButton onClick={() => openPickerAt(-1)} />
                      {sections.map((section, i) => (
                        <div key={section.id}>
                          <VisualSection
                            section={section}
                            isSelected={selectedId === section.id}
                            isFirst={i === 0}
                            isLast={i === sections.length - 1}
                            isDragging={activeId === section.id}
                            onSelect={() => setSelectedId(selectedId === section.id ? null : section.id)}
                            onRemove={() => removeSection(section.id)}
                            onMoveUp={() => moveSection(section.id, -1)}
                            onMoveDown={() => moveSection(section.id, 1)}
                          />
                          <InsertButton onClick={() => openPickerAt(i)} />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeSection && (
                      <div className="rounded-xl border-2 border-primary bg-background/80 backdrop-blur px-6 py-4 shadow-2xl opacity-95 pointer-events-none">
                        <div className="pointer-events-none select-none"><SectionPreview section={activeSection} /></div>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              )}
            </div>
          </div>
        </div>

        {/* Right config panel */}
        <div className={`shrink-0 border-l border-border overflow-y-auto bg-background transition-all duration-200 ${selectedSection ? 'w-72' : 'w-0 overflow-hidden'}`}>
          {selectedSection && (
            <div className="p-4 w-72">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center h-7 w-7 rounded border ${SECTION_META[selectedSection.type].color}`}>{SECTION_ICONS[selectedSection.type]}</span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none">Block Settings</p>
                    <p className="font-semibold text-sm mt-0.5">{SECTION_META[selectedSection.type].label}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>
              <SectionConfigForm section={selectedSection} onChange={(config) => updateConfig(selectedSection.id, config)} categories={categories} />
            </div>
          )}
        </div>
      </div>

      <BlockPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addSection} />
    </div>
  );
}
