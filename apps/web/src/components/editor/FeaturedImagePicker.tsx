'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ImagePlus, X, Upload, Search, Loader2, Check, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface MediaItem {
  id: string;
  url: string;
  altText?: string | null;
  filename: string;
  width?: number | null;
  height?: number | null;
}

interface FeaturedImagePickerProps {
  value: MediaItem | null;
  onChange: (media: MediaItem | null) => void;
}

type Tab = 'library' | 'stock' | 'upload';
type StockSource = 'all' | 'unsplash' | 'pexels' | 'pixabay' | 'wikimedia';

const SOURCE_LABELS: Record<StockSource, string> = {
  all: 'All Sources',
  unsplash: 'Unsplash',
  pexels: 'Pexels',
  pixabay: 'Pixabay',
  wikimedia: 'Wikimedia',
};

const SOURCE_COLORS: Record<string, string> = {
  unsplash: 'bg-black text-white',
  pexels: 'bg-[#05A081] text-white',
  pixabay: 'bg-[#2EC66E] text-white',
  wikimedia: 'bg-[#3366CC] text-white',
};

export function FeaturedImagePicker({ value, onChange }: FeaturedImagePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative group rounded-md overflow-hidden border border-border aspect-video bg-muted">
          <Image src={value.url} alt={value.altText || value.filename} fill className="object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Change</Button>
            <Button size="sm" variant="destructive" onClick={() => onChange(null)}><X className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full aspect-video border-2 border-dashed border-border rounded-md flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-muted/40 transition-colors text-muted-foreground"
        >
          <ImagePlus className="h-8 w-8 opacity-50" />
          <span className="text-xs font-medium">Set featured image</span>
        </button>
      )}

      {open && (
        <MediaPickerModal
          onSelect={(media) => { onChange(media); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function MediaPickerModal({ onSelect, onClose }: { onSelect: (m: MediaItem) => void; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('library');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="font-semibold text-base">Featured Image</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border shrink-0">
          {(['library', 'stock', 'upload'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-medium capitalize transition-colors flex items-center gap-2 ${tab === t ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'stock' && <Globe className="h-3.5 w-3.5" />}
              {t === 'library' ? 'Media Library' : t === 'stock' ? 'Stock Photos' : 'Upload New'}
            </button>
          ))}
        </div>

        {tab === 'library' && <LibraryTab onSelect={onSelect} onClose={onClose} />}
        {tab === 'stock' && <StockTab onSelect={onSelect} />}
        {tab === 'upload' && <UploadTab onSelect={onSelect} />}
      </div>
    </div>
  );
}

// ─── Library Tab ─────────────────────────────────────────────────────────────

function LibraryTab({ onSelect, onClose }: { onSelect: (m: MediaItem) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchMedia = useCallback(async (q = search, p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: '20', mimeType: 'image' });
      if (q) params.set('search', q);
      const res = await api.get<any>(`/api/media?${params}`);
      setMedia(res.data || []);
      setTotalPages(res.totalPages || 1);
    } catch { toast.error('Failed to load media'); }
    finally { setLoading(false); }
  }, [search, page]);

  useEffect(() => { fetchMedia(); }, []);

  return (
    <>
      <div className="p-4 border-b border-border shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); fetchMedia(e.target.value, 1); }} placeholder="Search images…" className="pl-9" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : media.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">No images found</div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {media.map((m) => (
              <button key={m.id} onClick={() => setSelected(m)}
                className={`relative aspect-square rounded-md overflow-hidden border-2 transition-all ${selected?.id === m.id ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-border'}`}>
                <Image src={m.url} alt={m.altText || m.filename} fill className="object-cover" />
                {selected?.id === m.id && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <Check className="h-6 w-6 text-white drop-shadow" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 px-4 py-3 border-t border-border shrink-0">
          <Button size="sm" variant="outline" disabled={page === 1} onClick={() => { setPage(p => p - 1); fetchMedia(search, page - 1); }}>Prev</Button>
          <span className="text-sm text-muted-foreground self-center">{page} / {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page === totalPages} onClick={() => { setPage(p => p + 1); fetchMedia(search, page + 1); }}>Next</Button>
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
        <p className="text-sm text-muted-foreground truncate">{selected ? selected.filename : 'No image selected'}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!selected} onClick={() => selected && onSelect(selected)}>Set Featured Image</Button>
        </div>
      </div>
    </>
  );
}

// ─── Stock Photos Tab ─────────────────────────────────────────────────────────

interface StockPhoto {
  id: string;
  thumbnailUrl: string;
  fullUrl: string;
  downloadUrl: string;
  alt: string;
  credit: string;
  creditUrl?: string;
  source: string;
}

function StockTab({ onSelect }: { onSelect: (m: MediaItem) => void }) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<StockSource>('all');
  const [results, setResults] = useState<StockPhoto[]>([]);
  const [configured, setConfigured] = useState<Record<string, boolean>>({ wikimedia: true });
  const [loading, setLoading] = useState(false);
  const [using, setUsing] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const loadPhotos = useCallback(async (q: string, src: StockSource, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ source: src, page: String(p) });
      if (q.trim()) params.set('q', q.trim());
      const res = await api.get<any>(`/api/stock/search?${params}`);
      setResults(res.results || []);
      setConfigured(res.configured || {});
    } catch { toast.error('Search failed'); }
    finally { setLoading(false); }
  }, []);

  // Auto-load popular photos on mount
  useEffect(() => { loadPhotos('', 'all', 1); }, [loadPhotos]);

  const handleQueryChange = (v: string) => {
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); loadPhotos(v, source, 1); }, 500);
  };

  const handleSourceChange = (s: StockSource) => {
    setSource(s);
    setPage(1);
    loadPhotos(query, s, 1);
  };

  const usePhoto = async (photo: StockPhoto) => {
    setUsing(photo.id);
    try {
      const media = await api.post<MediaItem>('/api/stock/use', {
        downloadUrl: photo.downloadUrl,
        fullUrl: photo.fullUrl,
        alt: photo.alt,
        credit: photo.credit,
        source: photo.source,
      });
      toast.success('Image added to your media library');
      onSelect(media);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to download image');
    } finally {
      setUsing(null);
    }
  };

  const unconfiguredSources = Object.entries(configured).filter(([, v]) => !v).map(([k]) => k);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Search bar + source filter */}
      <div className="p-4 border-b border-border space-y-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); loadPhotos(query, source, 1); }}>
            <Input value={query} onChange={(e) => handleQueryChange(e.target.value)} placeholder="Search copyright-free photos…" className="pl-9 pr-20" />
          </form>
        </div>

        {/* Source tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {(Object.keys(SOURCE_LABELS) as StockSource[]).map((s) => {
            const isConfigured = s === 'all' || s === 'wikimedia' || configured[s];
            return (
              <button
                key={s}
                onClick={() => handleSourceChange(s)}
                disabled={!isConfigured}
                title={!isConfigured ? `Add ${SOURCE_LABELS[s]} API key in Settings → Stock Photos` : undefined}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  source === s
                    ? (SOURCE_COLORS[s] || 'bg-primary text-primary-foreground')
                    : isConfigured
                    ? 'bg-muted text-muted-foreground hover:bg-muted/80'
                    : 'bg-muted text-muted-foreground/40 cursor-not-allowed'
                }`}
              >
                {SOURCE_LABELS[s]}
                {!isConfigured && ' 🔑'}
              </button>
            );
          })}
        </div>

        {unconfiguredSources.length > 0 && (
          <p className="text-xs text-muted-foreground">
            🔑 = API key needed. Configure in{' '}
            <a href="/admin/settings" target="_blank" className="text-primary underline">Settings → Stock Photos</a>.
            Wikimedia Commons works without a key.
          </p>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {query ? `No photos found for "${query}". Try different keywords.` : 'No photos available. Check your API keys in Settings.'}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {results.map((photo) => (
              <div key={photo.id} className="group relative rounded-lg overflow-hidden border border-border bg-muted aspect-video">
                <img src={photo.thumbnailUrl} alt={photo.alt} className="w-full h-full object-cover" loading="lazy" />

                {/* Source badge */}
                <div className={`absolute top-2 left-2 text-[10px] font-semibold px-1.5 py-0.5 rounded ${SOURCE_COLORS[photo.source] || 'bg-black/60 text-white'}`}>
                  {photo.source}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-3">
                  <Button
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => usePhoto(photo)}
                    disabled={using === photo.id}
                  >
                    {using === photo.id ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Downloading…</>
                    ) : (
                      <>Use This Photo</>
                    )}
                  </Button>
                  {photo.creditUrl ? (
                    <a
                      href={photo.creditUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-white/70 hover:text-white text-center line-clamp-2 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {photo.credit}
                    </a>
                  ) : (
                    <p className="text-[10px] text-white/70 text-center line-clamp-2">{photo.credit}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {results.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          <p className="text-xs text-muted-foreground">Credits are saved as alt text in your media library</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page === 1 || loading} onClick={() => { const p = page - 1; setPage(p); loadPhotos(query, source, p); }}>Prev</Button>
            <span className="text-sm text-muted-foreground self-center">Page {page}</span>
            <Button size="sm" variant="outline" disabled={loading || results.length < 20} onClick={() => { const p = page + 1; setPage(p); loadPhotos(query, source, p); }}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Upload Tab ───────────────────────────────────────────────────────────────

function UploadTab({ onSelect }: { onSelect: (m: MediaItem) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api.upload<MediaItem>('/api/media/upload', form);
      toast.success('Image uploaded');
      onSelect(result);
    } catch (err: any) {
      toast.error(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="w-full max-w-sm aspect-video border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-3 hover:border-primary hover:bg-muted/30 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <><Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Uploading…</span></>
        ) : (
          <><Upload className="h-10 w-10 text-muted-foreground opacity-50" /><span className="text-sm font-medium">Click to choose an image</span><span className="text-xs text-muted-foreground">JPG, PNG, WebP, GIF</span></>
        )}
      </button>
    </div>
  );
}
