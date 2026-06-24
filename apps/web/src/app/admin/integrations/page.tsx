'use client';
import { useState, useEffect } from 'react';
import { Save, Loader2, Plus, Trash2, Webhook, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function IntegrationsPage() {
  // Botsab
  const [botsabBaseUrl, setBotsabBaseUrl] = useState('https://botsab.shackyapps.in');
  const [botsabApiKey, setBotsabApiKey] = useState('');
  const [botsabInstanceId, setBotsabInstanceId] = useState('');
  const [savingBotsab, setSavingBotsab] = useState(false);
  const [testingBotsab, setTestingBotsab] = useState(false);
  const [botsabStatus, setBotsabStatus] = useState<{ ok: boolean; groupCount?: number; error?: string } | null>(null);

  // Webhooks
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhookEvents, setWebhookEvents] = useState<string[]>([]);
  const [newHookName, setNewHookName] = useState('');
  const [newHookEvent, setNewHookEvent] = useState('');
  const [newHookUrl, setNewHookUrl] = useState('');
  const [newHookSecret, setNewHookSecret] = useState('');
  const [savingHook, setSavingHook] = useState(false);

  useEffect(() => {
    api.get<any>('/api/settings').then((s) => {
      if (s.botsab_base_url) setBotsabBaseUrl(s.botsab_base_url);
      if (s.botsab_api_key) setBotsabApiKey('••••••••');
      if (s.botsab_instance_id) setBotsabInstanceId(s.botsab_instance_id);
    }).catch(() => {});
    api.get<any[]>('/api/webhooks').then(setWebhooks).catch(() => {});
    api.get<string[]>('/api/webhooks/events').then(setWebhookEvents).catch(() => {});
  }, []);

  const saveBotsab = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBotsab(true);
    try {
      const payload: Record<string, string> = {
        botsab_base_url: botsabBaseUrl,
        botsab_instance_id: botsabInstanceId,
      };
      if (botsabApiKey && !botsabApiKey.startsWith('•')) {
        payload.botsab_api_key = botsabApiKey;
      }
      await api.patch('/api/settings', payload);
      if (botsabApiKey && !botsabApiKey.startsWith('•')) setBotsabApiKey('••••••••');
      toast.success('Botsab settings saved');
      setBotsabStatus(null);
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSavingBotsab(false);
    }
  };

  const testBotsab = async () => {
    setTestingBotsab(true);
    setBotsabStatus(null);
    try {
      const groups = await api.get<any[]>('/api/integrations/botsab/groups');
      setBotsabStatus({ ok: true, groupCount: groups.length });
    } catch (err: any) {
      setBotsabStatus({ ok: false, error: err?.message || 'Connection failed' });
    } finally {
      setTestingBotsab(false);
    }
  };

  const createWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHookName || !newHookEvent || !newHookUrl) return;
    setSavingHook(true);
    try {
      const hook = await api.post<any>('/api/webhooks', {
        name: newHookName, event: newHookEvent, targetUrl: newHookUrl,
        secret: newHookSecret || undefined,
      });
      setWebhooks((prev) => [hook, ...prev]);
      setNewHookName(''); setNewHookEvent(''); setNewHookUrl(''); setNewHookSecret('');
      toast.success('Webhook created');
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally {
      setSavingHook(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    await api.delete(`/api/webhooks/${id}`);
    setWebhooks((prev) => prev.filter((h) => h.id !== id));
    toast.success('Webhook deleted');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect third-party services to extend your publishing workflow.</p>
      </div>

      {/* ── Botsab ──────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" className="h-5 w-5 shrink-0">
              <defs>
                <linearGradient id="botsab-bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#22c55e"/>
                  <stop offset="100%" stopColor="#15803d"/>
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="url(#botsab-bg)"/>
              <path d="M7 8a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-4l-4 4v-4H10a3 3 0 0 1-3-3V8z" fill="white" opacity="0.95"/>
              <path d="M17.5 9l-3.5 5h3l-3.5 5.5 7-6.5h-3.5z" fill="#15803d"/>
            </svg>
            Botsab — WhatsApp Automation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Promo blurb */}
          <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4 space-y-2">
            <p className="text-sm font-medium text-green-900 dark:text-green-200">
              Send WhatsApp messages to groups directly from your campaigns — no copy-paste.
            </p>
            <p className="text-sm text-green-800 dark:text-green-300">
              Botsab is a WhatsApp automation platform built for publishers and teams. Once connected,
              you can send newsletter digests and per-article messages to any number of groups with one click.
            </p>
            <a
              href="https://botsab.shackyapps.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400 hover:underline"
            >
              Learn more at botsab.shackyapps.in <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Config form */}
          <form onSubmit={saveBotsab} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Base URL</Label>
              <Input
                value={botsabBaseUrl}
                onChange={(e) => setBotsabBaseUrl(e.target.value)}
                placeholder="https://botsab.shackyapps.in"
              />
              <p className="text-xs text-muted-foreground">Leave as default unless you self-host Botsab.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">API Key</Label>
              <Input
                value={botsabApiKey}
                onChange={(e) => setBotsabApiKey(e.target.value)}
                onFocus={(e) => { if (e.target.value.startsWith('•')) setBotsabApiKey(''); }}
                placeholder="wapi_••••••••••••••••••••••••••••••••"
                type={botsabApiKey.startsWith('•') ? 'password' : 'text'}
              />
              <p className="text-xs text-muted-foreground">
                Find your API key in the Botsab dashboard under API Keys.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Instance ID</Label>
              <Input
                value={botsabInstanceId}
                onChange={(e) => setBotsabInstanceId(e.target.value)}
                placeholder="e.g. abc123def456"
              />
              <p className="text-xs text-muted-foreground">
                The ID of your connected WhatsApp instance in Botsab.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button type="submit" disabled={savingBotsab} className="gap-2">
                {savingBotsab ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={testBotsab}
                disabled={testingBotsab}
                className="gap-2"
              >
                {testingBotsab ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Test Connection
              </Button>

              {botsabStatus && (
                botsabStatus.ok ? (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <CheckCircle2 className="h-4 w-4" />
                    Connected — {botsabStatus.groupCount} group{botsabStatus.groupCount !== 1 ? 's' : ''} available
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {botsabStatus.error}
                  </span>
                )
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Webhooks ────────────────────────────────────────────────────────── */}
      <Card id="webhooks">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Receive HTTP POST notifications when events happen in Shacky CMS.</p>
          <form onSubmit={createWebhook} className="space-y-3 border border-border rounded-lg p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Webhook</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={newHookName} onChange={(e) => setNewHookName(e.target.value)} placeholder="My webhook" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Event</Label>
                <select
                  value={newHookEvent}
                  onChange={(e) => setNewHookEvent(e.target.value)}
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">— select event —</option>
                  {webhookEvents.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Target URL</Label>
              <Input value={newHookUrl} onChange={(e) => setNewHookUrl(e.target.value)} placeholder="https://yourserver.com/hook" type="url" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Secret (optional — for HMAC signature)</Label>
              <Input value={newHookSecret} onChange={(e) => setNewHookSecret(e.target.value)} placeholder="my-secret" type="password" />
            </div>
            <Button type="submit" size="sm" disabled={savingHook || !newHookName || !newHookEvent || !newHookUrl} className="gap-2">
              {savingHook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add Webhook
            </Button>
          </form>

          {webhooks.length > 0 && (
            <div className="divide-y border rounded-lg">
              {webhooks.map((h) => (
                <div key={h.id} className="flex items-start justify-between px-3 py-3 gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{h.name}</p>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{h.event}</span>
                      {!h.isActive && <span className="text-xs text-muted-foreground">(inactive)</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{h.targetUrl}</p>
                  </div>
                  <button onClick={() => deleteWebhook(h.id)} className="text-destructive hover:text-destructive/80 shrink-0 p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
