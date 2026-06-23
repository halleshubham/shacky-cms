import { Suspense } from 'react';
import { SearchResults } from './SearchResults';

export default function SearchPage({ searchParams }: { searchParams: { q?: string; page?: string } }) {
  return (
    <Suspense fallback={<div className="text-muted-foreground py-10 text-center">Loading…</div>}>
      <SearchResults q={searchParams.q || ''} page={Number(searchParams.page || 1)} />
    </Suspense>
  );
}
