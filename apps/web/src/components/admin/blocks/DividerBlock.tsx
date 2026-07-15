'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DividerConfig } from '@/lib/page-builder';

export function DividerPreview({ config }: { config: DividerConfig }) {
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

export function DividerConfigForm({ config, onChange }: { config: DividerConfig; onChange: (c: DividerConfig) => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5"><Label className="text-xs font-medium">Label (optional)</Label><Input className="h-8 text-sm" placeholder="e.g. More from this week" value={config.label || ''} onChange={(e) => onChange({ ...config, label: e.target.value })} /></div>
    </div>
  );
}
