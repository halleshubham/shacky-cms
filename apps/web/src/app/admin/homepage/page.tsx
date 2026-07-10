'use client';
import { useState, useCallback, useEffect, useId } from 'react';
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
  GripVertical, X, Settings2, Plus, Save, LayoutTemplate,
  Grid3X3, Newspaper, AlignJustify, Download, Code, Minus,
  Eye, ImageIcon, Type, Heading, MousePointerClick, Trash2,
  AlignLeft, AlignCenter, AlignRight, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { api } from '@/lib/api';
import {
  type Section, type SectionType, type SectionConfig,
  type HeroConfig, type PostGridConfig, type LatestIssueConfig,
  type CategoryRowConfig, type DownloadBannerConfig, type HtmlEmbedConfig,
  type DividerConfig, type ImageBlockConfig, type RichTextConfig,
  type HeadingBlockConfig, type ButtonRowConfig, type ButtonDef,
  SECTION_META, createSection,
} from '@/lib/page-builder';

// ─── Icon map ─────────────────────────────────────────────────────────────────
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
};

const SECTION_TYPES: SectionType[] = [
  'hero', 'post_grid', 'latest_issue', 'category_row',
  'download_banner', 'html_embed', 'divider',
  'image_block', 'rich_text', 'heading_block', 'button_row',
];

// ─── Config forms ─────────────────────────────────────────────────────────────
function HeroConfigForm({ config, onChange }: { config: HeroConfig; onChange: (c: HeroConfig) => void }) {
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
          <Label className="text-xs font-medium">Category Slug</Label>
          <Input className="h-8 text-sm" placeholder="e.g. politics" value={config.categorySlug || ''} onChange={(e) => onChange({ ...config, categorySlug: e.target.value })} />
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
      <div className="flex items-center gap-2">
        <input type="checkbox" id="hero-excerpt" checked={config.showExcerpt} onChange={(e) => onChange({ ...config, showExcerpt: e.target.checked })} className="h-4 w-4 rounded" />
        <Label htmlFor="hero-excerpt" className="text-xs font-medium cursor-pointer">Show excerpt</Label>
      </div>
    </div>
  );
}

