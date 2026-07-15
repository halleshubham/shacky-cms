'use client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckboxRow } from './shared';
import type { IssueArticlesConfig, Surface } from '@/lib/page-builder';

function SkeletonBox({ className = '' }: { className?: string }) {
  return <div className={`rounded bg-muted animate-pulse ${className}`} />;
}

export function IssueArticlesPreview({ config, surface = 'homepage' }: { config: IssueArticlesConfig; surface?: Surface }) {
  const cols = surface === 'email' ? 2 : (config.columns ?? 4);
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
        {config.coverCount} cover article{config.coverCount !== 1 ? 's' : ''} + all remaining articles, {cols}-col grid
      </p>
      <div className="space-y-1">
        <SkeletonBox className="aspect-[21/9] w-full" />
        <SkeletonBox className="h-5 w-3/4 mt-1" />
        {config.showExcerpt && <SkeletonBox className="h-3 w-full mt-1" />}
      </div>
      <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(cols, 4)}, minmax(0, 1fr))` }}>
        {Array.from({ length: Math.min(cols, 4) }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            {config.showImages && <SkeletonBox className="aspect-[16/9] w-full" />}
            <SkeletonBox className="h-2.5 w-full" />
            {config.showExcerpt && <SkeletonBox className="h-2 w-4/5" />}
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/70">…and every other article in the issue, no cap</p>
    </div>
  );
}

export interface IssueOption { id: string; title: string }

export function IssueArticlesConfigForm({
  config, onChange, surface, issues,
}: {
  config: IssueArticlesConfig;
  onChange: (c: IssueArticlesConfig) => void;
  surface: Surface;
  issues?: IssueOption[];
}) {
  return (
    <div className="space-y-4">
      {surface === 'homepage' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Issue Source</Label>
            <Select value={config.source} onValueChange={(v) => onChange({ ...config, source: v as IssueArticlesConfig['source'] })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="latest_issue">Latest Issue</SelectItem>
                <SelectItem value="specific">Specific Issue</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {config.source === 'specific' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Issue</Label>
              {issues && issues.length > 0 ? (
                <Select value={config.issueId || '__none__'} onValueChange={(v) => onChange({ ...config, issueId: v === '__none__' ? '' : v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Choose issue" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Choose issue —</SelectItem>
                    {issues.map((i) => <SelectItem key={i.id} value={i.id}>{i.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input className="h-8 text-sm" placeholder="Issue ID" value={config.issueId || ''} onChange={(e) => onChange({ ...config, issueId: e.target.value })} />
              )}
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Columns</Label>
            <Select value={String(config.columns)} onValueChange={(v) => onChange({ ...config, columns: Number(v) as 2 | 3 | 4 })}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="2">2 columns</SelectItem><SelectItem value="3">3 columns</SelectItem><SelectItem value="4">4 columns</SelectItem></SelectContent>
            </Select>
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Cover articles</Label>
        <Input type="number" min={0} max={5} className="h-8 text-sm" value={config.coverCount}
          onChange={(e) => onChange({ ...config, coverCount: Math.max(0, Math.min(5, Number(e.target.value) || 0)) })} />
        <p className="text-[11px] text-muted-foreground">
          Shown large at the top. Every other article in the {surface === 'email' ? 'issue' : 'grid'} renders below — no cap.
        </p>
      </div>

      {surface === 'email' && (
        <>
          <CheckboxRow id="ia-images" checked={config.showImages} onChange={(v) => onChange({ ...config, showImages: v })} label="Show featured images" />
          <CheckboxRow id="ia-excerpt" checked={config.showExcerpt} onChange={(v) => onChange({ ...config, showExcerpt: v })} label="Show excerpt/summary" />
          {config.showExcerpt && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Excerpt length (grid articles)</Label>
              <Input type="number" min={50} max={400} step={10} className="h-8 text-sm" value={config.excerptLength}
                onChange={(e) => onChange({ ...config, excerptLength: Math.max(50, Math.min(400, Number(e.target.value) || 150)) })} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
