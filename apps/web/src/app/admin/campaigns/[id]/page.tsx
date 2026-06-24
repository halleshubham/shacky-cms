'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, MessageSquare, Copy, Check,
  FlaskConical, Mail, ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import { statusColor } from '@/lib/utils';
import toast from 'react-hot-toast';

interface WhatsAppData {
  digest: string[];
  channels: Array<{ id: string; name: string; messages: string[] }>;
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Newsletter
  const [newsletterHtml, setNewsletterHtml] = useState<string | null>(null);
  const [loadingHtml, setLoadingHtml] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  // WhatsApp
  const [waData, setWaData] = useState<WhatsAppData | null>(null);
  const [loadingWa, setLoadingWa] = useState(false);
  const [waMode, setWaMode] = useState<'digest' | 'channel'>('digest');
  const [digestPage, setDigestPage] = useState(0);
  const [channelIdx, setChannelIdx] = useState(0);
  const [articleIdx, setArticleIdx] = useState(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Test email
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const load = useCallback(async () => {
    const c = await api.get<any>(`/api/campaigns/${id}`);
    setCampaign(c);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-load newsletter HTML when the campaign is ready
  useEffect(() => {
    if (!id || newsletterHtml) return;
    setLoadingHtml(true);
    api.get<{ html: string }>(`/api/campaigns/${id}/newsletter`)
      .then((res) => setNewsletterHtml(res.html))
      .catch((err) => toast.error(err?.message || 'Failed to load newsletter'))
      .finally(() => setLoadingHtml(false));
  }, [id]);

  const loadWhatsApp = async () => {
    if (waData) return;
    setLoadingWa(true);
    try {
      const res = await api.get<WhatsAppData>(`/api/campaigns/${id}/whatsapp`);
      setWaData(res);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load WhatsApp messages');
    } finally {
      setLoadingWa(false);
    }
  };

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
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success('Copied!');
  };

  const copyNewsletter = async () => {
    if (!newsletterHtml) return;
    try {
      // Write as text/html so pasting into Gmail/email editors renders visually, not as source code
      const blob = new Blob([newsletterHtml], { type: 'text/html' });
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
    } catch {
      // Fallback for browsers that don't support ClipboardItem (Firefox)
      await navigator.clipboard.writeText(newsletterHtml);
    }
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
    toast.success('Newsletter copied — paste into Gmail or any email editor');
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!campaign) return <div className="text-destructive">Campaign not found</div>;

  const currentDigestPart = waData?.digest[digestPage];
  const currentChannel = waData?.channels[channelIdx];
  const currentMessage = currentChannel?.messages[articleIdx];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
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

      {/* Send action */}
      {campaign.status !== 'sent' && (
        <div>
          <Button onClick={sendCampaign} className="gap-2">
            <Send className="h-4 w-4" /> Send to All Subscribers
          </Button>
        </div>
      )}

      {/* ── HTML Newsletter ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" /> HTML Newsletter
            </CardTitle>
            <Button
              onClick={copyNewsletter}
              disabled={!newsletterHtml}
              size="sm"
              className="gap-2"
            >
              {copiedHtml ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedHtml ? 'Copied!' : 'Copy Newsletter'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Rendered preview */}
          <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
            {loadingHtml && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground h-48">
                <Loader2 className="h-4 w-4 animate-spin" /> Generating newsletter…
              </div>
            )}
            {newsletterHtml && !loadingHtml && (
              <iframe
                srcDoc={newsletterHtml}
                title="Newsletter Preview"
                className="w-full"
                style={{ height: '720px', border: 'none' }}
                sandbox="allow-same-origin"
              />
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Click <strong>Copy Newsletter</strong> to copy the HTML — paste it directly into Gmail, Mailchimp, or any email tool.
          </p>

          {/* Test send */}
          <div className="pt-3 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" /> Send test email
            </p>
            <form onSubmit={sendTest} className="flex gap-2">
              <Input
                type="email"
                placeholder="your@email.com"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="max-w-xs"
              />
              <Button type="submit" variant="outline" disabled={sendingTest || !testEmail} className="gap-2">
                {sendingTest ? 'Sending…' : 'Send Test'}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground mt-1.5">
              Sends to a single address without touching subscribers.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── WhatsApp Messages ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> WhatsApp Messages
            </CardTitle>
            {!waData && (
              <Button variant="outline" size="sm" onClick={loadWhatsApp} disabled={loadingWa} className="gap-1.5">
                {loadingWa ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Generate
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!waData && !loadingWa && (
            <p className="text-sm text-muted-foreground">
              Click <strong>Generate</strong> to produce WhatsApp-ready messages from this issue.
            </p>
          )}

          {loadingWa && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Generating messages…
            </div>
          )}

          {waData && (
            <div className="space-y-4">
              {/* Mode tabs */}
              <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                <button
                  onClick={() => setWaMode('digest')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${waMode === 'digest' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Digest ({waData.digest.length} parts)
                </button>
                <button
                  onClick={() => setWaMode('channel')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${waMode === 'channel' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                  disabled={waData.channels.length === 0}
                >
                  Per-Article {waData.channels.length > 0 ? `(${waData.channels.length} channels)` : '(no channels)'}
                </button>
              </div>

              {/* ─── Digest mode ─────────────────────────────────────────── */}
              {waMode === 'digest' && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Grouped format — 4 articles per part. Send each part as a separate WhatsApp message to your groups.
                  </p>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDigestPage((p) => Math.max(0, p - 1))} disabled={digestPage === 0} className="h-8 w-8 p-0">
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium">Part {digestPage + 1} of {waData.digest.length}</span>
                    <Button variant="outline" size="sm" onClick={() => setDigestPage((p) => Math.min(waData.digest.length - 1, p + 1))} disabled={digestPage === waData.digest.length - 1} className="h-8 w-8 p-0">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => copyText(currentDigestPart!, `digest-${digestPage}`)} className="gap-1.5">
                        {copiedKey === `digest-${digestPage}` ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy Part {digestPage + 1}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => copyText(waData.digest.join('\n\n\n'), 'digest-all')} className="gap-1.5">
                        {copiedKey === 'digest-all' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy All
                      </Button>
                    </div>
                  </div>

                  <pre className="text-xs bg-muted p-4 rounded-lg whitespace-pre-wrap font-mono max-h-96 overflow-y-auto leading-relaxed">
                    {currentDigestPart}
                  </pre>
                </div>
              )}

              {/* ─── Per-article channel mode ────────────────────────────── */}
              {waMode === 'channel' && waData.channels.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    One message per article — optimised for broadcast channels. Each message includes the channel-specific footer.
                  </p>

                  {waData.channels.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                      {waData.channels.map((ch, i) => (
                        <button key={ch.id} onClick={() => { setChannelIdx(i); setArticleIdx(0); }}
                          className={`px-3 py-1 rounded-md border text-sm transition-colors ${channelIdx === i ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                          {ch.name}
                        </button>
                      ))}
                    </div>
                  )}

                  {currentChannel && (
                    <>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => setArticleIdx((a) => Math.max(0, a - 1))} disabled={articleIdx === 0} className="h-8 w-8 p-0">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-medium">Article {articleIdx + 1} of {currentChannel.messages.length}</span>
                        <Button variant="outline" size="sm" onClick={() => setArticleIdx((a) => Math.min(currentChannel.messages.length - 1, a + 1))} disabled={articleIdx === currentChannel.messages.length - 1} className="h-8 w-8 p-0">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <div className="ml-auto flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => copyText(currentMessage!, `ch-${channelIdx}-${articleIdx}`)} className="gap-1.5">
                            {copiedKey === `ch-${channelIdx}-${articleIdx}` ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            Copy
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => copyText(currentChannel.messages.join('\n\n\n'), `ch-${channelIdx}-all`)} className="gap-1.5">
                            {copiedKey === `ch-${channelIdx}-all` ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                            Copy All
                          </Button>
                        </div>
                      </div>

                      <pre className="text-xs bg-muted p-4 rounded-lg whitespace-pre-wrap font-mono max-h-96 overflow-y-auto leading-relaxed">
                        {currentMessage}
                      </pre>
                    </>
                  )}
                </div>
              )}

              {waMode === 'channel' && waData.channels.length === 0 && (
                <div className="text-sm text-muted-foreground py-2">
                  No WhatsApp channels configured. Add channels in{' '}
                  <Link href="/admin/settings#newsletter" className="text-primary underline">Settings → Newsletter</Link>.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
