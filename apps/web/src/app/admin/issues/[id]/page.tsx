'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plus, Upload, Loader2, Eye, CheckCircle,
  Link2, Search, X, Zap, Pencil, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDate, statusColor } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ZIP ingest
  const [ingesting, setIngesting] = useState(false);
  const [ingestPreview, setIngestPreview] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Attach existing posts
  const [attachSearch, setAttachSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attaching, setAttaching] = useState(false);
  const [autoAttaching, setAutoAttaching] = useState(false);

  // Inline edit for vol/issue/title/publishDate
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ volumeNumber: '', issueNumber: '', title: '', publishDate: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const issueData = await api.get<any>(`/api/issues/${id}`);
    setIssue(issueData);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Debounced search for unassigned posts
  useEffect(() => {
    if (!attachSearch.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.get<any>(`/api/posts?unassigned=true&search=${encodeURIComponent(attachSearch)}&pageSize=20`);
        setSearchResults(data.data || []);
      } catch { /* ignore */ } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [attachSearch]);

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

  const handleAutoAttach = async () => {
    setAutoAttaching(true);
    try {
      const result = await api.post<{ attached: number }>(`/api/issues/${id}/auto-attach`, {});
      if (result.attached === 0) {
        toast('No unassigned posts found on this issue\'s publish date.');
      } else {
        toast.success(`Attached ${result.attached} post${result.attached !== 1 ? 's' : ''}`);
        await load();
      }
    } catch (err: any) {
      toast.error(err?.message || 'Auto-attach failed');
    } finally {
      setAutoAttaching(false);
    }
  };

  const handleAttachSelected = async () => {
    if (selected.size === 0) return;
    setAttaching(true);
    try {
      const result = await api.post<{ attached: number }>(`/api/issues/${id}/attach-posts`, { postIds: [...selected] });
      toast.success(`Attached ${result.attached} post${result.attached !== 1 ? 's' : ''}`);
      setSelected(new Set());
      setAttachSearch('');
      setSearchResults([]);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to attach');
    } finally {
      setAttaching(false);
    }
  };

  const toggleSelect = (postId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });

  const toDatetimeLocal = (iso: string) => {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openEdit = () => {
    setEditForm({
      volumeNumber: String(issue.volumeNumber),
      issueNumber: String(issue.issueNumber),
      title: issue.title,
      publishDate: issue.publishDate ? toDatetimeLocal(issue.publishDate) : '',
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/issues/${id}`, {
        volumeNumber: parseInt(editForm.volumeNumber),
        issueNumber: parseInt(editForm.issueNumber),
        title: editForm.title,
        ...(editForm.publishDate && { publishDate: new Date(editForm.publishDate).toISOString() }),
      });
      toast.success('Issue updated');
      setEditing(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Update failed');
    } finally {
      setSaving(false);
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
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" asChild className="mt-1">
          <Link href="/admin/issues"><ArrowLeft className="h-4 w-4" /> Issues</Link>
        </Button>
        {editing ? (
          <div className="flex-1 space-y-2">
            <Input
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              className="text-lg font-semibold h-9"
              placeholder="Issue title"
            />
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-muted-foreground shrink-0">Vol.</label>
              <Input
                type="number" min="1"
                value={editForm.volumeNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, volumeNumber: e.target.value }))}
                className="w-20 h-7 text-sm"
              />
              <label className="text-xs text-muted-foreground shrink-0">No.</label>
              <Input
                type="number" min="1"
                value={editForm.issueNumber}
                onChange={(e) => setEditForm((f) => ({ ...f, issueNumber: e.target.value }))}
                className="w-20 h-7 text-sm"
              />
              <label className="text-xs text-muted-foreground shrink-0">Publish date</label>
              <Input
                type="datetime-local"
                value={editForm.publishDate}
                onChange={(e) => setEditForm((f) => ({ ...f, publishDate: e.target.value }))}
                className="h-7 text-sm w-auto"
              />
              <Button size="sm" onClick={saveEdit} disabled={saving || !editForm.title || !editForm.volumeNumber || !editForm.issueNumber} className="gap-1 h-7 px-2">
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 px-2">
                <X className="h-3 w-3" />
              </Button>
            </div>
            {editForm.publishDate && (
              <p className="text-xs text-muted-foreground">Saving will recompute publish timestamps for all articles in this issue.</p>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold">{issue.title}</h1>
              <p className="text-muted-foreground text-sm">
                Vol. {issue.volumeNumber}, No. {issue.issueNumber} · {formatDate(issue.publishDate)} · {issue.type}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={openEdit} className="gap-1 shrink-0 mt-1">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      <div className="flex items-center gap-3">
        <Button onClick={() => bulkPublish('published')} className="gap-2">
          <CheckCircle className="h-4 w-4" /> Publish All
        </Button>
        <Button variant="outline" onClick={() => bulkPublish('draft')}>Revert to Draft</Button>
        <Button variant="outline" asChild>
          <Link href={`/admin/posts/new?issueId=${id}`}><Plus className="h-4 w-4" /> Add Article</Link>
        </Button>
      </div>

      {/* Attach existing articles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4" /> Attach Existing Articles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto-attach by date */}
          <div className="flex items-start gap-3 p-3 rounded-md border bg-muted/30">
            <Zap className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Auto-attach by publish date</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Finds all unassigned posts whose publish date matches{' '}
                <span className="font-medium">{formatDate(issue.publishDate)}</span> and adds them to this issue.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleAutoAttach} disabled={autoAttaching} className="shrink-0 gap-1.5">
              {autoAttaching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              Auto-attach
            </Button>
          </div>

          {/* Manual search */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                value={attachSearch}
                onChange={(e) => setAttachSearch(e.target.value)}
                placeholder="Search unassigned posts by title…"
                className="pl-8 pr-8"
              />
              {attachSearch && (
                <button onClick={() => { setAttachSearch(''); setSearchResults([]); setSelected(new Set()); }}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {searching && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Searching…
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
                {searchResults.map((post: any) => (
                  <label key={post.id} className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                    <input
                      type="checkbox"
                      checked={selected.has(post.id)}
                      onChange={() => toggleSelect(post.id)}
                      className="mt-0.5 rounded border-input"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{post.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {post.authors?.[0]?.displayName || '—'}
                        {post.publishedAt && ` · ${formatDate(post.publishedAt)}`}
                        {` · ${post.status}`}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {attachSearch && !searching && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">No unassigned posts match your search.</p>
            )}

            {selected.size > 0 && (
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={handleAttachSelected} disabled={attaching} className="gap-1.5">
                  {attaching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                  Attach {selected.size} selected
                </Button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-muted-foreground hover:text-foreground">
                  Clear selection
                </button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ZIP ingest */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Ingest from ZIP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Upload a ZIP containing numbered .docx files, Summary.docx, and optional images.
          </p>
          <input ref={fileRef} type="file" accept=".zip" onChange={handleFileChange} className="text-sm" />

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
            <p className="text-sm text-muted-foreground">No articles yet.</p>
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