function PostGridConfigForm({ config, onChange }: { config: PostGridConfig; onChange: (c: PostGridConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Section Title (optional)</Label>
        <Input className="h-8 text-sm" placeholder="e.g. Recent Articles" value={config.title || ''} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Source</Label>
        <Select value={config.source} onValueChange={(v) => onChange({ ...config, source: v as PostGridConfig['source'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="latest">Latest Published</SelectItem>
            <SelectItem value="featured">Featured Posts</SelectItem>
            <SelectItem value="category">By Category</SelectItem>
            <SelectItem value="tag">By Tag</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(config.source === 'category' || config.source === 'tag') && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">{config.source === 'category' ? 'Category' : 'Tag'} Slug</Label>
          <Input className="h-8 text-sm" placeholder="e.g. sports" value={config.slug || ''} onChange={(e) => onChange({ ...config, slug: e.target.value })} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Count</Label>
          <Select value={String(config.count)} onValueChange={(v) => onChange({ ...config, count: Number(v) })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 4, 6, 8, 12].map((n) => <SelectItem key={n} value={String(n)}>{n} posts</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Columns</Label>
          <Select value={String(config.columns)} onValueChange={(v) => onChange({ ...config, columns: Number(v) as 2 | 3 | 4 })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2 columns</SelectItem>
              <SelectItem value="3">3 columns</SelectItem>
              <SelectItem value="4">4 columns</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Card Size</Label>
        <Select value={config.size} onValueChange={(v) => onChange({ ...config, size: v as PostGridConfig['size'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Default (image + text)</SelectItem>
            <SelectItem value="compact">Compact (small thumbnail)</SelectItem>
          </SelectContent>
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
        <Label htmlFor="li-posts" className="text-xs font-medium cursor-pointer">Show issue posts below banner</Label>
      </div>
      {config.showPosts && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Post Count</Label>
          <Select value={String(config.postCount)} onValueChange={(v) => onChange({ ...config, postCount: Number(v) })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6, 8].map((n) => <SelectItem key={n} value={String(n)}>{n} posts</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function CategoryRowConfigForm({ config, onChange }: { config: CategoryRowConfig; onChange: (c: CategoryRowConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Category Slug</Label>
        <Input className="h-8 text-sm" placeholder="e.g. politics" value={config.categorySlug} onChange={(e) => onChange({ ...config, categorySlug: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Display Label (optional override)</Label>
        <Input className="h-8 text-sm" placeholder="Leave blank to use category name" value={config.label || ''} onChange={(e) => onChange({ ...config, label: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Count</Label>
          <Select value={String(config.count)} onValueChange={(v) => onChange({ ...config, count: Number(v) })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Layout</Label>
          <Select value={config.layout} onValueChange={(v) => onChange({ ...config, layout: v as CategoryRowConfig['layout'] })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="row">Row (all equal)</SelectItem>
              <SelectItem value="featured">Featured + small</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function DownloadBannerConfigForm({ config, onChange }: { config: DownloadBannerConfig; onChange: (c: DownloadBannerConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Title</Label>
        <Input className="h-8 text-sm" value={config.title} onChange={(e) => onChange({ ...config, title: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Description (optional)</Label>
        <Textarea className="text-sm min-h-[60px]" value={config.description || ''} onChange={(e) => onChange({ ...config, description: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Button Label</Label>
        <Input className="h-8 text-sm" value={config.buttonLabel} onChange={(e) => onChange({ ...config, buttonLabel: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Button URL</Label>
        <Input className="h-8 text-sm" placeholder="/issues or https://..." value={config.buttonUrl} onChange={(e) => onChange({ ...config, buttonUrl: e.target.value })} />
      </div>
    </div>
  );
}

function HtmlEmbedConfigForm({ config, onChange }: { config: HtmlEmbedConfig; onChange: (c: HtmlEmbedConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Label (admin only)</Label>
        <Input className="h-8 text-sm" placeholder="e.g. Newsletter Signup Widget" value={config.label || ''} onChange={(e) => onChange({ ...config, label: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">HTML Code</Label>
        <Textarea className="text-xs font-mono min-h-[160px]" placeholder="<div>...</div>" value={config.code} onChange={(e) => onChange({ ...config, code: e.target.value })} />
      </div>
    </div>
  );
}

function DividerConfigForm({ config, onChange }: { config: DividerConfig; onChange: (c: DividerConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Label (optional, shown centered)</Label>
        <Input className="h-8 text-sm" placeholder="e.g. More from this week" value={config.label || ''} onChange={(e) => onChange({ ...config, label: e.target.value })} />
      </div>
    </div>
  );
}

// ── Link sub-field ────────────────────────────────────────────────────────────
function LinkFields({
  url, newTab,
  onChange,
}: {
  url: string;
  newTab?: boolean;
  onChange: (url: string, newTab: boolean) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3 bg-muted/30">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Hyperlink</p>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">URL</Label>
        <Input className="h-8 text-sm" placeholder="/page-slug or https://..." value={url} onChange={(e) => onChange(e.target.value, newTab ?? false)} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="link-newtab" checked={!!newTab} onChange={(e) => onChange(url, e.target.checked)} className="h-4 w-4 rounded" />
        <Label htmlFor="link-newtab" className="text-xs font-medium cursor-pointer flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> Open in new tab
        </Label>
      </div>
    </div>
  );
}

// ── Align control ─────────────────────────────────────────────────────────────
function AlignControl({ value, onChange }: { value: 'left' | 'center' | 'right'; onChange: (v: 'left' | 'center' | 'right') => void }) {
  return (
    <div className="flex gap-1">
      {(['left', 'center', 'right'] as const).map((a) => {
        const icons = { left: <AlignLeft className="h-3.5 w-3.5" />, center: <AlignCenter className="h-3.5 w-3.5" />, right: <AlignRight className="h-3.5 w-3.5" /> };
        return (
          <button key={a} type="button" onClick={() => onChange(a)}
            className={`p-1.5 rounded border transition-colors ${value === a ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
            {icons[a]}
          </button>
        );
      })}
    </div>
  );
}

// ── Image block config ────────────────────────────────────────────────────────
function ImageBlockConfigForm({ config, onChange }: { config: ImageBlockConfig; onChange: (c: ImageBlockConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Image URL</Label>
        <Input className="h-8 text-sm" placeholder="https://… or /s3/…" value={config.src} onChange={(e) => onChange({ ...config, src: e.target.value })} />
        {config.src && (
          <div className="mt-2 rounded-md overflow-hidden border border-border bg-muted/30 max-h-40 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={config.src} alt={config.alt || ''} className="max-h-40 max-w-full object-contain" />
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Alt Text</Label>
        <Input className="h-8 text-sm" placeholder="Describe the image" value={config.alt || ''} onChange={(e) => onChange({ ...config, alt: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Caption (optional)</Label>
        <Input className="h-8 text-sm" placeholder="Caption shown below image" value={config.caption || ''} onChange={(e) => onChange({ ...config, caption: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Max Width</Label>
        <Input className="h-8 text-sm" placeholder="e.g. 600px or 80%" value={config.maxWidth || '100%'} onChange={(e) => onChange({ ...config, maxWidth: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Alignment</Label>
        <Select value={config.align} onValueChange={(v) => onChange({ ...config, align: v as ImageBlockConfig['align'] })}>
          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="left">Left</SelectItem>
            <SelectItem value="center">Center</SelectItem>
            <SelectItem value="right">Right</SelectItem>
            <SelectItem value="full">Full width</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <LinkFields
        url={config.linkUrl || ''}
        newTab={config.linkNewTab}
        onChange={(linkUrl, linkNewTab) => onChange({ ...config, linkUrl, linkNewTab })}
      />
    </div>
  );
}

// ── Rich text config ──────────────────────────────────────────────────────────
function RichTextConfigForm({ config, onChange }: { config: RichTextConfig; onChange: (c: RichTextConfig) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Content</Label>
      <p className="text-[11px] text-muted-foreground">Use the toolbar to add links, bold, headings, etc.</p>
      <RichTextEditor value={config.html} onChange={(html) => onChange({ ...config, html })} className="min-h-[160px] text-sm" />
    </div>
  );
}

// ── Heading block config ──────────────────────────────────────────────────────
function HeadingBlockConfigForm({ config, onChange }: { config: HeadingBlockConfig; onChange: (c: HeadingBlockConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Heading Text</Label>
        <Input className="h-8 text-sm" value={config.text} onChange={(e) => onChange({ ...config, text: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Subtext (optional)</Label>
        <Input className="h-8 text-sm" placeholder="Subtitle or description" value={config.subtext || ''} onChange={(e) => onChange({ ...config, subtext: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Level</Label>
          <Select value={String(config.level)} onValueChange={(v) => onChange({ ...config, level: Number(v) as 1 | 2 | 3 })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">H1 — Page title</SelectItem>
              <SelectItem value="2">H2 — Section</SelectItem>
              <SelectItem value="3">H3 — Sub-section</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Alignment</Label>
          <AlignControl value={config.align} onChange={(align) => onChange({ ...config, align })} />
        </div>
      </div>
      <LinkFields
        url={config.linkUrl || ''}
        newTab={config.linkNewTab}
        onChange={(linkUrl, linkNewTab) => onChange({ ...config, linkUrl, linkNewTab })}
      />
    </div>
  );
}

// ── Button row config ─────────────────────────────────────────────────────────
function ButtonRowConfigForm({ config, onChange }: { config: ButtonRowConfig; onChange: (c: ButtonRowConfig) => void }) {
  const updateButton = (i: number, patch: Partial<ButtonDef>) => {
    const buttons = config.buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b);
    onChange({ ...config, buttons });
  };
  const addButton = () => {
    if (config.buttons.length >= 3) return;
    onChange({ ...config, buttons: [...config.buttons, { label: 'Button', url: '/', variant: 'outline', newTab: false }] });
  };
  const removeButton = (i: number) => onChange({ ...config, buttons: config.buttons.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Row Alignment</Label>
        <AlignControl value={config.align} onChange={(align) => onChange({ ...config, align })} />
      </div>

      <div className="space-y-3">
        {config.buttons.map((btn, i) => (
          <div key={i} className="rounded-md border border-border p-3 space-y-2.5 bg-muted/20">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted-foreground">Button {i + 1}</p>
              <button type="button" onClick={() => removeButton(i)} disabled={config.buttons.length <= 1}
                className="p-1 rounded text-muted-foreground hover:text-destructive disabled:opacity-30">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input className="h-7 text-sm" value={btn.label} onChange={(e) => updateButton(i, { label: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">URL</Label>
              <Input className="h-7 text-sm" placeholder="/page or https://..." value={btn.url} onChange={(e) => updateButton(i, { url: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Style</Label>
                <Select value={btn.variant} onValueChange={(v) => updateButton(i, { variant: v as ButtonDef['variant'] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primary">Primary</SelectItem>
                    <SelectItem value="outline">Outline</SelectItem>
                    <SelectItem value="ghost">Ghost</SelectItem>
                  </SelectContent>
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
          <button type="button" onClick={addButton}
            className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center justify-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add button
          </button>
        )}
      </div>
    </div>
  );
}

function SectionConfigForm({ section, onChange }: { section: Section; onChange: (config: SectionConfig) => void }) {
  switch (section.type) {
    case 'hero':            return <HeroConfigForm config={section.config as HeroConfig} onChange={onChange} />;
    case 'post_grid':       return <PostGridConfigForm config={section.config as PostGridConfig} onChange={onChange} />;
    case 'latest_issue':    return <LatestIssueConfigForm config={section.config as LatestIssueConfig} onChange={onChange} />;
    case 'category_row':    return <CategoryRowConfigForm config={section.config as CategoryRowConfig} onChange={onChange} />;
    case 'download_banner': return <DownloadBannerConfigForm config={section.config as DownloadBannerConfig} onChange={onChange} />;
    case 'html_embed':      return <HtmlEmbedConfigForm config={section.config as HtmlEmbedConfig} onChange={onChange} />;
    case 'divider':         return <DividerConfigForm config={section.config as DividerConfig} onChange={onChange} />;
    case 'image_block':     return <ImageBlockConfigForm config={section.config as ImageBlockConfig} onChange={onChange} />;
    case 'rich_text':       return <RichTextConfigForm config={section.config as RichTextConfig} onChange={onChange} />;
    case 'heading_block':   return <HeadingBlockConfigForm config={section.config as HeadingBlockConfig} onChange={onChange} />;
    case 'button_row':      return <ButtonRowConfigForm config={section.config as ButtonRowConfig} onChange={onChange} />;
    default:                return <p className="text-sm text-muted-foreground">No config available.</p>;
  }
}

// ─── Sortable section card ─────────────────────────────────────────────────────
interface SortableSectionProps {
  section: Section;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  isDragging?: boolean;
}

function SortableSection({ section, isSelected, onSelect, onRemove, isDragging }: SortableSectionProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
  const meta = SECTION_META[section.type];
  const icon = SECTION_ICONS[section.type];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const configSummary = getSectionSummary(section);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group border-2 rounded-lg bg-card transition-colors ${isSelected ? 'border-primary shadow-sm' : 'border-border hover:border-border/80'}`}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          {...attributes}
          {...listeners}
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-0.5 touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md font-medium border shrink-0 ${meta.color}`}>
          {icon}
          {meta.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{configSummary}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button" variant="ghost" size="sm"
            onClick={onSelect}
            className={`h-7 px-2 gap-1 text-xs ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {isSelected ? 'Editing' : 'Edit'}
          </Button>
          <Button
            type="button" variant="ghost" size="sm"
            onClick={onRemove}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function getSectionSummary(section: Section): string {
  switch (section.type) {
    case 'hero': {
      const c = section.config as HeroConfig;
      return `Source: ${c.source === 'category' ? `Category: ${c.categorySlug}` : c.source} · ${c.layout} layout`;
    }
    case 'post_grid': {
      const c = section.config as PostGridConfig;
      return `${c.title || 'Post Grid'} · ${c.count} posts · ${c.columns} cols`;
    }
    case 'latest_issue': {
      const c = section.config as LatestIssueConfig;
      return c.showPosts ? `Show banner + ${c.postCount} posts` : 'Show banner only';
    }
    case 'category_row': {
      const c = section.config as CategoryRowConfig;
      return c.categorySlug ? `${c.label || c.categorySlug} · ${c.count} posts` : 'No category set';
    }
    case 'download_banner': {
      const c = section.config as DownloadBannerConfig;
      return c.title || 'Download Banner';
    }
    case 'html_embed': {
      const c = section.config as HtmlEmbedConfig;
      return c.label || 'HTML Embed';
    }
    case 'divider': {
      const c = section.config as DividerConfig;
      return c.label ? `Divider: "${c.label}"` : 'Divider';
    }
    case 'image_block': {
      const c = section.config as ImageBlockConfig;
      return c.src ? (c.alt || c.src.split('/').pop() || 'Image') : 'No image set';
    }
    case 'rich_text': {
      const c = section.config as RichTextConfig;
      const text = c.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return text.slice(0, 60) || 'Empty text block';
    }
    case 'heading_block': {
      const c = section.config as HeadingBlockConfig;
      return `H${c.level}: ${c.text}`;
    }
    case 'button_row': {
      const c = section.config as ButtonRowConfig;
      return c.buttons.map((b) => b.label).join(' · ') || 'No buttons';
    }
    default: return section.type;
  }
}

// ─── Drag overlay card ─────────────────────────────────────────────────────────
function DragOverlayCard({ section }: { section: Section }) {
  const meta = SECTION_META[section.type];
  const icon = SECTION_ICONS[section.type];
  return (
    <div className="flex items-center gap-2 p-3 border-2 border-primary rounded-lg bg-card shadow-lg">
      <GripVertical className="h-4 w-4 text-muted-foreground/40" />
      <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md font-medium border ${meta.color}`}>
        {icon} {meta.label}
      </span>
      <p className="text-sm font-medium text-muted-foreground">{getSectionSummary(section)}</p>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function HomepageBuilderPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Load existing sections
  useEffect(() => {
    api.get<any>('/api/settings').then((raw) => {
      if (raw.homepage_sections) {
        try {
          const parsed = JSON.parse(raw.homepage_sections);
          if (Array.isArray(parsed)) setSections(parsed);
        } catch { /* empty */ }
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setSelectedId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      setSections((prev) => {
        const oldIdx = prev.findIndex((s) => s.id === active.id);
        const newIdx = prev.findIndex((s) => s.id === over.id);
        return arrayMove(prev, oldIdx, newIdx);
      });
    }
  };

  const addSection = useCallback((type: SectionType) => {
    const s = createSection(type);
    setSections((prev) => [...prev, s]);
    setSelectedId(s.id);
  }, []);

  const removeSection = useCallback((id: string) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setSelectedId((sel) => sel === id ? null : sel);
  }, []);

  const updateConfig = useCallback((id: string, config: SectionConfig) => {
    setSections((prev) => prev.map((s) => s.id === id ? { ...s, config } : s));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/api/settings', { homepage_sections: JSON.stringify(sections) });
      // Revalidate public cache
      await fetch('/api/revalidate?tag=site-settings', { method: 'POST' }).catch(() => {});
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const selectedSection = sections.find((s) => s.id === selectedId) ?? null;
  const activeSection = sections.find((s) => s.id === activeId) ?? null;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full -m-4 sm:-m-6">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-background shrink-0 sticky top-0 z-20">
        <div>
          <h1 className="text-lg font-bold">Homepage Builder</h1>
          <p className="text-xs text-muted-foreground">{sections.length} section{sections.length !== 1 ? 's' : ''} · drag to reorder</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-3 py-1.5 border rounded-md hover:bg-muted transition-colors">
            <Eye className="h-3.5 w-3.5" /> Preview
          </a>
          <Button onClick={save} disabled={saving} className="gap-1.5 h-8">
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : savedOk ? 'Saved!' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Builder body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Palette — left */}
        <div className="w-60 shrink-0 border-r border-border overflow-y-auto bg-muted/30">
          <div className="p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Add Block</p>
            <div className="space-y-1.5">
              {SECTION_TYPES.map((type) => {
                const meta = SECTION_META[type];
                const icon = SECTION_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => addSection(type)}
                    className="w-full flex items-start gap-2.5 p-2.5 rounded-lg text-left hover:bg-background border border-transparent hover:border-border transition-colors group"
                  >
                    <span className={`mt-0.5 flex items-center justify-center h-7 w-7 rounded-md border shrink-0 ${meta.color}`}>
                      {icon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-none">{meta.label}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{meta.description}</p>
                    </div>
                    <Plus className="h-3.5 w-3.5 ml-auto shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors mt-1.5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Canvas — center */}
        <div className="flex-1 overflow-y-auto p-6">
          {sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[320px] border-2 border-dashed border-border rounded-xl text-center">
              <LayoutTemplate className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="font-medium text-muted-foreground">No sections yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Click a block type on the left to add your first section</p>
            </div>
          ) : (
            <DndContext
              id={dndId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 max-w-2xl mx-auto">
                  {sections.map((section) => (
                    <SortableSection
                      key={section.id}
                      section={section}
                      isSelected={selectedId === section.id}
                      onSelect={() => setSelectedId(selectedId === section.id ? null : section.id)}
                      onRemove={() => removeSection(section.id)}
                      isDragging={activeId === section.id}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay>
                {activeSection && <DragOverlayCard section={activeSection} />}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        {/* Config panel — right */}
        <div className="w-72 shrink-0 border-l border-border overflow-y-auto bg-muted/10">
          <div className="p-4">
            {selectedSection ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Configure</p>
                    <p className="font-semibold text-sm mt-0.5">{SECTION_META[selectedSection.type].label}</p>
                  </div>
                  <button type="button" onClick={() => setSelectedId(null)} className="p-1 rounded hover:bg-muted text-muted-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <SectionConfigForm
                  section={selectedSection}
                  onChange={(config) => updateConfig(selectedSection.id, config)}
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center">
                <Settings2 className="h-8 w-8 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Click <strong>Edit</strong> on a section to configure it</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
