'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { fetchIssues, type IssueSummary } from '@/lib/issues';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [issueId, setIssueId] = useState('');
  const [listId, setListId] = useState('');
  const [issues, setIssues] = useState<IssueSummary[]>([]);
  const [lists, setLists] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchIssues(),
      api.get<any>('/api/subscribers/lists'),
    ]).then(([issueData, listData]) => {
      setIssues(issueData);
      setLists(listData);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !issueId || !listId) { toast.error('All fields required'); return; }
    setSaving(true);
    try {
      const campaign = await api.post<any>('/api/campaigns', { name, issueId, subscriberListId: listId });
      toast.success('Campaign created');
      router.push(`/admin/campaigns/${campaign.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/campaigns"><ArrowLeft className="h-4 w-4" /> Campaigns</Link>
        </Button>
        <h1 className="text-2xl font-bold">New Campaign</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Campaign Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="June 2026 Newsletter" />
            </div>

            <div className="space-y-2">
              <Label>Issue</Label>
              <Select value={issueId} onValueChange={setIssueId}>
                <SelectTrigger><SelectValue placeholder="Select an issue…" /></SelectTrigger>
                <SelectContent>
                  {issues.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.title} — {formatDate(i.publishDate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subscriber List</Label>
              <Select value={listId} onValueChange={setListId}>
                <SelectTrigger><SelectValue placeholder="Select a list…" /></SelectTrigger>
                <SelectContent>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? 'Creating…' : 'Create Campaign'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
