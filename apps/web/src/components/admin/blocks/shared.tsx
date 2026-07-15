'use client';
import { AlignLeft, AlignCenter, AlignRight, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AlignControl({ value, onChange }: { value: 'left' | 'center' | 'right'; onChange: (v: 'left' | 'center' | 'right') => void }) {
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

export function LinkFields({ url, newTab, onChange }: { url: string; newTab?: boolean; onChange: (url: string, newTab: boolean) => void }) {
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

export function CheckboxRow({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <input type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 rounded" />
      <Label htmlFor={id} className="text-xs font-medium cursor-pointer">{label}</Label>
    </div>
  );
}
