'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, FileText } from 'lucide-react';
import { ArticleCard } from '@/components/public/ArticleCard';
import { Pagination } from '@/components/public/Pagination';

const API = '';

export function SearchResults({ q, page }: { q: string; page: number }) {
  const [query, setQuery] = useState(q);
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setQuery(q);
  }, [q]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query.trim(), page);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, page]);

  const doSearch = async (term: string, p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/public/search?q=${encodeURIComponent(term)}&page=${p}&pageSize=12`);
      if (res.ok) setResults(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (value: string) => {
    setQuery(value);
    const params = new URLSearchParams();
    if (value.trim()) params.set('q', value.trim());
    router.replace(`/search?${params.toString()}`, { scroll: false });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold mb-6">Search</h1>

      <form onSubmit={handleSubmit} className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="Search articles, topics, authors…"
          autoFocus
          className="w-full pl-12 pr-4 py-3 text-base border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
        )}
      </form>

      {/* No query */}
      {!query.trim() && (
        <div className="text-center py-20 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>Start typing to search articles</p>
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-muted-foreground">
              {results.total === 0
                ? `No results for "${results.query}"`
                : `${results.total} result${results.total !== 1 ? 's' : ''} for "${results.query}"`}
            </p>
          </div>

          {results.data.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="font-medium">No articles found</p>
              <p className="text-sm mt-1">Try different keywords or browse by category.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.data.map((p: any) => (
                <ArticleCard key={p.id} post={p} />
              ))}
            </div>
          )}

          <Pagination page={page} totalPages={results.totalPages} />
        </>
      )}
    </div>
  );
}
