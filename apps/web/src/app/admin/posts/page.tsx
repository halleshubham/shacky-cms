'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Star, Copy, Trash2, Globe, EyeOff, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate, statusColor } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function PostsPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const pageSize = 20;

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const data = await api.get<any>(`/api/posts?${params}`);
      setPosts(data.data);
      setTotal(data.total);
      setSelected(new Set());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, statusFilter]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(); };

  const toggleStatus = async (post: any) => {
    const newStatus = post.status === 'published' ? 'draft' : 'published';
    await api.patch(`/api/posts/${post.id}`, {
      status: newStatus,
      ...(newStatus === 'published' && !post.publishedAt && { publishedAt: new Date().toISOString() }),
    });
    await load();
  };

  const toggleFeatured = async (post: any) => {
    await api.patch(`/api/posts/${post.id}`, { isFeatured: !post.isFeatured });
    await load();
  };

  const duplicate = async (postId: string) => {
    try {
      const copy = await api.post<any>(`/api/posts/${postId}/duplicate`);
      toast.success('Post duplicated');
      await load();
      return copy;
    } catch (err: any) { toast.error(err?.message || 'Duplicate failed'); }
  };

  const bulkAction = async (action: string) => {
    if (selected.size === 0) return;
    setBulkOpen(false);
    try {
      await api.post('/api/posts/bulk-action', { action, postIds: Array.from(selected) });
      toast.success(`${selected.size} posts ${action}ed`);
      await load();
    } catch (err: any) { toast.error(err?.message || 'Bulk action failed'); }
  };

  const allSelected = posts.length > 0 && posts.every((p) => selected.has(p.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(posts.map((p) => p.id)));
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Posts</h1>
          <p className="text-muted-foreground">{total} post{total !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild>
          <Link href="/admin/posts/new"><Plus className="h-4 w-4" /> New Post</Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-0">
          <Input placeholder="Search posts…" value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
          <Button type="submit" variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
        </form>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>

        {selected.size > 0 && (
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setBulkOpen(!bulkOpen)} className="gap-1">
              {selected.size} selected <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            {bulkOpen && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-popover border border-border rounded-md shadow-md py-1 min-w-40">
                <button onClick={() => bulkAction('publish')} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Publish</button>
                <button onClick={() => bulkAction('unpublish')} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2"><EyeOff className="h-3.5 w-3.5" /> Unpublish</button>
                <button onClick={() => bulkAction('feature')} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2"><Star className="h-3.5 w-3.5" /> Feature</button>
                <button onClick={() => bulkAction('unfeature')} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted flex items-center gap-2"><Star className="h-3.5 w-3.5" /> Unfeature</button>
                <div className="border-t border-border my-1" />
                <button onClick={() => bulkAction('delete')} className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted text-destructive flex items-center gap-2"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : posts.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No posts found.</CardContent></Card>
      ) : (
        <>
          <div className="divide-y border rounded-lg bg-card">
            {/* Select all header */}
            <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground border-b">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded" />
              <span>Select all on page</span>
            </div>

            {posts.map((post) => (
              <div key={post.id} className="flex items-center gap-3 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(post.id)}
                  onChange={() => setSelected((s) => { const n = new Set(s); n.has(post.id) ? n.delete(post.id) : n.add(post.id); return n; })}
                  className="rounded shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {post.isFeatured && <Star className="h-3.5 w-3.5 text-amber-500 fill-current shrink-0" />}
                    <Link href={`/admin/posts/${post.id}`} className="text-sm font-medium hover:underline truncate">{post.title}</Link>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    <span>{post.authors?.[0]?.displayName || '—'}</span>
                    {post.issue && <><span>·</span><span>{post.issue.title}</span></>}
                    <span>·</span><span>{formatDate(post.createdAt)}</span>
                    {post.viewCount > 0 && <><span>·</span><span>{post.viewCount} views</span></>}
                  </div>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <button
                    onClick={() => toggleFeatured(post)}
                    title={post.isFeatured ? 'Unfeature' : 'Feature'}
                    className={`hidden sm:flex p-1.5 rounded hover:bg-muted transition-colors ${post.isFeatured ? 'text-amber-500' : 'text-muted-foreground'}`}
                  >
                    <Star className={`h-3.5 w-3.5 ${post.isFeatured ? 'fill-current' : ''}`} />
                  </button>
                  <button onClick={() => duplicate(post.id)} title="Duplicate" className="hidden sm:flex p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => toggleStatus(post)}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity ${statusColor(post.status)}`}
                    title="Click to toggle status"
                  >
                    {post.status}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
