'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Upload, Settings, CheckCircle, XCircle, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function IssuesPage() {
  const [issues, setIssues] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>('/api/issues?pageSize=20');
      setIssues(data.data);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const bulkAction = async (id: string, status: 'published' | 'draft') => {
    const label = status === 'published' ? 'Publishing' : 'Unpublishing';
    const toastId = toast.loading(`${label} all articles…`);
    try {
      await api.post(`/api/issues/${id}/bulk-publish`, { status });
      toast.success(`All articles ${status === 'published' ? 'published' : 'reverted to draft'}`, { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || 'Failed', { id: toastId });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Issues</h1>
          <p className="text-muted-foreground">{total} issue{total !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild>
          <Link href="/admin/issues/new"><Plus className="h-4 w-4" /> New Issue</Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : issues.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No issues yet. Create your first issue to get started.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <Card key={issue.id}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/admin/issues/${issue.id}`} className="text-base font-semibold hover:underline">
                        {issue.title}
                      </Link>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground capitalize">{issue.type}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Vol. {issue.volumeNumber}, No. {issue.issueNumber} · {formatDate(issue.publishDate)}
                      {issue._count?.posts !== undefined && ` · ${issue._count.posts} article${issue._count.posts !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/admin/issues/${issue.id}`}><Settings className="h-3 w-3" /> Manage</Link>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => bulkAction(issue.id, 'published')}>
                      <CheckCircle className="h-3 w-3" /> Publish All
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => bulkAction(issue.id, 'draft')}>
                      <XCircle className="h-3 w-3" /> Unpublish All
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
