import { Suspense, use } from 'react';
import { SearchResults } from './SearchResults';

export default function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q, page } = use(searchParams);
  return (
    <Suspense fallback={<div className="text-muted-foreground py-10 text-center">Loading…</div>}>
      <SearchResults q={q || ''} page={Number(page || 1)} />
    </Suspense>
  );
}
