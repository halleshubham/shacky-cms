'use client';
import { Label } from '@/components/ui/label';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import type { RichTextConfig } from '@/lib/page-builder';

export function RichTextPreview({ config }: { config: RichTextConfig }) {
  if (!config.html || config.html === '<p></p>') {
    return (
      <div className="border-2 border-dashed border-border rounded-lg flex items-center justify-center h-20 bg-muted/20">
        <p className="text-xs text-muted-foreground">Empty rich text — click Edit to write content</p>
      </div>
    );
  }
  return <div className="prose prose-sm max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline pointer-events-none" dangerouslySetInnerHTML={{ __html: config.html }} />;
}

export function RichTextConfigForm({ config, onChange }: { config: RichTextConfig; onChange: (c: RichTextConfig) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium">Content</Label>
      <p className="text-[11px] text-muted-foreground">Use the toolbar to add links, bold, headings, etc.</p>
      <RichTextEditor value={config.html} onChange={(html) => onChange({ ...config, html })} className="min-h-[200px] text-sm" />
    </div>
  );
}
