'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SpacerConfig } from '@/lib/page-builder';

export function SpacerPreview({ config }: { config: SpacerConfig }) {
  return (
    <div className="flex items-center justify-center border border-dashed border-border rounded bg-muted/20" style={{ height: Math.max(16, Math.min(80, config.height)) }}>
      <span className="text-[11px] text-muted-foreground">{config.height}px space</span>
    </div>
  );
}

export function SpacerConfigForm({ config, onChange }: { config: SpacerConfig; onChange: (c: SpacerConfig) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Height (px)</Label>
      <Input type="number" min={4} max={120} className="h-8 text-sm" value={config.height} onChange={(e) => onChange({ ...config, height: Math.max(4, Math.min(120, Number(e.target.value) || 24)) })} />
    </div>
  );
}
