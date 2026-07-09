import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { BookOpen, FileText } from 'lucide-react';
import { Pagination } from '@/components/public/Pagination';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

async function getIssues(page = 1) {
  try {
    const res = await fetch(`${API}/api/public/issues?page=${page}&pageSize=12`, { next: { revalidate: 120 } });
    if (!res.ok) return { data: [], total: 0, totalPages: 0 };
    return res.json();
  } catch { return { data: [], total: 0, totalPages: 0 }; }
}

export default async function IssuesPage({ searchParams }: { searchParams: { page?: string } }) {
  const page = Number(searchParams.page || 1);
  const { data: issues, total, totalPages } = await getIssues(page);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold">All Issues</h1>
        <p className="text-muted-foreground mt-1">{total} issues published</p>
      </div>

      {issues.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p>No issues published yet.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {issues.map((issue: any) => (
            <Link key={issue.id} href={`/issues/${issue.id}`} className="group border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow">
              {/* Cover image from first post */}
              <div className="relative aspect-[3/4] bg-muted">
                {issue.coverPost?.featuredMedia ? (
                  <Image
                    src={issue.coverPost.featuredMedia.url}
                    alt={issue.title}
                    fill
                    className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <BookOpen className="h-10 w-10 opacity-30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <p className="text-xs font-medium opacity-80">Vol. {issue.volumeNumber}, No. {issue.issueNumber}</p>
                  <p className="font-bold text-sm leading-tight mt-0.5">{issue.title}</p>
                </div>
              </div>
              <div className="px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{format(new Date(issue.publishDate), 'MMM d, yyyy')}</span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {issue.postCount} articles
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </div>
  );
}
