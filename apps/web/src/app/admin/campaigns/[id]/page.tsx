'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, MessageSquare, Copy, Check, Pencil,
  FlaskConical, Mail, ChevronLeft, ChevronRight, Loader2, CheckCircle2, AlertCircle,
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

interface BotsabGroup {
  id: string;
  name: string | null;
  participantCount: number;
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

  // Botsab
  const [botsabGroups, setBotsabGroups] = useState<BotsabGroup[] | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [botsabMode, setBotsabMode] = useState<'digest' | 'channel'>('digest');
  const [botsabChannelId, setBotsabChannelId] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ sent: number; errors: string[] } | null>(null);

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

  const loadGroups = async () => {
    setLoadingGroups(true);
    setSendResult(null);
    try {
      const groups = await api.get<BotsabGroup[]>('/api/integrations/botsab/groups');
      setBotsabGroups(groups);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load groups — check Botsab settings');
    } finally {
      setLoadingGroups(false);
    }
  };

  const toggleGroup = (jid: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid); else next.add(jid);
      return next;
    });
  };

  const sendViaBotsab = async () => {
    if (selectedGroups.size === 0) { toast.error('Select at least one group'); return; }
    if (!waData) { toast.error('Generate WhatsApp messages first'); return; }
    if (botsabMode === 'channel' && !botsabChannelId) { toast.error('Select a channel'); return; }

    setSending(true);
    setSendResult(null);
    const toastId = toast.loading('Sending via Botsab…');
    try {
      const result = await api.post<{ sent: number; errors: string[] }>(`/api/campaigns/${id}/botsab-send`, {
        groupJids: Array.from(selectedGroups),
        mode: botsabMode,
        channelId: botsabChannelId || undefined,
      });
      setSendResult(result);
      if (result.errors.length > 0) {
        toast.error(`${result.sent} sent, ${result.errors.length} error(s)`, { id: toastId, duration: 6000 });
      } else {
        toast.success(`${result.sent} message${result.sent !== 1 ? 's' : ''} sent`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(err?.message || 'Send failed', { id: toastId });
    } finally {
      setSending(false);
    }
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
            <div className="flex items-center gap-2">
              {campaign.status !== 'sent' && (
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <Link href={`/admin/campaigns/${id}/builder`}><Pencil className="h-4 w-4" /> Edit Content</Link>
                </Button>
              )}
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

      {/* ── Send via Botsab ──────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-5 w-5 shrink-0">
                <defs>
                  <linearGradient id="botsab-bg-c" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#22c55e"/>
                    <stop offset="100%" stopColor="#15803d"/>
                  </linearGradient>
                </defs>
                <rect width="32" height="32" rx="8" fill="url(#botsab-bg-c)"/>
                <path d="M7 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-4l-4 4v-4H10a3 3 0 0 1-3-3V8z" fill="white" opacity="0.95"/>
                <path d="M17.5 9l-3.5 5h3l-3.5 5.5 7-6.5h-3.5z" fill="#15803d"/>
              </svg>
              Send via Botsab
            </CardTitle>
            {!botsabGroups && (
              <Button variant="outline" size="sm" onClick={loadGroups} disabled={loadingGroups} className="gap-1.5">
                {loadingGroups ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Load Groups
              </Button>
            )}
            {botsabGroups && (
              <Button variant="ghost" size="sm" onClick={loadGroups} disabled={loadingGroups} className="text-xs text-muted-foreground gap-1">
                {loadingGroups ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Refresh
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!botsabGroups && !loadingGroups && (
            <p className="text-sm text-muted-foreground">
              Click <strong>Load Groups</strong> to fetch your WhatsApp groups from Botsab and send messages directly.{' '}
              <Link href="/admin/integrations" className="text-primary underline">Configure Botsab →</Link>
            </p>
          )}

          {loadingGroups && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading groups…
            </div>
          )}

          {botsabGroups && (
            <div className="space-y-4">
              {/* Group selection */}
              <div className="space-y-1">
                <p className="text-sm font-medium">Select groups to send to</p>
                {botsabGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No groups found for this instance.</p>
                ) : (
                  <div className="max-h-52 overflow-y-auto divide-y border rounded-lg">
                    {botsabGroups.map((g) => (
                      <label key={g.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedGroups.has(g.id)}
                          onChange={() => toggleGroup(g.id)}
                          className="rounded border-input"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{g.name || <span className="italic text-muted-foreground">Unnamed group</span>}</p>
                          <p className="text-xs text-muted-foreground">{g.participantCount} members · {g.id.replace('@g.us', '')}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {selectedGroups.size > 0 && (
                  <p className="text-xs text-muted-foreground">{selectedGroups.size} group{selectedGroups.size !== 1 ? 's' : ''} selected</p>
                )}
              </div>

              {/* Mode selection */}
              {waData && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Message format</p>
                  <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
                    <button
                      onClick={() => setBotsabMode('digest')}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${botsabMode === 'digest' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Digest ({waData.digest.length} parts)
                    </button>
                    {waData.channels.length > 0 && (
                      <button
                        onClick={() => { setBotsabMode('channel'); if (!botsabChannelId && waData.channels[0]) setBotsabChannelId(waData.channels[0].id); }}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${botsabMode === 'channel' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        Per-Article
                      </button>
                    )}
                  </div>

                  {botsabMode === 'channel' && waData.channels.length > 1 && (
                    <div className="flex gap-1 flex-wrap">
                      {waData.channels.map((ch) => (
                        <button key={ch.id} onClick={() => setBotsabChannelId(ch.id)}
                          className={`px-3 py-1 rounded-md border text-sm transition-colors ${botsabChannelId === ch.id ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground'}`}>
                          {ch.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {botsabMode === 'digest'
                      ? `Will send ${waData.digest.length} messages (one per digest part) to each selected group.`
                      : `Will send one message per article to each selected group.`}
                  </p>
                </div>
              )}

              {!waData && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  Generate WhatsApp messages first (click <strong>Generate</strong> in the WhatsApp section above) before sending.
                </p>
              )}

              {/* Send button + results */}
              <div className="space-y-3">
                <Button
                  onClick={sendViaBotsab}
                  disabled={sending || selectedGroups.size === 0 || !waData}
                  className="gap-2"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {sending ? 'Sending…' : `Send to ${selectedGroups.size || ''} Group${selectedGroups.size !== 1 ? 's' : ''}`}
                </Button>

                {sendResult && (
                  <div className={`flex items-start gap-2 text-sm rounded-md px-3 py-2 ${sendResult.errors.length > 0 ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
                    {sendResult.errors.length === 0
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                      : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
                    <div>
                      <p className="font-medium">{sendResult.sent} message{sendResult.sent !== 1 ? 's' : ''} sent successfully</p>
                      {sendResult.errors.map((e, i) => (
                        <p key={i} className="text-xs mt-0.5">{e}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
