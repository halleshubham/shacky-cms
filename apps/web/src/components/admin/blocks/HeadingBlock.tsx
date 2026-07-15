'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlignControl, LinkFields } from './shared';
import type { HeadingBlockConfig } from '@/lib/page-builder';

export function HeadingPreview({ config }: { config: HeadingBlockConfig }) {
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

export function HeadingBlockConfigForm({ config, onChange }: { config: HeadingBlockConfig; onChange: (c: HeadingBlockConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs font-medium">Heading Text</Label><Input className="h-8 text-sm" value={config.text} onChange={(e) => onChange({ ...config, text: e.target.value })} /></div>
      <div className="space-y-1.5"><Label className="text-xs font-medium">Subtext</Label><Input className="h-8 text-sm" placeholder="Optional subtitle" value={config.subtext || ''} onChange={(e) => onChange({ ...config, subtext: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Level</Label>
          <Select value={String(config.level)} onValueChange={(v) => onChange({ ...config, level: Number(v) as 1|2|3 })}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1">H1 — Large</SelectItem><SelectItem value="2">H2 — Section</SelectItem><SelectItem value="3">H3 — Sub-section</SelectItem></SelectContent>
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
