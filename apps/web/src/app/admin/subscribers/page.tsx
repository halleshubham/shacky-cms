'use client';
import { useState, useEffect, useRef } from 'react';
import { Users, Upload, Download, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { formatDate, statusColor } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function SubscribersPage() {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [lists, setLists] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [listFilter, setListFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [newListName, setNewListName] = useState('');
  const [showNewList, setShowNewList] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const pageSize = 50;

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (statusFilter) params.set('status', statusFilter);
      if (listFilter) params.set('listId', listFilter);
      const [subData, listData] = await Promise.all([
        api.get<any>(`/api/subscribers?${params}`),
        api.get<any>('/api/subscribers/lists'),
      ]);
      setSubscribers(subData.data);
      setTotal(subData.total);
      setLists(listData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, statusFilter, listFilter]);

  const createList = async () => {
    if (!newListName.trim()) return;
    try {
      await api.post('/api/subscribers/lists', { name: newListName.trim() });
      setNewListName('');
      setShowNewList(false);
      toast.success('List created');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const toastId = toast.loading('Importing…');
    try {
      const result = await api.upload<any>('/api/subscribers/import', formData);
      toast.success(`Imported ${result.imported}, skipped ${result.skipped}`, { id: toastId });
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Import failed', { id: toastId });
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Subscribers</h1>
          <p className="text-muted-foreground">{total} subscriber{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={importRef} type="file" accept=".csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" onClick={() => importRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
        </div>
      </div>

      {/* Lists */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {lists.map((list) => (
          <Card key={list.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setListFilter(listFilter === list.id ? '' : list.id)}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{list.name}</p>
                  <p className="text-xs text-muted-foreground">{list.subscriberCount || list._count?.members || 0} members</p>
                </div>
                <Users className={`h-5 w-5 ${listFilter === list.id ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
            </CardContent>
          </Card>
        ))}
        {showNewList ? (
          <Card>
            <CardContent className="py-4 flex items-center gap-2">
              <Input placeholder="List name…" value={newListName} onChange={(e) => setNewListName(e.target.value)} className="text-sm" onKeyDown={(e) => e.key === 'Enter' && createList()} />
              <Button size="sm" onClick={createList}>Add</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowNewList(false)}>Cancel</Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="cursor-pointer hover:bg-muted/30 transition-colors border-dashed" onClick={() => setShowNewList(true)}>
            <CardContent className="py-4 flex items-center gap-2 text-muted-foreground text-sm">
              <Plus className="h-4 w-4" /> New list
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>
        {listFilter && (
          <Button variant="outline" size="sm" onClick={() => setListFilter('')}>
            Clear filter
          </Button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Channels</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Subscribed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subscribers.map((s) => (
                <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2">{s.name || '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.email || '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.phone || '—'}</td>
                  <td className="px-4 py-2 capitalize">{s.channels}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(s.status)}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{formatDate(s.subscribedAt)}</td>
                </tr>
              ))}
              {subscribers.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">No subscribers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
