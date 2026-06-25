'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function FormEntriesPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  const loadForm = () => api.get<any>(`/api/forms/${params.id}`).then(setForm);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const data = await api.get<any>(`/api/forms/${params.id}/entries?page=${page}&pageSize=${pageSize}`);
      setEntries(data.data);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadForm(); }, [params.id]);
  useEffect(() => { loadEntries(); }, [params.id, page]);

  const handleExport = () => {
    // Use direct link to trigger download — auth cookie is sent automatically
    window.location.href = `/api/forms/${params.id}/entries/export`;
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await api.delete(`/api/forms/${params.id}/entries/${entryId}`);
      toast.success('Entry deleted');
      await loadEntries();
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`Delete all ${total} entries? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/forms/${params.id}/entries`);
      toast.success('All entries deleted');
      setPage(1);
      await loadEntries();
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    }
  };

  const fields: any[] = form?.fields || [];
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link href={`/admin/forms/${params.id}`}><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{form?.name || 'Form'} — Entries</h1>
            <p className="text-muted-foreground text-sm">{total} entr{total !== 1 ? 'ies' : 'y'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {total > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteAll} className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Clear all
              </Button>
            </>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No entries yet.</CardContent></Card>
      ) : (
        <>
          <div className="border rounded-lg bg-card overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: Math.max(400, fields.length * 150 + 200) }}>
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  {fields.map((f: any) => (
                    <th key={f.name} className="text-left px-4 py-3 whitespace-nowrap">{f.label}</th>
                  ))}
                  <th className="text-left px-4 py-3 whitespace-nowrap">Submitted</th>
                  <th className="px-4 py-3 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((entry) => {
                  const data = entry.data as Record<string, unknown>;
                  return (
                    <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                      {fields.map((f: any) => (
                        <td key={f.name} className="px-4 py-2 max-w-[200px] truncate" title={String(data[f.name] ?? '')}>
                          {String(data[f.name] ?? '—')}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
