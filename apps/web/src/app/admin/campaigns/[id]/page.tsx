'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Eye, MessageSquare, Copy, Check, FlaskConical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatDate, statusColor } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [whatsapp, setWhatsapp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const load = async () => {
    const [c, wa] = await Promise.all([
      api.get<any>(`/api/campaigns/${id}`),
      api.get<any>(`/api/campaigns/${id}/whatsapp`).catch(() => null),
    ]);
    setCampaign(c);
    setWhatsapp(wa);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const sendCampaign = async () => {
    if (!confirm('Send to all active subscribers in this list?')) return;
    const toastId = toast.loading('Sending…');
    try {
      const result = await api.post<any>(`/api/campaigns/${id}/send`);
      toast.success(`Sent to ${result.sent} subscriber(s)`, { id: toastId });
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Send failed', { id: toastId });
    }
  };

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;
    setSendingTest(true);
    try {
      await api.post(`/api/campaigns/${id}/test-send`, { email: testEmail });
      toast.success(`Test email sent to ${testEmail}`);
    } catch (err: any) {
      toast.error(err?.message || 'Send failed');
    } finally {
      setSendingTest(false);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
    toast.success('Copied!');
  };

  const openPreview = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/campaigns/${id}/preview`, '_blank');
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!campaign) return <div className="text-destructive">Campaign not found</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/campaigns"><ArrowLeft className="h-4 w-4" /> Campaigns</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(campaign.status)}`}>{campaign.status}</span>
            <span className="text-sm text-muted-foreground">{campaign.issue?.title}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      {campaign.status === 'sent' && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Sent', value: campaign.sentCount },
            { label: 'Opens', value: campaign.openCount },
            { label: 'Clicks', value: campaign.clickCount },
            { label: 'Unsubs', value: campaign.unsubscribeCount },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="py-4 text-center">
                <div className="text-2xl font-bold">{stat.value}</div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 items-center">
        <Button variant="outline" onClick={openPreview} className="gap-2">
          <Eye className="h-4 w-4" /> Preview Email
        </Button>
        {campaign.status !== 'sent' && (
          <Button onClick={sendCampaign} className="gap-2">
            <Send className="h-4 w-4" /> Send to All Subscribers
          </Button>
        )}
      </div>

      {/* Test send */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><FlaskConical className="h-4 w-4" /> Send Test Email</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendTest} className="flex gap-2">
            <Input
              type="email"
              placeholder="your@email.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="max-w-xs"
            />
            <Button type="submit" variant="outline" disabled={sendingTest || !testEmail} className="gap-2">
              {sendingTest ? 'Sending…' : <><FlaskConical className="h-4 w-4" /> Send Test</>}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">Sends the newsletter HTML to a single address without touching subscribers.</p>
        </CardContent>
      </Card>

      {/* WhatsApp messages */}
      {whatsapp && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5" /> WhatsApp Messages
          </h2>
          <p className="text-sm text-muted-foreground">Copy these messages to send via WhatsApp manually or via the API.</p>
          {Object.entries(whatsapp).map(([channel, text]) => (
            <Card key={channel}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm capitalize">{channel} Channel</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => copyText(text as string, channel)} className="gap-1">
                    {copied === channel ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                    {copied === channel ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="text-xs bg-muted p-3 rounded whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">{text as string}</pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
