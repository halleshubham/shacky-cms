import { notFound } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArticleCard } from '@/components/public/ArticleCard';
import { ChevronRight, BookOpen } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL;

async function getIssue(id: string) {
  try {
    const res = await fetch(`${API}/api/public/issues/${id}`, { next: { revalidate: 60 } });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const issue = await getIssue(params.id);
  if (!issue) return { title: 'Not Found' };
  return { title: `Vol. ${issue.volumeNumber}, No. ${issue.issueNumber} — ${issue.title}` };
}

export default async function IssuePage({ params }: { params: { id: string } }) {
  const issue = await getIssue(params.id);
  if (!issue) notFound();

  const posts: any[] = issue.posts || [];
  const hero = posts[0];
  const rest = posts.slice(1);

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
        <Link href="/" className="hover:text-foreground">Home</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/issues" className="hover:text-foreground">Issues</Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground font-medium">Vol. {issue.volumeNumber}, No. {issue.issueNumber}</span>
      </nav>

      {/* Issue header */}
      <header className="mb-10 pb-6 border-b border-border">
        <div className="flex items-center gap-2 text-primary text-sm font-semibold uppercase tracking-wide mb-2">
          <BookOpen className="h-4 w-4" />
          <span>Issue</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2">{issue.title}</h1>
        <div className="flex items-center gap-3 text-muted-foreground text-sm">
          <span>Volume {issue.volumeNumber}, Issue {issue.issueNumber}</span>
          <span>·</span>
          <span>{format(new Date(issue.publishDate), 'MMMM d, yyyy')}</span>
          <span>·</span>
          <span>{posts.length} articles</span>
        </div>
      </header>

      {posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p>No published articles in this issue yet.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Hero article */}
          {hero && (
            <div className="max-w-2xl">
              <ArticleCard post={hero} size="large" />
            </div>
          )}

          {/* Remaining articles grid */}
          {rest.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-6 text-muted-foreground uppercase tracking-wide text-xs">More in this issue</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {rest.map((p: any) => (
                  <ArticleCard key={p.id} post={p} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
