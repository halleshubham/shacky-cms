'use client';
import { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await api.get<any[]>('/api/categories');
    setCategories(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (cat?: any) => {
    setEditing(cat || {});
    setForm({ name: cat?.name || '', description: cat?.description || '' });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing?.id) {
        await api.patch(`/api/categories/${editing.id}`, form);
        toast.success('Updated');
      } else {
        await api.post('/api/categories', form);
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

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button onClick={() => openEdit()} className="gap-2"><Plus className="h-4 w-4" /> New Category</Button>
      </div>

      {loading ? <div className="text-muted-foreground">Loading…</div> : (
        <div className="divide-y border rounded-lg bg-card">
          {categories.map((cat) => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium">{cat.name}</p>
                {cat.description && <p className="text-xs text-muted-foreground">{cat.description}</p>}
                <p className="text-xs text-muted-foreground">{cat.postCount || cat._count?.posts || 0} posts</p>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(cat)}><Pencil className="h-3 w-3" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(cat.id, cat.name)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
          {categories.length === 0 && <div className="px-4 py-8 text-center text-muted-foreground text-sm">No categories yet</div>}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit Category' : 'New Category'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} /></div>
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
