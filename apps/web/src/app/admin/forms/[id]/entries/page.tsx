'use client';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Trash2, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Add-to-list dialog
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [lists, setLists] = useState<any[]>([]);
  const [emailField, setEmailField] = useState('');
  const [phoneField, setPhoneField] = useState('');
  const [nameField, setNameField] = useState('');
  const [channel, setChannel] = useState<'email' | 'whatsapp' | 'both'>('email');
  const [listChoice, setListChoice] = useState<'existing' | 'new'>('existing');
  const [selectedListId, setSelectedListId] = useState('');
  const [newListName, setNewListName] = useState('');
  const [addingToList, setAddingToList] = useState(false);

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

  const fields: any[] = form?.fields || [];
  const totalPages = Math.ceil(total / pageSize);
  const allOnPageSelected = entries.length > 0 && entries.every((e) => selected.has(e.id));
  const someSelected = selected.size > 0;

  // Guess sensible field defaults when dialog opens
  const openListDialog = () => {
    const emailF = fields.find((f) => f.type === 'email' || f.name.toLowerCase().includes('email'));
    const phoneF = fields.find((f) => f.type === 'phone' || f.name.toLowerCase().includes('phone') || f.name.toLowerCase().includes('whatsapp') || f.name.toLowerCase().includes('mobile'));
    const nameF = fields.find((f) => f.name.toLowerCase().includes('name'));
    setEmailField(emailF?.name || '');
    setPhoneField(phoneF?.name || '');
    setNameField(nameF?.name || '');
    setListDialogOpen(true);
    api.get<any[]>('/api/subscribers/lists').then(setLists).catch(() => {});
  };

  // Toggle individual row
  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Toggle all rows on current page
  const toggleAll = () => {
    if (allOnPageSelected) {
      setSelected((prev) => { const next = new Set(prev); entries.forEach((e) => next.delete(e.id)); return next; });
    } else {
      setSelected((prev) => { const next = new Set(prev); entries.forEach((e) => next.add(e.id)); return next; });
    }
  };

  const handleExport = (idsOnly = false) => {
    const ids = idsOnly ? [...selected].join(',') : undefined;
    const url = `/api/forms/${params.id}/entries/export${ids ? `?ids=${ids}` : ''}`;
    window.open(url, '_blank');
  };

  const handleBulkDelete = async () => {
    const ids = [...selected];
    if (!confirm(`Delete ${ids.length} selected entr${ids.length !== 1 ? 'ies' : 'y'}? This cannot be undone.`)) return;
    try {
      await api.post(`/api/forms/${params.id}/entries/bulk-delete`, { ids });
      toast.success(`${ids.length} entr${ids.length !== 1 ? 'ies' : 'y'} deleted`);
      setSelected(new Set());
      await loadEntries();
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await api.delete(`/api/forms/${params.id}/entries/${entryId}`);
      toast.success('Entry deleted');
      setSelected((prev) => { const next = new Set(prev); next.delete(entryId); return next; });
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
      setSelected(new Set());
      setPage(1);
      await loadEntries();
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    }
  };

  const handleAddToList = async () => {
    if (!emailField && !phoneField) { toast.error('Select at least an email or phone field'); return; }
    if (listChoice === 'existing' && !selectedListId) { toast.error('Select a list'); return; }
    if (listChoice === 'new' && !newListName.trim()) { toast.error('Enter a list name'); return; }

    setAddingToList(true);
    try {
      const result = await api.post<any>(`/api/forms/${params.id}/entries/to-list`, {
        entryIds: [...selected],
        emailField: emailField || undefined,
        phoneField: phoneField || undefined,
        nameField: nameField || undefined,
        channel,
        listId: listChoice === 'existing' ? selectedListId : undefined,
        newListName: listChoice === 'new' ? newListName.trim() : undefined,
      });
      toast.success(`${result.added} subscriber${result.added !== 1 ? 's' : ''} added to "${result.listName}"${result.skipped ? `, ${result.skipped} skipped` : ''}`);
      setListDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    } finally {
      setAddingToList(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
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
          {total > 0 && !someSelected && (
            <>
              <Button variant="outline" size="sm" onClick={() => handleExport(false)} className="gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export all
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteAll} className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" /> Clear all
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-2 flex-wrap px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-primary mr-1">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => handleExport(true)} className="gap-1.5 h-7 text-xs">
            <Download className="h-3 w-3" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={openListDialog} className="gap-1.5 h-7 text-xs">
            <UserPlus className="h-3 w-3" /> Add to list
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkDelete} className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive">
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : entries.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No entries yet.</CardContent></Card>
      ) : (
        <>
          <div className="border rounded-lg bg-card overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: Math.max(400, fields.length * 150 + 250) }}>
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      className="accent-primary"
                    />
                  </th>
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
                  const isChecked = selected.has(entry.id);
                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-muted/20 transition-colors ${isChecked ? 'bg-primary/5' : ''}`}
                      onClick={() => toggleRow(entry.id)}
                    >
                      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRow(entry.id)}
                          className="accent-primary"
                        />
                      </td>
                      {fields.map((f: any) => (
                        <td key={f.name} className="px-4 py-2 max-w-[200px] truncate" title={String(data[f.name] ?? '')}>
                          {String(data[f.name] ?? '—')}
                        </td>
                      ))}
                      <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(entry.createdAt)}</td>
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
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

      {/* Add to list dialog */}
      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add {selected.size} entr{selected.size !== 1 ? 'ies' : 'y'} to subscriber list</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Field mapping */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Map form fields</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Email field</Label>
                  <select
                    value={emailField}
                    onChange={(e) => setEmailField(e.target.value)}
                    className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— none —</option>
                    {fields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone / WhatsApp field</Label>
                  <select
                    value={phoneField}
                    onChange={(e) => setPhoneField(e.target.value)}
                    className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— none —</option>
                    {fields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Name field (optional)</Label>
                  <select
                    value={nameField}
                    onChange={(e) => setNameField(e.target.value)}
                    className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">— none —</option>
                    {fields.map((f) => <option key={f.name} value={f.name}>{f.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Channel</Label>
                  <select
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as any)}
                    className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
            </div>

            {/* List selection */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscriber list</p>
              <div className="flex gap-3">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="listChoice" value="existing" checked={listChoice === 'existing'} onChange={() => setListChoice('existing')} className="accent-primary" />
                  Existing list
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="listChoice" value="new" checked={listChoice === 'new'} onChange={() => setListChoice('new')} className="accent-primary" />
                  New list
                </label>
              </div>

              {listChoice === 'existing' ? (
                <select
                  value={selectedListId}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">— select a list —</option>
                  {lists.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.subscriberCount} members)</option>
                  ))}
                </select>
              ) : (
                <Input
                  placeholder="New list name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                />
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setListDialogOpen(false)} disabled={addingToList}>Cancel</Button>
            <Button onClick={handleAddToList} disabled={addingToList} className="gap-2">
              {addingToList && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add to list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
