'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Search, Trash2, Globe, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatDate, statusColor } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function PagesPage() {
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/api/pages');
      setPages(res.data ?? res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = pages.filter((p) =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase())
  );

  const toggleStatus = async (page: any) => {
    const newStatus = page.status === 'published' ? 'draft' : 'published';
    try {
      await api.patch(`/api/pages/${page.id}`, {
        status: newStatus,
        ...(newStatus === 'published' && !page.publishedAt && { publishedAt: new Date().toISOString() }),
      });
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    }
  };

  const deletePage = async (page: any) => {
    if (!confirm(`Delete "${page.title}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/pages/${page.id}`);
      toast.success('Page deleted');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pages</h1>
          <p className="text-muted-foreground">{pages.length} page{pages.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild>
          <Link href="/admin/pages/new"><Plus className="h-4 w-4 mr-1" /> New Page</Link>
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pages…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {search ? 'No pages match your search.' : 'No pages yet. Create your first page.'}
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y border rounded-lg bg-card">
          {filtered.map((page) => (
            <div key={page.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/pages/${page.id}`} className="text-sm font-medium hover:underline truncate block">
                  {page.title}
                </Link>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="font-mono">/{page.slug}</span>
                  <span>·</span>
                  <span>{formatDate(page.createdAt)}</span>
                  {page.publishedAt && page.status === 'published' && (
                    <><span>·</span><span>Published {formatDate(page.publishedAt)}</span></>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleStatus(page)}
                  title={page.status === 'published' ? 'Click to unpublish' : 'Click to publish'}
                  className={`text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 ${statusColor(page.status)}`}
                >
                  {page.status === 'published'
                    ? <><Globe className="h-2.5 w-2.5" /> published</>
                    : <><EyeOff className="h-2.5 w-2.5" /> {page.status}</>
                  }
                </button>
                <button
                  onClick={() => deletePage(page)}
                  className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete page"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
