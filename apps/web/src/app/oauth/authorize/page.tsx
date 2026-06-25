'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ShieldCheck, X, Loader2, Key } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const SCOPE_LABELS: Record<string, { label: string; description: string }> = {
  'posts:read':       { label: 'Read posts',       description: 'View posts, pages, categories and tags' },
  'posts:write':      { label: 'Write posts',      description: 'Create and update posts and pages' },
  'media:read':       { label: 'Read media',        description: 'View media library files' },
  'subscribers:read': { label: 'Read subscribers',  description: 'View subscriber list and counts' },
};

function AuthorizeInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const clientId  = params.get('client_id') || '';
  const redirectUri = params.get('redirect_uri') || '';
  const scope     = params.get('scope') || 'posts:read';
  const state     = params.get('state') || '';
  const codeChallenge = params.get('code_challenge') || '';
  const codeChallengeMethod = params.get('code_challenge_method') || 'S256';

  const [clientName, setClientName] = useState('');
  const [loadingClient, setLoadingClient] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const scopes = scope.split(' ').filter(Boolean);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      router.replace(`/login?return=${returnTo}`);
    }
  }, [authLoading, user, router]);

  // Look up client name (public endpoint on API)
  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/oauth/clients/${encodeURIComponent(clientId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.name) setClientName(d.name); })
      .catch(() => {})
      .finally(() => setLoadingClient(false));
  }, [clientId]);

  const handleApprove = async () => {
    setSubmitting(true);
    setError('');
    try {
      const result = await api.post<{ code: string; redirect_uri: string; state: string }>(
        '/api/oauth/approve',
        { client_id: clientId, redirect_uri: redirectUri, scope, state, code_challenge: codeChallenge, code_challenge_method: codeChallengeMethod },
      );
      const callbackUrl = new URL(result.redirect_uri);
      callbackUrl.searchParams.set('code', result.code);
      if (result.state) callbackUrl.searchParams.set('state', result.state);
      window.location.href = callbackUrl.toString();
    } catch (err: any) {
      setError(err?.message || 'Authorization failed');
      setSubmitting(false);
    }
  };

  const handleDeny = () => {
    if (!redirectUri) return;
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const displayName = clientName || clientId || 'An application';

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2 pb-4">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center">
              <Key className="h-7 w-7 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-xl">Authorize Access</CardTitle>
          <CardDescription>
            <span className="font-semibold text-foreground">{loadingClient ? '…' : displayName}</span>
            {' '}is requesting permission to access your CMS as{' '}
            <span className="font-semibold text-foreground">{user.name}</span>.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Scopes */}
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permissions requested</p>
            {scopes.map((s) => {
              const info = SCOPE_LABELS[s];
              return (
                <div key={s} className="flex items-start gap-3">
                  <ShieldCheck className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{info?.label ?? s}</p>
                    {info?.description && <p className="text-xs text-muted-foreground">{info.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 gap-1.5"
              onClick={handleDeny}
              disabled={submitting}
            >
              <X className="h-4 w-4" />
              Deny
            </Button>
            <Button
              className="flex-1 gap-1.5"
              onClick={handleApprove}
              disabled={submitting || loadingClient}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              Allow Access
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            You can revoke this access at any time from{' '}
            <a href="/admin/integrations" className="underline hover:text-foreground">Integrations</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AuthorizePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <AuthorizeInner />
    </Suspense>
  );
}
