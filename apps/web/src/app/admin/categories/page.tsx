'use client';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string | null;
  postCount?: number;
  _count?: { posts?: number };
  children?: Category[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '', parentId: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await api.get<any>('/api/categories');
    setCategories(res.data ?? res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (cat?: Category) => {
    setEditing(cat || {} as Category);
    setForm({
      name: cat?.name || '',
      description: cat?.description || '',
      parentId: cat?.parentId || '',
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { name: form.name, description: form.description };
      payload.parentId = form.parentId || null;
      if (editing?.id) {
        await api.patch(`/api/categories/${editing.id}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/api/categories', payload);
        toast.success('Created');
      }
      setEditing(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"?`)) return;
    try {
      await api.delete(`/api/categories/${id}`);
      toast.success('Deleted');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    }
  };

  // Separate root and child categories
  const roots = categories.filter((c) => !c.parentId);
  const childrenOf = (id: string) => categories.filter((c) => c.parentId === id);

  // Options for parent selector (exclude the category being edited and its children)
  const editingId = editing?.id;
  const childIds = editingId ? categories.filter((c) => c.parentId === editingId).map((c) => c.id) : [];
  const parentOptions = categories.filter(
    (c) => c.id !== editingId && !childIds.includes(c.id) && !c.parentId,
  );

  const postCount = (cat: Category) => cat.postCount ?? cat._count?.posts ?? 0;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button onClick={() => openEdit()} className="gap-2"><Plus className="h-4 w-4" /> New Category</Button>
      </div>

      {loading ? <div className="text-muted-foreground">Loading…</div> : (
        <div className="divide-y border rounded-lg bg-card">
          {roots.map((cat) => {
            const subs = childrenOf(cat.id);
            return (
              <div key={cat.id}>
                {/* Parent row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{cat.name}</p>
                    {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                    <p className="text-xs text-muted-foreground">{postCount(cat)} posts{subs.length > 0 ? ` · ${subs.length} sub-categories` : ''}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(cat.id, cat.name)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
                {/* Child rows */}
                {subs.map((sub) => (
                  <div key={sub.id} className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-t border-border/50">
                    <div className="flex items-center gap-2">
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground ml-2 shrink-0" />
                      <div>
                        <p className="text-sm">{sub.name}</p>
                        {sub.description && <p className="text-xs text-muted-foreground">{sub.description}</p>}
                        <p className="text-xs text-muted-foreground">{postCount(sub)} posts</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(sub)}><Pencil className="h-3 w-3" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(sub.id, sub.name)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {categories.length === 0 && <div className="px-4 py-8 text-center text-muted-foreground text-sm">No categories yet</div>}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit Category' : 'New Category'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Parent Category</Label>
              <Select value={form.parentId || '__none__'} onValueChange={(v) => setForm(f => ({ ...f, parentId: v === '__none__' ? '' : v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="None (top-level)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (top-level)</SelectItem>
                  {parentOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Only top-level categories can be parents.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
