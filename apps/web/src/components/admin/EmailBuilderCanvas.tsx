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
  GripVertical, X, Plus, Save, LayoutTemplate, Newspaper, Minus, ImageIcon, Type, Heading,
  MousePointerClick, Trash2, ChevronUp, ChevronDown, ArrowLeft, MoveVertical, Eye, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  type Section, type SectionType, type SectionConfig,
  type IssueHeaderConfig, type IssueArticlesConfig, type RichTextConfig,
  type HeadingBlockConfig, type ImageBlockConfig, type ButtonRowConfig,
  type DividerConfig, type SpacerConfig,
  SECTION_META, createSection,
} from '@/lib/page-builder';
import { CheckboxRow } from './blocks/shared';
import { RichTextPreview, RichTextConfigForm } from './blocks/RichTextBlock';
import { HeadingPreview, HeadingBlockConfigForm } from './blocks/HeadingBlock';
import { ImageBlockPreview, ImageBlockConfigForm } from './blocks/ImageBlock';
import { ButtonRowPreview, ButtonRowConfigForm } from './blocks/ButtonRowBlock';
import { DividerPreview, DividerConfigForm } from './blocks/DividerBlock';
import { SpacerPreview, SpacerConfigForm } from './blocks/SpacerBlock';
import { IssueArticlesPreview, IssueArticlesConfigForm } from './blocks/IssueArticlesBlock';

// ─── Block palette meta (email surface only) ───────────────────────────────────
const BLOCK_ICONS: Record<SectionType, React.ReactNode> = {
  hero: null, post_grid: null, latest_issue: null, category_row: null, download_banner: null,
  html_embed: null, file_downloads: null, image_gallery: null, columns_block: null,
  issue_header:   <LayoutTemplate className="h-4 w-4" />,
  issue_articles: <Newspaper className="h-4 w-4" />,
  rich_text:      <Type className="h-4 w-4" />,
  heading_block:  <Heading className="h-4 w-4" />,
  image_block:    <ImageIcon className="h-4 w-4" />,
  button_row:     <MousePointerClick className="h-4 w-4" />,
  divider:        <Minus className="h-4 w-4" />,
  spacer:         <MoveVertical className="h-4 w-4" />,
};

const PALETTE_GROUPS = (
  [
    { label: 'Issue Content',  types: ['issue_header', 'issue_articles'] },
    { label: 'Custom Content', types: ['heading_block', 'rich_text', 'image_block', 'button_row'] },
    { label: 'Layout',         types: ['divider', 'spacer'] },
  ] as { label: string; types: SectionType[] }[]
).map((g) => ({ ...g, types: g.types.filter((t) => SECTION_META[t].surfaces.includes('email')) }));

// ─── Email-only block: masthead ────────────────────────────────────────────────
function IssueHeaderPreview({ config }: { config: IssueHeaderConfig }) {
  const chips = [
    config.showLogo && 'Logo',
    config.showTagline && 'Tagline',
    config.showIssueMeta && 'Volume/Issue/Date',
    config.showEditors && 'Editors bar',
  ].filter(Boolean) as string[];
  return (
    <div className="space-y-2">
      <div className="rounded-lg bg-[#1e2537] text-white px-6 py-5 text-center space-y-1">
        <p className="font-serif text-2xl font-bold">Site Name</p>
        {config.showTagline && <p className="text-[11px] text-gray-300 italic">Tagline text</p>}
        {config.showIssueMeta && <p className="text-[10px] text-gray-400">Volume X, Issue Y • Date</p>}
      </div>
      <p className="text-[11px] text-muted-foreground">{chips.length ? chips.join(' · ') : 'Nothing shown'}</p>
    </div>
  );
}

function IssueHeaderConfigForm({ config, onChange }: { config: IssueHeaderConfig; onChange: (c: IssueHeaderConfig) => void }) {
  return (
    <div className="space-y-3">
      <CheckboxRow id="ih-logo" checked={config.showLogo} onChange={(v) => onChange({ ...config, showLogo: v })} label="Show site logo" />
      <CheckboxRow id="ih-tagline" checked={config.showTagline} onChange={(v) => onChange({ ...config, showTagline: v })} label="Show tagline" />
      <CheckboxRow id="ih-meta" checked={config.showIssueMeta} onChange={(v) => onChange({ ...config, showIssueMeta: v })} label="Show volume/issue/date" />
      <CheckboxRow id="ih-editors" checked={config.showEditors} onChange={(v) => onChange({ ...config, showEditors: v })} label="Show editors bar" />
    </div>
  );
}

