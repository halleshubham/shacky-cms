'use client';
import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Upload, Loader2, GripVertical, Trash2, Eye, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { formatDate, statusColor } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState(false);
  const [ingestPreview, setIngestPreview] = useState<any>(null);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [issueData, catData] = await Promise.all([
      api.get<any>(`/api/issues/${id}`),
      api.get<any>('/api/categories'),
    ]);
    setIssue(issueData);
    setCategories(catData);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setIngesting(true);
    try {
      const preview = await api.upload<any>('/api/ingest/preview', formData);
      setIngestPreview(preview);
    } catch (err: any) {
      toast.error(err?.message || 'Preview failed');
    } finally {
      setIngesting(false);
    }
  };

  const handleIngest = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('issueId', id);
    formData.append('categoryIds', JSON.stringify(categoryIds));
    setIngesting(true);
    const toastId = toast.loading('Ingesting articles…');
    try {
      const result = await api.upload<any>('/api/ingest', formData);
      toast.success(`Created ${result.created} articles`, { id: toastId });
      if (result.warnings.length > 0) {
        result.warnings.forEach((w: string) => toast.error(w, { duration: 8000 }));
      }
      setIngestPreview(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Ingestion failed', { id: toastId });
    } finally {
      setIngesting(false);
    }
  };

  const bulkPublish = async (status: 'published' | 'draft') => {
    const toastId = toast.loading(`${status === 'published' ? 'Publishing' : 'Unpublishing'} all…`);
    try {
      await api.post(`/api/issues/${id}/bulk-publish`, { status });
      toast.success('Done', { id: toastId });
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed', { id: toastId });
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!issue) return <div className="text-destructive">Issue not found</div>;

  const posts = issue.posts || [];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/issues"><ArrowLeft className="h-4 w-4" /> Issues</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{issue.title}</h1>
          <p className="text-muted-foreground text-sm">
            Vol. {issue.volumeNumber}, No. {issue.issueNumber} · {formatDate(issue.publishDate)} · {issue.type}
          </p>
        </div>
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-3">
        <Button onClick={() => bulkPublish('published')} className="gap-2">
          <CheckCircle className="h-4 w-4" /> Publish All Articles
        </Button>
        <Button variant="outline" onClick={() => bulkPublish('draft')}>Revert to Draft</Button>
        <Button variant="outline" asChild>
          <Link href={`/admin/posts/new?issueId=${id}`}><Plus className="h-4 w-4" /> Add Article</Link>
        </Button>
      </div>

      {/* Bulk ingestion */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Bulk Ingest from ZIP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a ZIP containing numbered .docx files, Summary.docx, and optional images (1.jpg, 2.jpg…).
          </p>
          <input ref={fileRef} type="file" accept=".zip" onChange={handleFileChange} className="text-sm" />

          {categories.length > 0 && (
            <div className="space-y-1">
              <Label className="text-sm">Default categories (max 3)</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map((cat: any) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryIds((prev) =>
                      prev.includes(cat.id) ? prev.filter((c) => c !== cat.id) : prev.length < 3 ? [...prev, cat.id] : prev
                    )}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      categoryIds.includes(cat.id) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {ingestPreview && (
            <div className="border rounded-md p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Preview: {ingestPreview.totalArticles} articles found</h3>
                {ingestPreview.warnings?.length > 0 && (
                  <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded">{ingestPreview.warnings.length} warning(s)</span>
                )}
              </div>
              {ingestPreview.warnings?.map((w: string, i: number) => (
                <p key={i} className="text-xs text-yellow-700 bg-yellow-50 px-3 py-1 rounded">{w}</p>
              ))}
              <div className="divide-y">
                {ingestPreview.articles.slice(0, 10).map((a: any) => (
                  <div key={a.number} className="py-2">
                    <p className="text-sm font-medium">{a.number}. {a.title}</p>
                    <p className="text-xs text-muted-foreground">by {a.authorName}</p>
                  </div>
                ))}
                {ingestPreview.articles.length > 10 && (
                  <p className="text-xs text-muted-foreground pt-2">…and {ingestPreview.articles.length - 10} more</p>
                )}
              </div>
              <Button onClick={handleIngest} disabled={ingesting} className="gap-2">
                {ingesting && <Loader2 className="h-4 w-4 animate-spin" />}
                Ingest {ingestPreview.totalArticles} Articles
              </Button>
            </div>
          )}

          {ingesting && !ingestPreview && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Analysing ZIP…
            </div>
          )}
        </CardContent>
      </Card>

      {/* Article list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{posts.length} Article{posts.length !== 1 ? 's' : ''}</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No articles yet. Add manually or use bulk ingest.</p>
          ) : (
            <div className="divide-y">
              {posts.map((post: any) => (
                <div key={post.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-mono text-muted-foreground w-6 shrink-0">{post.issueOrder}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.authors?.[0]?.displayName || '—'}
                        {post.publishedAt && ` · ${formatDate(post.publishedAt)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(post.status)}`}>{post.status}</span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/posts/${post.id}`}><Eye className="h-3 w-3" /></Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
