'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, Loader2, FileText, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const LS_KEY = 'shacky_ingest_next_vol_no';

function readNext(): { vol: number; no: number } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.vol === 'number' && typeof parsed.no === 'number') return parsed;
  } catch {}
  return null;
}

function saveNext(vol: number, no: number) {
  localStorage.setItem(LS_KEY, JSON.stringify({ vol, no }));
}

interface AiStatus { configured: boolean; supportsImages: boolean; }

export default function IngestPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [preview, setPreview] = useState<any>(null);

  // Issue metadata
  const [volumeNumber, setVolumeNumber] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const [publishDate, setPublishDate] = useState('');
  const [issueType, setIssueType] = useState<'combined' | 'print' | 'blog'>('combined');

  // AI options
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiGenerateImage, setAiGenerateImage] = useState(false);
  const [aiMapCategories, setAiMapCategories] = useState(false);
  const [aiGenerateTags, setAiGenerateTags] = useState(false);

  const [ingesting, setIngesting] = useState(false);

  useEffect(() => {
    // Load categories list and AI status in parallel
    api.get<AiStatus>('/api/ingest/ai-status').then(setAiStatus).catch(() => {});

    // Pre-fill Vol/No from localStorage, then fall back to latest issue + 1
    const saved = readNext();
    if (saved) {
      setVolumeNumber(String(saved.vol));
      setIssueNumber(String(saved.no));
    } else {
      api.get<any>('/api/issues?pageSize=1').then((data) => {
        const latest = data?.data?.[0];
        if (latest) {
          setVolumeNumber(String(latest.volumeNumber));
          setIssueNumber(String(latest.issueNumber + 1));
        } else {
          setVolumeNumber('1');
          setIssueNumber('1');
        }
      }).catch(() => { setVolumeNumber('1'); setIssueNumber('1'); });
    }

    setPublishDate(new Date().toISOString().slice(0, 10));
  }, []);

  const vol = parseInt(volumeNumber) || 0;
  const no = parseInt(issueNumber) || 0;

  const buildTitle = useCallback(() => {
    if (!vol || !no || !publishDate) return '';
    const start = new Date(publishDate + 'T00:00:00Z');
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return `Vol. ${vol}, No. ${no} | ${fmt(start)} - ${fmt(end)}`;
  }, [vol, no, publishDate]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setPreviewing(true);
    const fd = new FormData();
    fd.append('file', f);
    try {
      const result = await api.upload<any>('/api/ingest/preview', fd);
      setPreview(result);
    } catch (err: any) {
      toast.error(err?.message || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  const handleIngest = async () => {
    if (!file || !vol || !no || !publishDate) {
      toast.error('Fill in all issue fields before ingesting');
      return;
    }

    setIngesting(true);
    const toastId = toast.loading('Creating issue and ingesting articles…');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('volumeNumber', String(vol));
      fd.append('issueNumber', String(no));
      fd.append('publishDate', publishDate);
      fd.append('type', issueType);
      fd.append('title', buildTitle());
      fd.append('aiOptions', JSON.stringify({
        generateImage: aiGenerateImage,
        mapCategories: aiMapCategories,
        generateTags: aiGenerateTags,
      }));

      const result = await api.upload<any>('/api/ingest/issue', fd);

      // Persist next suggested values
      saveNext(vol, no + 1);

      toast.success(`Issue created — ${result.created} articles ingested`, { id: toastId });
      if (result.warnings?.length > 0) {
        result.warnings.forEach((w: string) => toast.error(w, { duration: 8000 }));
      }
      router.push(`/admin/issues/${result.issueId}`);
    } catch (err: any) {
      toast.error(err?.message || 'Ingestion failed', { id: toastId });
      setIngesting(false);
    }
  };

  const aiUnavailable = !aiStatus?.configured;
  const imageUnavailable = !aiStatus?.supportsImages;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Upload className="h-6 w-6" /> Ingest Issue from ZIP
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a ZIP of numbered .docx articles + optional Summary.docx and images. A new Issue will be created automatically.
        </p>
      </div>

      {/* ZIP upload */}
      <Card>
        <CardHeader><CardTitle className="text-base">ZIP File</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input ref={fileRef} type="file" accept=".zip" onChange={handleFileChange} className="text-sm" />
          {previewing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing ZIP…
            </div>
          )}
          {preview && (
            <div className="border rounded-md p-4 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {preview.totalArticles} article{preview.totalArticles !== 1 ? 's' : ''} found
                </p>
                {preview.warnings?.length > 0 && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> {preview.warnings.length} warning{preview.warnings.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {preview.warnings?.map((w: string, i: number) => (
                <p key={i} className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/20 px-3 py-1 rounded">{w}</p>
              ))}
              <div className="divide-y max-h-48 overflow-y-auto">
                {preview.articles.map((a: any) => (
                  <div key={a.number} className="py-1.5">
                    <p className="text-sm font-medium">{a.number}. {a.title}</p>
                    {a.authorName && <p className="text-xs text-muted-foreground">by {a.authorName}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Issue metadata */}
      <Card>
        <CardHeader><CardTitle className="text-base">Issue Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Volume No.</Label>
              <Input type="number" min="1" value={volumeNumber} onChange={(e) => setVolumeNumber(e.target.value)} placeholder="e.g. 80" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Issue No.</Label>
              <Input type="number" min="1" value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)} placeholder="e.g. 9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Publish Date</Label>
              <Input type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
            </div>
          </div>

          {buildTitle() && (
            <p className="text-xs text-muted-foreground">
              Title: <span className="font-medium text-foreground">{buildTitle()}</span>
            </p>
          )}

          <div className="space-y-1">
            <Label className="text-xs">Issue Type</Label>
            <div className="flex gap-2">
              {(['combined', 'print', 'blog'] as const).map((t) => (
                <button key={t} type="button" onClick={() => setIssueType(t)}
                  className={`px-3 py-1.5 rounded-md border text-sm capitalize transition-colors ${issueType === t ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI enhancements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI Enhancements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {aiUnavailable ? (
            <p className="text-sm text-muted-foreground">
              AI is not configured.{' '}
              <Link href="/admin/settings" className="text-primary underline underline-offset-2">
                Go to Settings → AI
              </Link>{' '}
              to add an API key, then come back.
            </p>
          ) : (
            <div className="space-y-3">
              {[
                {
                  id: 'generateImage',
                  label: 'Generate featured image',
                  description: 'Use AI to generate a featured image for each article that has no photo in the ZIP.',
                  value: aiGenerateImage,
                  set: setAiGenerateImage,
                  disabled: imageUnavailable,
                  disabledNote: imageUnavailable ? 'Requires OpenAI or Gemini — current provider doesn\'t support image generation.' : undefined,
                },
                {
                  id: 'mapCategories',
                  label: 'Auto-assign categories',
                  description: 'AI reads each article title and excerpt, then picks the best matching categories from your category list.',
                  value: aiMapCategories,
                  set: setAiMapCategories,
                  disabled: false,
                },
                {
                  id: 'generateTags',
                  label: 'Generate & assign tags',
                  description: 'AI generates 3–6 relevant tags per article and creates them if they don\'t exist.',
                  value: aiGenerateTags,
                  set: setAiGenerateTags,
                  disabled: false,
                },
              ].map(({ id, label, description, value, set, disabled, disabledNote }) => (
                <label key={id} className={`flex items-start gap-3 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => !disabled && set(e.target.checked)}
                    disabled={disabled}
                    className="mt-0.5 rounded border-input"
                  />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{disabledNote ?? description}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleIngest}
          disabled={ingesting || !file || !preview || !vol || !no || !publishDate}
          className="gap-2"
        >
          {ingesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          {ingesting ? 'Creating issue…' : `Create Issue & Ingest${preview ? ` ${preview.totalArticles} articles` : ''}`}
        </Button>
        {!preview && !previewing && (
          <p className="text-sm text-muted-foreground">Upload a ZIP first to enable ingestion</p>
        )}
      </div>
    </div>
  );
}