function BlockPreview({ block }: { block: Section }) {
  switch (block.type) {
    case 'issue_header':   return <IssueHeaderPreview config={block.config as IssueHeaderConfig} />;
    case 'issue_articles': return <IssueArticlesPreview config={block.config as IssueArticlesConfig} surface="email" />;
    case 'rich_text':      return <RichTextPreview config={block.config as RichTextConfig} />;
    case 'heading_block':  return <HeadingPreview config={block.config as HeadingBlockConfig} />;
    case 'image_block':    return <ImageBlockPreview config={block.config as ImageBlockConfig} />;
    case 'button_row':     return <ButtonRowPreview config={block.config as ButtonRowConfig} />;
    case 'divider':        return <DividerPreview config={block.config as DividerConfig} />;
    case 'spacer':         return <SpacerPreview config={block.config as SpacerConfig} />;
    default:                return null;
  }
}

function BlockConfigForm({ block, onChange }: { block: Section; onChange: (config: SectionConfig) => void }) {
  switch (block.type) {
    case 'issue_header':   return <IssueHeaderConfigForm config={block.config as IssueHeaderConfig} onChange={onChange} />;
    case 'issue_articles': return <IssueArticlesConfigForm config={block.config as IssueArticlesConfig} onChange={onChange} surface="email" />;
    case 'rich_text':      return <RichTextConfigForm config={block.config as RichTextConfig} onChange={onChange} />;
    case 'heading_block':  return <HeadingBlockConfigForm config={block.config as HeadingBlockConfig} onChange={onChange} />;
    case 'image_block':    return <ImageBlockConfigForm config={block.config as ImageBlockConfig} onChange={onChange} />;
    case 'button_row':     return <ButtonRowConfigForm config={block.config as ButtonRowConfig} onChange={onChange} maxButtons={4} />;
    case 'divider':        return <DividerConfigForm config={block.config as DividerConfig} onChange={onChange} />;
    case 'spacer':         return <SpacerConfigForm config={block.config as SpacerConfig} onChange={onChange} />;
    default:                return <p className="text-sm text-muted-foreground">No config for this block.</p>;
  }
}

// ─── Visual sortable block ──────────────────────────────────────────────────────
interface VisualBlockProps {
  block: Section; isSelected: boolean; isFirst: boolean; isLast: boolean; isDragging: boolean;
  onSelect: () => void; onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}

