'use client';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlignControl } from './shared';
import type { ButtonRowConfig, ButtonDef } from '@/lib/page-builder';

export function ButtonRowPreview({ config }: { config: ButtonRowConfig }) {
  const alignClass = { left: 'justify-start', center: 'justify-center', right: 'justify-end' }[config.align] ?? 'justify-start';
  const variantClass = { primary: 'bg-primary text-primary-foreground', outline: 'border border-border text-foreground', ghost: 'text-primary underline' };
  return (
    <div className={`flex flex-wrap gap-3 ${alignClass}`}>
      {config.buttons.map((btn, i) => (
        <span key={i} className={`inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-semibold ${variantClass[btn.variant] ?? variantClass.primary}`}>
          {btn.label || 'Button'}{btn.newTab && <ExternalLink className="h-3 w-3 ml-1.5 opacity-60" />}
        </span>
      ))}
    </div>
  );
}

export function ButtonRowConfigForm({ config, onChange, maxButtons = 4 }: { config: ButtonRowConfig; onChange: (c: ButtonRowConfig) => void; maxButtons?: number }) {
  const updateButton = (i: number, patch: Partial<ButtonDef>) => onChange({ ...config, buttons: config.buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b) });
  const addButton = () => { if (config.buttons.length < maxButtons) onChange({ ...config, buttons: [...config.buttons, { label: 'Button', url: '/', variant: 'outline', newTab: false }] }); };
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
            <div className="space-y-1.5"><Label className="text-xs">Label</Label><Input className="h-7 text-sm" placeholder="Subscribe / Join Us / Contribute" value={btn.label} onChange={(e) => updateButton(i, { label: e.target.value })} /></div>
            <div className="space-y-1.5"><Label className="text-xs">URL</Label><Input className="h-7 text-sm" placeholder="/page or https://..." value={btn.url} onChange={(e) => updateButton(i, { url: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Style</Label>
                <Select value={btn.variant} onValueChange={(v) => updateButton(i, { variant: v as ButtonDef['variant'] })}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="primary">Primary</SelectItem><SelectItem value="outline">Outline</SelectItem><SelectItem value="ghost">Text link</SelectItem></SelectContent>
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
        {config.buttons.length < maxButtons && (
          <button type="button" onClick={addButton} className="w-full py-2 border border-dashed border-border rounded-md text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors flex items-center justify-center gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add button
          </button>
        )}
      </div>
    </div>
  );
}
