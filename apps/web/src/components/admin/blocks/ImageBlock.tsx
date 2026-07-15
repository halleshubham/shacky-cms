'use client';
import { ImageIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LinkFields } from './shared';
import type { ImageBlockConfig } from '@/lib/page-builder';

export function ImageBlockPreview({ config }: { config: ImageBlockConfig }) {
  const alignClass = { left: 'mr-auto', center: 'mx-auto', right: 'ml-auto', full: 'w-full' }[config.align] ?? 'mx-auto';
  if (!config.src) {
    return (
      <div className="border-2 border-dashed border-border rounded-lg flex items-center justify-center h-32 bg-muted/20">
        <div className="text-center text-muted-foreground"><ImageIcon className="h-7 w-7 mx-auto mb-1 opacity-40" /><p className="text-xs">No image URL set</p></div>
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

export function ImageBlockConfigForm({ config, onChange }: { config: ImageBlockConfig; onChange: (c: ImageBlockConfig) => void }) {
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