function VisualBlock({ block, isSelected, isFirst, isLast, isDragging, onSelect, onRemove, onMoveUp, onMoveDown }: VisualBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  const meta = SECTION_META[block.type];
  const icon = BLOCK_ICONS[block.type];
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
            <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Remove block"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="pointer-events-none select-none"><BlockPreview block={block} /></div>
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
                  const icon = BLOCK_ICONS[type];
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

// ─── Live preview dialog ────────────────────────────────────────────────────────
function PreviewDialog({ open, onClose, loading, html }: { open: boolean; onClose: () => void; loading: boolean; html: string | null }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Email Preview</DialogTitle></DialogHeader>
        <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground h-48">
              <Loader2 className="h-4 w-4 animate-spin" /> Rendering…
            </div>
          )}
          {!loading && html && (
            <iframe srcDoc={html} title="Email Preview" className="w-full" style={{ height: '75vh', border: 'none' }} sandbox="allow-same-origin" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main canvas component ─────────────────────────────────────────────────────
export interface EmailBuilderCanvasProps {
  blocks: Section[];
  onBlocksChange: (blocks: Section[]) => void;
  title: string;
  backHref: string;
  onSave: () => Promise<void>;
  saving: boolean;
  savedOk: boolean;
  onPreview: () => Promise<string>;
}

export function EmailBuilderCanvas({
  blocks, onBlocksChange,
  title, backHref,
  onSave, saving, savedOk,
  onPreview,
}: EmailBuilderCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (e: DragStartEvent) => { setActiveId(e.active.id as string); setSelectedId(null); };
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (e.over && e.active.id !== e.over.id) {
      onBlocksChange(arrayMove(blocks, blocks.findIndex((b) => b.id === e.active.id), blocks.findIndex((b) => b.id === e.over!.id)));
    }
  };

  const openPickerAt = (idx: number | null) => { setInsertAt(idx); setPickerOpen(true); };

  const addBlock = useCallback((type: SectionType, forceAt?: number | null) => {
    const b = createSection(type);
    const at = forceAt !== undefined ? forceAt : insertAt;
    onBlocksChange(at === null ? [...blocks, b] : (() => { const next = [...blocks]; next.splice(at + 1, 0, b); return next; })());
    setSelectedId(b.id);
    setInsertAt(null);
  }, [blocks, onBlocksChange, insertAt]);

  const removeBlock = useCallback((id: string) => {
    onBlocksChange(blocks.filter((b) => b.id !== id));
    setSelectedId((sel) => sel === id ? null : sel);
  }, [blocks, onBlocksChange]);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    onBlocksChange(arrayMove(blocks, i, j));
  }, [blocks, onBlocksChange]);

  const updateConfig = useCallback((id: string, config: SectionConfig) => {
    onBlocksChange(blocks.map((b) => b.id === id ? { ...b, config } : b));
  }, [blocks, onBlocksChange]);

  const openPreview = async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const html = await onPreview();
      setPreviewHtml(html);
    } finally {
      setPreviewLoading(false);
    }
  };

  const selectedBlock = blocks.find((b) => b.id === selectedId) ?? null;
  const activeBlock   = blocks.find((b) => b.id === activeId)   ?? null;

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
          <span className="text-xs text-muted-foreground">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openPreview} variant="outline" size="sm" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" /> Preview
          </Button>
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
                    const icon = BLOCK_ICONS[type];
                    return (
                      <button key={type} type="button" onClick={() => addBlock(type, null)}
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
          <div className="py-8 px-6">
            <div className="mx-auto max-w-2xl">
              {blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[50vh] border-2 border-dashed border-border rounded-2xl text-center">
                  <LayoutTemplate className="h-12 w-12 text-muted-foreground/20 mb-3" />
                  <p className="font-semibold text-muted-foreground">This email is empty</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Click a block in the left panel to start building</p>
                  <button type="button" onClick={() => openPickerAt(null)}
                    className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dashed border-primary text-primary text-sm hover:bg-primary/5 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add first block
                  </button>
                </div>
              ) : (
                <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                  <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-0">
                      <InsertButton onClick={() => openPickerAt(-1)} />
                      {blocks.map((block, i) => (
                        <div key={block.id}>
                          <VisualBlock
                            block={block}
                            isSelected={selectedId === block.id}
                            isFirst={i === 0}
                            isLast={i === blocks.length - 1}
                            isDragging={activeId === block.id}
                            onSelect={() => setSelectedId(selectedId === block.id ? null : block.id)}
                            onRemove={() => removeBlock(block.id)}
                            onMoveUp={() => moveBlock(block.id, -1)}
                            onMoveDown={() => moveBlock(block.id, 1)}
                          />
                          <InsertButton onClick={() => openPickerAt(i)} />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                  <DragOverlay>
                    {activeBlock && (
                      <div className="rounded-xl border-2 border-primary bg-background/80 backdrop-blur px-6 py-4 shadow-2xl opacity-95 pointer-events-none">
                        <div className="pointer-events-none select-none"><BlockPreview block={activeBlock} /></div>
                      </div>
                    )}
                  </DragOverlay>
                </DndContext>
              )}
              <p className="text-xs text-muted-foreground/60 text-center mt-6">
                A footer with an unsubscribe link is always added automatically and can&apos;t be removed here.
              </p>
            </div>
          </div>
        </div>

        {/* Right config panel */}
        <div className={`shrink-0 border-l border-border overflow-y-auto bg-background transition-all duration-200 ${selectedBlock ? 'w-72' : 'w-0 overflow-hidden'}`}>
          {selectedBlock && (
            <div className="p-4 w-72">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center justify-center h-7 w-7 rounded border ${SECTION_META[selectedBlock.type].color}`}>{BLOCK_ICONS[selectedBlock.type]}</span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground leading-none">Block Settings</p>
                    <p className="font-semibold text-sm mt-0.5">{SECTION_META[selectedBlock.type].label}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} className="p-1 rounded hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>
              <BlockConfigForm block={selectedBlock} onChange={(config) => updateConfig(selectedBlock.id, config)} />
            </div>
          )}
        </div>
      </div>

      <BlockPickerDialog open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={addBlock} />
      <PreviewDialog open={previewOpen} onClose={() => setPreviewOpen(false)} loading={previewLoading} html={previewHtml} />
    </div>
  );
}
