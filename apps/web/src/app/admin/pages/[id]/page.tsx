'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, ExternalLink, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { FeaturedImagePicker } from '@/components/editor/FeaturedImagePicker';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function EditPagePage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [status, setStatus] = useState('draft');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [featuredMedia, setFeaturedMedia] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState<Date | null>(null);

  const load = async () => {
    const data = await api.get<any>(`/api/pages/${id}`);
    setPage(data);
    setTitle(data.title);
    setSlug(data.slug);
    setContent(data.content || '');
    setExcerpt(data.excerpt || '');
    setStatus(data.status);
    setSeoTitle(data.seoTitle || '');
    setSeoDescription(data.seoDescription || '');
    setFeaturedMedia(data.featuredMedia || null);
  };

  useEffect(() => { load(); }, [id]);

  const save = useCallback(async (isAuto = false) => {
    if (!page) return;
    if (!isAuto) setSaving(true);
    try {
      await api.patch(`/api/pages/${id}`, {
        title,
        slug: slug || undefined,
        content,
        excerpt: excerpt || null,
        status,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        featuredMediaId: featuredMedia?.id || null,
        ...(status === 'published' && !page.publishedAt && { publishedAt: new Date().toISOString() }),
      });
      if (isAuto) setAutoSaved(new Date());
      else toast.success('Page saved');
    } catch (err: any) {
      if (!isAuto) toast.error(err?.message || 'Save failed');
    } finally {
      if (!isAuto) setSaving(false);
    }
  }, [page, id, title, slug, content, excerpt, status, seoTitle, seoDescription, featuredMedia]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => save(true), 30000);
    return () => clearInterval(timer);
  }, [save]);

  if (!page) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/pages"><ArrowLeft className="h-4 w-4" /> Pages</Link>
          </Button>
          <div>
            <h1 className="text-xl font-bold truncate max-w-md">{page.title}</h1>
            {autoSaved && <p className="text-xs text-muted-foreground">Auto-saved {formatDateTime(autoSaved)}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/pages/${id}/builder`} className="gap-1.5">
              <LayoutTemplate className="h-3.5 w-3.5" /> Page Builder
            </Link>
          </Button>
          {page.status === 'published' && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer" className="gap-1">
                <ExternalLink className="h-3.5 w-3.5" /> View
              </a>
            </Button>
          )}
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => save()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Page title"
            className="text-lg font-semibold"
          />
          <RichTextEditor value={content} onChange={setContent} placeholder="Write your page content here…" />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Featured image */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Featured Image</CardTitle></CardHeader>
            <CardContent>
              <FeaturedImagePicker value={featuredMedia} onChange={setFeaturedMedia} />
            </CardContent>
          </Card>

          {/* URL slug */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">URL Slug</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">/</span>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="page-slug"
                  className="text-sm font-mono"
                />
              </div>
            </CardContent>
          </Card>

          {/* Excerpt */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Excerpt</CardTitle></CardHeader>
            <CardContent>
              <Textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="Short summary…"
                rows={3}
                className="text-sm resize-none"
              />
            </CardContent>
          </Card>

          {/* SEO */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">SEO</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Meta title</Label>
                <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title} className="text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Meta description</Label>
                <Textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  placeholder={excerpt}
                  rows={3}
                  className="text-sm mt-1 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Timestamps */}
          <Card>
            <CardContent className="py-3 space-y-1">
              <p className="text-xs text-muted-foreground">Created: {formatDateTime(page.createdAt)}</p>
              {page.publishedAt && <p className="text-xs text-muted-foreground">Published: {formatDateTime(page.publishedAt)}</p>}
              {page.updatedAt && <p className="text-xs text-muted-foreground">Updated: {formatDateTime(page.updatedAt)}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
