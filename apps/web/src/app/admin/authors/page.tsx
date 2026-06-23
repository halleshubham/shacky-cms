'use client';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Search, Merge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function AuthorsPage() {
  const [authors, setAuthors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editAuthor, setEditAuthor] = useState<any | null>(null);
  const [form, setForm] = useState({ displayName: '', bio: '', email: '' });
  const [saving, setSaving] = useState(false);

  const load = async (q = '') => {
    setLoading(true);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const data = await api.get<any[]>(`/api/authors${params}`);
      setAuthors(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openEdit = (author?: any) => {
    setEditAuthor(author || null);
    setForm(author ? { displayName: author.displayName, bio: author.bio || '', email: author.email || '' } : { displayName: '', bio: '', email: '' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editAuthor?.id) {
        await api.patch(`/api/authors/${editAuthor.id}`, form);
        toast.success('Author updated');
      } else {
        await api.post('/api/authors', form);
        toast.success('Author created');
      }
      setEditAuthor(null);
      await load(search);
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete author "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/authors/${id}`);
      toast.success('Author deleted');
      await load(search);
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Authors</h1>
        <Button onClick={() => openEdit()} className="gap-2"><Plus className="h-4 w-4" /> New Author</Button>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); load(search); }} className="flex gap-2">
        <Input placeholder="Search authors…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button type="submit" variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
      </form>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {authors.map((author) => (
            <Card key={author.id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shrink-0">
                      {author.displayName[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{author.displayName}</p>
                      {author.email && <p className="text-xs text-muted-foreground truncate">{author.email}</p>}
                      <p className="text-xs text-muted-foreground">{author.postCount || 0} posts</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(author)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(author.id, author.displayName)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {author.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{author.bio}</p>}
              </CardContent>
            </Card>
          ))}
          {authors.length === 0 && <p className="text-muted-foreground col-span-full">No authors found.</p>}
        </div>
      )}

      <Dialog open={editAuthor !== null || (editAuthor === null && false)} onOpenChange={(o) => !o && setEditAuthor(undefined as any)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editAuthor?.id ? 'Edit Author' : 'New Author'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Display Name *</Label>
              <Input value={form.displayName} onChange={(e) => setForm(f => ({ ...f, displayName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Bio</Label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                className="w-full text-sm bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditAuthor(undefined as any)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.displayName}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
