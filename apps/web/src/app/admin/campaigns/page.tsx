'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Eye, Send, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatDate, statusColor } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>('/api/campaigns?pageSize=20');
      setCampaigns(data.data);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sendCampaign = async (id: string) => {
    if (!confirm('Send this campaign to all subscribers in the list? This cannot be undone.')) return;
    const toastId = toast.loading('Sending campaign…');
    try {
      const result = await api.post<any>(`/api/campaigns/${id}/send`);
      toast.success(`Sent to ${result.sent} subscriber(s)`, { id: toastId });
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Send failed', { id: toastId });
    }
  };

  const openPreview = (id: string) => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/campaigns/${id}/preview`, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Campaigns</h1>
          <p className="text-muted-foreground">{total} campaign{total !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild>
          <Link href="/admin/campaigns/new"><Plus className="h-4 w-4" /> New Campaign</Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : campaigns.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No campaigns yet. Create one from an issue.</CardContent></Card>
      ) : (
        <div className="divide-y border rounded-lg bg-card">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-4 py-3 gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{c.name}</p>
                <div className="text-xs text-muted-foreground mt-0.5 space-x-2">
                  <span>{c.issue?.title}</span>
                  <span>·</span>
                  <span>{c.subscriberList?.name}</span>
                  {c.sentAt && <><span>·</span><span>Sent {formatDate(c.sentAt)}</span></>}
                </div>
                {c.status === 'sent' && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {c.sentCount} sent · {c.openCount} opens · {c.clickCount} clicks
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(c.status)}`}>{c.status}</span>
                <Button variant="outline" size="sm" onClick={() => openPreview(c.id)} className="gap-1">
                  <Eye className="h-3 w-3" /> Preview
                </Button>
                {c.status !== 'sent' && (
                  <Button size="sm" onClick={() => sendCampaign(c.id)} className="gap-1">
                    <Send className="h-3 w-3" /> Send
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/admin/campaigns/${c.id}`}><ExternalLink className="h-3 w-3" /></Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
