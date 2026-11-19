// /api/public/posts is paginated with no fixed upper bound on total results,
// so a site with more than one page's worth of published posts needs every
// page fetched, not just the first — otherwise older articles silently drop
// out of the sitemap once the archive grows past a single page.
export async function fetchAllPublishedPosts(apiBaseUrl: string | undefined): Promise<any[]> {
  const pageSize = 200;
  const all: any[] = [];
  let page = 1;
  while (true) {
    const res = await fetch(`${apiBaseUrl}/api/public/posts?pageSize=${pageSize}&page=${page}`, { next: { revalidate: 300 } });
    if (!res.ok) break;
    const json = await res.json();
    const data: any[] = json.data || [];
    all.push(...data);
    if (data.length < pageSize || page >= (json.totalPages || 1)) break;
    page++;
  }
  return all;
}
