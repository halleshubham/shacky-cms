'use client';
import { useState } from 'react';
import {
  Sparkles, FileText, AlignLeft, Search, Loader2, ChevronDown, ChevronUp,
  Wand2, RotateCcw, Copy, Check, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface AIWritingPanelProps {
  title: string;
  content: string;
  excerpt: string;
  onContentGenerated: (content: string) => void;
  onExcerptGenerated: (excerpt: string) => void;
  onSEOGenerated: (seoTitle: string, seoDescription: string) => void;
}

type ActionKey = 'generate' | 'excerpt' | 'seo' | 'improve';

export function AIWritingPanel({
  title,
  content,
  excerpt,
  onContentGenerated,
  onExcerptGenerated,
  onSEOGenerated,
}: AIWritingPanelProps) {
  const [loading, setLoading] = useState<ActionKey | null>(null);
  const [brief, setBrief] = useState('');
  const [tone, setTone] = useState<string>('journalistic');
  const [wordCount, setWordCount] = useState('600');
  const [instruction, setInstruction] = useState('');
  const [expanded, setExpanded] = useState<ActionKey | null>('generate');
  const [lastResult, setLastResult] = useState<{ type: ActionKey; preview: string } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const run = async (action: ActionKey) => {
    setLoading(action);
    setAiError(null);
    try {
      if (action === 'generate') {
        if (!title.trim()) { toast.error('Add a title first'); setLoading(null); return; }
        const result = await api.post<{
          content: string; excerpt: string; seoTitle: string; seoDescription: string;
        }>('/api/ai/generate-content', {
          title, brief: brief || undefined, tone, wordCount: parseInt(wordCount),
        });
        onContentGenerated(result.content);
        if (result.excerpt) onExcerptGenerated(result.excerpt);
        if (result.seoTitle) onSEOGenerated(result.seoTitle, result.seoDescription);
        setLastResult({ type: 'generate', preview: `Generated ${result.content.length} chars of content` });
        toast.success('Content generated!');
      }

      if (action === 'improve') {
        if (!content.trim()) { toast.error('Write some content first'); setLoading(null); return; }
        const result = await api.post<{ content: string; excerpt: string; seoTitle: string; seoDescription: string }>(
          '/api/ai/generate-content',
          { title, existingContent: content, instruction: instruction || 'Improve the writing, fix grammar, and enhance clarity.', tone },
        );
        onContentGenerated(result.content);
        setLastResult({ type: 'improve', preview: 'Content improved' });
        toast.success('Content improved!');
      }

      if (action === 'excerpt') {
        if (!content.trim()) { toast.error('Write some content first'); setLoading(null); return; }
        const result = await api.post<{ excerpt: string }>('/api/ai/generate-excerpt', { content, title });
        onExcerptGenerated(result.excerpt);
        setLastResult({ type: 'excerpt', preview: result.excerpt });
        toast.success('Excerpt generated!');
      }

      if (action === 'seo') {
        if (!title.trim() || !content.trim()) { toast.error('Add title and content first'); setLoading(null); return; }
        const result = await api.post<{ seoTitle: string; seoDescription: string }>(
          '/api/ai/suggest-seo', { title, content }
        );
        onSEOGenerated(result.seoTitle, result.seoDescription);
        setLastResult({ type: 'seo', preview: result.seoTitle });
        toast.success('SEO suggestions applied!');
      }
    } catch (err: any) {
      const msg = err?.message || 'AI request failed';
      setAiError(msg);
      if (msg.includes('not configured')) {
        toast.error('AI not configured — go to Settings to add your API key', { duration: 5000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(null);
    }
  };

  const toggle = (key: ActionKey) => setExpanded(expanded === key ? null : key);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">AI Assistant</span>
      </div>

      {aiError && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{aiError}</span>
        </div>
      )}

      {/* Generate article */}
      <ActionBlock
        icon={<FileText className="h-4 w-4" />}
        label="Write Article"
        description="Generate a complete article from your title"
        open={expanded === 'generate'}
        onToggle={() => toggle('generate')}
        onRun={() => run('generate')}
        loading={loading === 'generate'}
        disabled={!title.trim()}
      >
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Context / Brief</Label>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Key points, background info, angle to take…"
              rows={3}
              className="w-full mt-1 text-xs bg-background border border-input rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="journalistic">Journalistic</SelectItem>
                  <SelectItem value="formal">Formal</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="casual">Casual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Word count</Label>
              <Select value={wordCount} onValueChange={setWordCount}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="300">~300 words</SelectItem>
                  <SelectItem value="600">~600 words</SelectItem>
                  <SelectItem value="900">~900 words</SelectItem>
                  <SelectItem value="1500">~1500 words</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </ActionBlock>

      {/* Improve existing */}
      <ActionBlock
        icon={<Wand2 className="h-4 w-4" />}
        label="Improve Draft"
        description="Rewrite or polish your existing content"
        open={expanded === 'improve'}
        onToggle={() => toggle('improve')}
        onRun={() => run('improve')}
        loading={loading === 'improve'}
        disabled={!content.trim()}
      >
        <div>
          <Label className="text-xs">Instruction</Label>
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Improve clarity and flow, fix grammar, make it more concise…"
            rows={2}
            className="w-full mt-1 text-xs bg-background border border-input rounded p-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </ActionBlock>

      {/* Excerpt */}
      <ActionBlock
        icon={<AlignLeft className="h-4 w-4" />}
        label="Generate Excerpt"
        description="Create a 2-sentence summary from content"
        open={expanded === 'excerpt'}
        onToggle={() => toggle('excerpt')}
        onRun={() => run('excerpt')}
        loading={loading === 'excerpt'}
        disabled={!content.trim()}
        compact
      />

      {/* SEO */}
      <ActionBlock
        icon={<Search className="h-4 w-4" />}
        label="Suggest SEO"
        description="AI-optimised SEO title and meta description"
        open={expanded === 'seo'}
        onToggle={() => toggle('seo')}
        onRun={() => run('seo')}
        loading={loading === 'seo'}
        disabled={!title.trim() || !content.trim()}
        compact
      />

      {lastResult && (
        <p className="text-xs text-muted-foreground mt-2 italic truncate">
          ✓ {lastResult.preview}
        </p>
      )}
    </div>
  );
}

function ActionBlock({
  icon, label, description, open, onToggle, onRun, loading, disabled, children, compact,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  open: boolean;
  onToggle: () => void;
  onRun: () => void;
  loading: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <span className="text-xs font-medium">{label}</span>
        </div>
        {open ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border">
          <p className="text-xs text-muted-foreground pt-2">{description}</p>
          {children}
          <Button
            size="sm"
            className="w-full gap-2 mt-1"
            onClick={onRun}
            disabled={loading || disabled}
          >
            {loading ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
            ) : (
              <><Sparkles className="h-3 w-3" /> {label}</>
            )}
          </Button>
          {disabled && (
            <p className="text-xs text-muted-foreground text-center">
              {label === 'Write Article' ? 'Add a title first' : 'Add content first'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
