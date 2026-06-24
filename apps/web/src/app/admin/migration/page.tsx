'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Download, PlayCircle, XCircle, CheckCircle2, AlertCircle,
  Loader2, ChevronDown, ChevronUp, RefreshCw, FileText, Tag, Users, FolderOpen, Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

interface TestResult {
  siteTitle: string;
  posts: number;
  pages: number;
  categories: number;
  tags: number;
  authors: number;
  usersBlocked: boolean;
}

interface Progress {
  jobId: string;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  phase: string;
  total: number;
  done: number;
  skipped: number;
  errors: number;
  errorLog: string[];
  startedAt: string;
  finishedAt?: string;
}

export default function MigrationPage() {
  // Credentials — loaded from and saved to the settings table
  const [baseUrl, setBaseUrl] = useState('');
  const [username, setUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);

  // Connection test
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  // Options
  const [importCategories, setImportCategories] = useState(true);
  const [importTags, setImportTags] = useState(true);
  const [importAuthors, setImportAuthors] = useState(true);
  const [importPosts, setImportPosts] = useState(true);
  const [postStatus, setPostStatus] = useState<'all' | 'publish' | 'draft'>('all');
  const [skipExisting, setSkipExisting] = useState(false);
  const [groupByDate, setGroupByDate] = useState(true);
  const [firstVolumeNumber, setFirstVolumeNumber] = useState('');
  const [firstIssueNumber, setFirstIssueNumber] = useState('');
  const [issuesPerVolume, setIssuesPerVolume] = useState('52');
  const [useDateRange, setUseDateRange] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Job tracking
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved WP credentials from settings on mount
  useEffect(() => {
    api.get<Record<string, string>>('/api/settings').then((settings) => {
      if (settings.wp_base_url)     setBaseUrl(settings.wp_base_url);
      if (settings.wp_username)     setUsername(settings.wp_username);
      if (settings.wp_app_password) setAppPassword(settings.wp_app_password);
    }).catch(() => {});
  }, []);

  const saveCredentials = async () => {
    setSavingCreds(true);
    try {
      await api.patch('/api/settings', { wp_base_url: baseUrl, wp_username: username, wp_app_password: appPassword });
      toast.success('Credentials saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save credentials');
    } finally {
      setSavingCreds(false);
    }
  };

  // Poll progress while running
  useEffect(() => {
    if (!jobId) return;
    const poll = async () => {
      try {
        const p = await api.get<Progress>(`/api/migration/wordpress/status/${jobId}`);
        setProgress(p);
        if (p.status === 'done' || p.status === 'failed' || p.status === 'cancelled') {
          setRunning(false);
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch { /* ignore */ }
    };
    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId]);

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.post<TestResult>('/api/migration/wordpress/test', { baseUrl, username, appPassword });
      setTestResult(result);
      toast.success(`Connected to "${result.siteTitle}"`);
    } catch (e: any) {
      toast.error(e?.message || 'Connection failed');
    } finally {
      setTesting(false);
    }
  };

  const startMigration = async () => {
    if (!confirm(`Start importing from ${baseUrl}? This may take several minutes.`)) return;
    setRunning(true);
    setProgress(null);
    setShowErrors(false);
    try {
      const { jobId: id } = await api.post<{ jobId: string }>('/api/migration/wordpress/start', {
        baseUrl, username, appPassword,
        options: {
          importCategories, importTags, importAuthors, importPosts, postStatus, skipExisting, groupByDate,
          ...(groupByDate && firstVolumeNumber && firstIssueNumber ? {
            firstVolumeNumber: parseInt(firstVolumeNumber),
            firstIssueNumber: parseInt(firstIssueNumber),
            issuesPerVolume: parseInt(issuesPerVolume) || 52,
          } : {}),
          ...(useDateRange && dateFrom ? { dateFrom } : {}),
          ...(useDateRange && dateTo ? { dateTo } : {}),
        },
      });
      setJobId(id);
      toast.success('Migration started');
    } catch (e: any) {
      setRunning(false);
      toast.error(e?.message || 'Failed to start');
    }
  };

  const cancelMigration = async () => {
    if (!jobId) return;
    await api.delete(`/api/migration/wordpress/job/${jobId}`);
    toast('Cancellation requested…');
  };

  const pct = progress && progress.total > 0
    ? Math.round((progress.done / progress.total) * 100)
    : 0;

  const statusIcon = () => {
    if (!progress) return null;
    if (progress.status === 'done') return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    if (progress.status === 'failed') return <AlertCircle className="h-5 w-5 text-red-500" />;
    if (progress.status === 'cancelled') return <XCircle className="h-5 w-5 text-amber-500" />;
    return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Download className="h-6 w-6" /> WordPress Migration
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import posts, categories, tags, authors, and featured images from a WordPress site via the REST API.
        </p>
      </div>

      {/* Credentials */}
      <Card>
        <CardHeader><CardTitle className="text-base">WordPress Connection</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">WordPress Site URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Username / Email</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin@example.com" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Application Password</Label>
              <Input value={appPassword} onChange={(e) => setAppPassword(e.target.value)} placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" type="password" />
              <p className="text-xs text-muted-foreground">WP Admin → Users → Profile → Application Passwords</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={testConnection} disabled={testing || !baseUrl || !username || !appPassword} variant="outline" className="gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {testing ? 'Connecting…' : 'Test Connection'}
            </Button>
            <Button onClick={saveCredentials} disabled={savingCreds || !baseUrl || !username || !appPassword} variant="secondary" className="gap-2">
              {savingCreds ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>

          {testResult && (
            <div className="border border-green-300 bg-green-50 dark:bg-green-950/30 rounded-md p-3 space-y-2">
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                Connected — {testResult.siteTitle}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: FileText, label: 'Posts', count: testResult.posts },
                  { icon: FolderOpen, label: 'Categories', count: testResult.categories },
                  { icon: Tag, label: 'Tags', count: testResult.tags },
                  { icon: Users, label: 'Authors', count: testResult.authors, blocked: testResult.usersBlocked },
                  { icon: FileText, label: 'Pages', count: testResult.pages },
                ].map(({ icon: Icon, label, count, blocked }) => (
                  <div key={label} className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-300">
                    <Icon className="h-3.5 w-3.5 opacity-70" />
                    {blocked
                      ? <span className="text-xs text-amber-600">Authors blocked by security plugin</span>
                      : <><span className="font-medium">{count.toLocaleString()}</span><span className="text-xs opacity-70">{label}</span></>
                    }
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Options */}
      <Card>
        <CardHeader><CardTitle className="text-base">Import Options</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">What to import</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Categories', value: importCategories, set: setImportCategories, icon: FolderOpen },
                { label: 'Tags', value: importTags, set: setImportTags, icon: Tag },
                { label: 'Authors', value: importAuthors, set: setImportAuthors, icon: Users },
                { label: 'Posts + Featured Images', value: importPosts, set: setImportPosts, icon: FileText },
              ].map(({ label, value, set, icon: Icon }) => (
                <label key={label} className={`flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer transition-colors ${value ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'}`}>
                  <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="sr-only" />
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="text-sm font-medium">{label}</span>
                  <span className={`ml-auto text-xs rounded-full w-4 h-4 flex items-center justify-center ${value ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {value ? '✓' : ''}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {importPosts && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Post Status to Import</Label>
                <div className="flex gap-2">
                  {(['publish', 'draft', 'all'] as const).map((s) => (
                    <button key={s} type="button"
                      onClick={() => setPostStatus(s)}
                      className={`px-3 py-1.5 rounded-md border text-sm transition-colors ${postStatus === s ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border text-muted-foreground hover:text-foreground'}`}
                    >
                      {s === 'publish' ? 'Published only' : s === 'draft' ? 'Drafts only' : 'All'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range filter */}
              <div className="space-y-2">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={useDateRange} onChange={(e) => setUseDateRange(e.target.checked)}
                    className="rounded border-input" />
                  <span className="text-sm font-medium">Filter by publish date range</span>
                  {!useDateRange && <span className="text-xs text-muted-foreground">(all dates imported by default)</span>}
                </label>
                {useDateRange && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div className="space-y-1">
                      <Label className="text-xs">From</Label>
                      <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">To</Label>
                      <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                    </div>
                    {dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo) && (
                      <p className="col-span-2 text-xs text-red-500">From date must be before To date.</p>
                    )}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)}
                  className="mt-0.5 rounded border-input" />
                <div>
                  <p className="text-sm font-medium">Skip posts that already exist</p>
                  <p className="text-xs text-muted-foreground">If a post with the same slug is already in the DB, skip it rather than overwriting.</p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={groupByDate} onChange={(e) => setGroupByDate(e.target.checked)}
                  className="mt-0.5 rounded border-input" />
                <div>
                  <p className="text-sm font-medium">Group posts into issues by publish date</p>
                  <p className="text-xs text-muted-foreground">Posts published on the same date will be grouped into a shared Issue. Provide Vol/No to get proper numbering and date-range titles.</p>
                </div>
              </label>

              {groupByDate && (
                <div className="pl-6 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Issue numbering for the first date imported</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Volume No.</Label>
                      <Input
                        type="number" min="1" placeholder="e.g. 80"
                        value={firstVolumeNumber}
                        onChange={(e) => setFirstVolumeNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Issue No.</Label>
                      <Input
                        type="number" min="1" placeholder="e.g. 9"
                        value={firstIssueNumber}
                        onChange={(e) => setFirstIssueNumber(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Issues / volume</Label>
                      <Input
                        type="number" min="1" placeholder="52"
                        value={issuesPerVolume}
                        onChange={(e) => setIssuesPerVolume(e.target.value)}
                      />
                    </div>
                  </div>
                  {firstVolumeNumber && firstIssueNumber && (
                    <p className="text-xs text-muted-foreground">
                      First issue → <span className="font-medium">Vol. {firstVolumeNumber}, No. {firstIssueNumber}</span>.
                      Title format: <span className="font-medium italic">Vol. {firstVolumeNumber}, No. {firstIssueNumber} | DD Mon YYYY - DD Mon YYYY</span>
                    </p>
                  )}
                  {(!firstVolumeNumber || !firstIssueNumber) && (
                    <p className="text-xs text-amber-600">Leave blank to auto-assign numbers (Vol. 1, sequential).</p>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Run */}
      <Card>
        <CardContent className="pt-6 flex items-center gap-3">
          <Button
            onClick={startMigration}
            disabled={running || !baseUrl || !username || !appPassword || (useDateRange && !!dateFrom && !!dateTo && new Date(dateFrom) > new Date(dateTo))}
            className="gap-2"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            {running ? 'Migrating…' : 'Start Migration'}
          </Button>
          {running && (
            <Button variant="outline" onClick={cancelMigration} className="gap-2 text-destructive border-destructive/30">
              <XCircle className="h-4 w-4" /> Cancel
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Progress */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              {statusIcon()}
              {progress.status === 'done' ? 'Migration complete' :
               progress.status === 'failed' ? 'Migration failed' :
               progress.status === 'cancelled' ? 'Migration cancelled' : 'Migration in progress'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{progress.phase}</p>

            {progress.total > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{progress.done.toLocaleString()} / {progress.total.toLocaleString()} posts</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      progress.status === 'done' ? 'bg-green-500' :
                      progress.status === 'failed' ? 'bg-red-500' : 'bg-primary'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="text-center p-2 bg-green-50 dark:bg-green-950/20 rounded-md">
                <p className="text-lg font-bold text-green-600">{progress.done}</p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded-md">
                <p className="text-lg font-bold">{progress.skipped}</p>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="text-center p-2 bg-red-50 dark:bg-red-950/20 rounded-md">
                <p className="text-lg font-bold text-red-600">{progress.errors}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>

            {progress.errorLog.length > 0 && (
              <div>
                <button
                  onClick={() => setShowErrors(!showErrors)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {showErrors ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {showErrors ? 'Hide' : 'Show'} error log ({progress.errorLog.length})
                </button>
                {showErrors && (
                  <div className="mt-2 bg-muted rounded-md p-3 max-h-48 overflow-y-auto space-y-0.5">
                    {progress.errorLog.map((e, i) => (
                      <p key={i} className="text-xs font-mono text-red-600 dark:text-red-400">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {progress.finishedAt && (
              <p className="text-xs text-muted-foreground">
                Started {new Date(progress.startedAt).toLocaleTimeString()} ·
                Finished {new Date(progress.finishedAt).toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
