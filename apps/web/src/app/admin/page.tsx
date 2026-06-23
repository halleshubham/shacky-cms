'use client';
import { useEffect, useState } from 'react';
import { FileText, Newspaper, Users, Mail, TrendingUp, Eye, PenLine, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { statusColor } from '@/lib/utils';

interface Stats {
  posts: { total: number; published: number; draft: number; scheduled: number };
  issues: { total: number };
  subscribers: { total: number; active: number };
  media: { total: number };
  campaigns: { total: number; sent: number };
  recentPosts: any[];
  recentIssues: any[];
  topPosts: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Stats>('/api/stats').then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-muted-foreground">Loading dashboard…</div>;
  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome to Shacky CMS</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<FileText className="h-4 w-4" />} label="Total Posts" value={stats.posts.total}
          sub={`${stats.posts.published} published · ${stats.posts.draft} draft`} />
        <StatCard icon={<Newspaper className="h-4 w-4" />} label="Issues" value={stats.issues.total} />
        <StatCard icon={<Users className="h-4 w-4" />} label="Subscribers" value={stats.subscribers.active}
          sub={`${stats.subscribers.total} total`} />
        <StatCard icon={<Mail className="h-4 w-4" />} label="Campaigns Sent" value={stats.campaigns.sent}
          sub={`${stats.campaigns.total} total`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent posts */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2"><PenLine className="h-4 w-4" /> Recent Posts</CardTitle>
            <Link href="/admin/posts" className="text-xs text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {stats.recentPosts.length === 0 && <p className="text-sm text-muted-foreground">No posts yet</p>}
            {stats.recentPosts.map((post) => (
              <Link key={post.id} href={`/admin/posts/${post.id}`}
                className="flex items-center justify-between hover:bg-muted/50 rounded-md px-2 py-2 -mx-2 transition-colors">
                <div className="min-w-0 mr-3">
                  <p className="text-sm font-medium truncate">{post.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {post.authors?.map((a: any) => a.displayName).join(', ') || '—'} · {formatDate(post.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Eye className="h-3 w-3" />{post.viewCount ?? 0}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor(post.status)}`}>{post.status}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Top posts by views */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Top Posts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.topPosts.length === 0 && <p className="text-sm text-muted-foreground">No views yet</p>}
            {stats.topPosts.map((post, i) => (
              <Link key={post.id} href={`/admin/posts/${post.id}`}
                className="flex items-center gap-3 hover:bg-muted/50 rounded-md px-2 py-1.5 -mx-2 transition-colors">
                <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                <p className="text-sm truncate flex-1">{post.title}</p>
                <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                  <Eye className="h-3 w-3" />{post.viewCount}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent issues */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" /> Recent Issues</CardTitle>
          <Link href="/admin/issues" className="text-xs text-primary hover:underline">View all</Link>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.recentIssues.length === 0 && <p className="text-sm text-muted-foreground">No issues yet</p>}
            {stats.recentIssues.map((issue) => (
              <Link key={issue.id} href={`/admin/issues/${issue.id}`}
                className="flex items-center justify-between hover:bg-muted/50 rounded-md px-3 py-2 border border-border transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{issue.title}</p>
                  <p className="text-xs text-muted-foreground">Vol. {issue.volumeNumber}, No. {issue.issueNumber} · {formatDate(issue.publishDate)}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}
