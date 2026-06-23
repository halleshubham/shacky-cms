'use client';
import { useState, useEffect, useRef } from 'react';
import { Upload, Search, Grid, List, Trash2, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { formatDate, bytesToHuman } from '@/lib/utils';
import toast from 'react-hot-toast';
import Image from 'next/image';

export default function MediaPage() {
  const [media, setMedia] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const pageSize = 40;

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) params.set('search', search);
      const data = await api.get<any>(`/api/media?${params}`);
      setMedia(data.data);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page]);

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArr = Array.from(files);
    setUploading(true);
    let uploaded = 0;
    for (const file of fileArr) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        await api.upload('/api/media/upload', formData);
        uploaded++;
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}: ${err.message}`);
      }
    }
    if (uploaded > 0) toast.success(`Uploaded ${uploaded} file${uploaded !== 1 ? 's' : ''}`);
    setUploading(false);
    await load();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) await uploadFiles(e.dataTransfer.files);
  };

  const deleteMedia = async (id: string) => {
    try {
      await api.delete(`/api/media/${id}`);
      setMedia((prev) => prev.filter((m) => m.id !== id));
      if (selected?.id === id) setSelected(null);
      toast.success('Deleted');
    } catch (err: any) {
      if (err?.statusCode === 409) {
        if (window.confirm(`${err.message}\n\nDelete anyway?`)) {
          await api.delete(`/api/media/${id}?force=true`);
          setMedia((prev) => prev.filter((m) => m.id !== id));
          if (selected?.id === id) setSelected(null);
          toast.success('Deleted');
        }
      } else {
        toast.error(err?.message || 'Delete failed');
      }
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Media Library</h1>
          <p className="text-muted-foreground">{total} file{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setView(v => v === 'grid' ? 'list' : 'grid')}>
            {view === 'grid' ? <List className="h-4 w-4" /> : <Grid className="h-4 w-4" />}
          </Button>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,application/pdf" className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)} />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
            <Upload className="h-4 w-4" /> {uploading ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>

      {/* Drag & drop zone */}
      <div
        ref={dropRef}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-border rounded-lg p-6 text-center text-muted-foreground text-sm hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-6 w-6 mx-auto mb-2 opacity-50" />
        Drag & drop files here, or click to browse
      </div>

      {/* Search */}
      <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(); }} className="flex gap-2">
        <Input placeholder="Search by filename…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Button type="submit" variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
      </form>

      <div className="flex gap-6">
        {/* Grid/List */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="text-muted-foreground">Loading…</div>
          ) : view === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {media.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelected(m)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${selected?.id === m.id ? 'border-primary' : 'border-transparent hover:border-border'}`}
                >
                  {m.mimeType?.startsWith('image/') ? (
                    <img src={m.url} alt={m.altText || m.originalName} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted text-xs text-muted-foreground p-2 text-center">
                      {m.originalName}
                    </div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="divide-y border rounded-lg bg-card">
              {media.map((m) => (
                <div key={m.id} className={`flex items-center gap-3 px-4 py-2 cursor-pointer hover:bg-muted/30 transition-colors ${selected?.id === m.id ? 'bg-primary/5' : ''}`} onClick={() => setSelected(m)}>
                  {m.mimeType?.startsWith('image/') ? (
                    <img src={m.url} alt="" className="h-10 w-10 object-cover rounded shrink-0" />
                  ) : (
                    <div className="h-10 w-10 bg-muted rounded shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{m.originalName}</p>
                    <p className="text-xs text-muted-foreground">{bytesToHuman(m.size)} · {formatDate(m.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-72 shrink-0 border rounded-lg p-4 space-y-4 h-fit sticky top-6">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Details</h3>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {selected.mimeType?.startsWith('image/') && (
              <img src={selected.url} alt={selected.altText || ''} className="w-full rounded-md border" />
            )}
            <div className="space-y-2 text-xs">
              <div><span className="text-muted-foreground">Name:</span> <span className="font-medium break-all">{selected.originalName}</span></div>
              <div><span className="text-muted-foreground">Size:</span> <span>{bytesToHuman(selected.size)}</span></div>
              {selected.width && <div><span className="text-muted-foreground">Dimensions:</span> <span>{selected.width}×{selected.height}</span></div>}
              <div><span className="text-muted-foreground">Type:</span> <span>{selected.mimeType}</span></div>
              <div><span className="text-muted-foreground">Uploaded:</span> <span>{formatDate(selected.createdAt)}</span></div>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">URL</p>
              <Input readOnly value={selected.url} className="text-xs" onClick={(e) => (e.target as HTMLInputElement).select()} />
            </div>
            <Button variant="destructive" size="sm" className="w-full gap-2" onClick={() => deleteMedia(selected.id)}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
