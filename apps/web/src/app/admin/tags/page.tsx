'use client';
import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function TagsPage() {
  const [tags, setTags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTag, setNewTag] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await api.get<any>('/api/tags');
    setTags(res.data ?? res);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    try {
      await api.post('/api/tags', { name: newTag.trim() });
      setNewTag('');
      toast.success('Tag created');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    }
  };

  const deleteTag = async (id: string, name: string) => {
    if (!confirm(`Delete tag "${name}"?`)) return;
    try {
      await api.delete(`/api/tags/${id}`);
      setTags((prev) => prev.filter((t) => t.id !== id));
      toast.success('Deleted');
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Tags</h1>

      <form onSubmit={createTag} className="flex gap-2">
        <Input placeholder="New tag name…" value={newTag} onChange={(e) => setNewTag(e.target.value)} className="max-w-xs" />
        <Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Add Tag</Button>
      </form>

      {loading ? <div className="text-muted-foreground">Loading…</div> : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center gap-1 bg-secondary text-secondary-foreground px-3 py-1 rounded-full text-sm">
              {tag.name}
              {tag._count?.posts !== undefined && <span className="text-xs text-muted-foreground ml-1">({tag._count.posts})</span>}
              <button onClick={() => deleteTag(tag.id, tag.name)} className="ml-1 hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {tags.length === 0 && <p className="text-muted-foreground text-sm">No tags yet</p>}
        </div>
      )}
    </div>
  );
}
