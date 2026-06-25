'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Trash2, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function FormsPage() {
  const [forms, setForms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/api/forms');
      setForms(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete form "${name}" and all its entries? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/forms/${id}`);
      toast.success('Form deleted');
      await load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Forms</h1>
          <p className="text-muted-foreground">{forms.length} form{forms.length !== 1 ? 's' : ''}</p>
        </div>
        <Button asChild>
          <Link href="/admin/forms/new"><Plus className="h-4 w-4" /> New Form</Link>
        </Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground">Loading…</div>
      ) : forms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No forms yet. Create one to start collecting submissions.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y border rounded-lg bg-card">
          {forms.map((form) => (
            <div key={form.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/admin/forms/${form.id}`} className="text-sm font-medium hover:underline">
                    {form.name}
                  </Link>
                  <Badge variant={form.isActive ? 'default' : 'secondary'} className="text-xs">
                    {form.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  {form.notifyDigest && (
                    <Badge variant="outline" className="text-xs capitalize">{form.notifyDigest.replace('_', ' ')} notify</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  <span className="font-mono">/forms/{form.slug}</span>
                  <span>·</span>
                  <span>{(form.fields as any[])?.length || 0} field{(form.fields as any[])?.length !== 1 ? 's' : ''}</span>
                  <span>·</span>
                  <span>{form._count?.entries || 0} entr{form._count?.entries !== 1 ? 'ies' : 'y'}</span>
                  <span>·</span>
                  <span>Created {formatDate(form.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/forms/${form.id}/entries`}>Entries</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/forms/${form.id}`}>Edit</Link>
                </Button>
                <Button variant="outline" size="sm" asChild title="View public form">
                  <a href={`/forms/${form.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(form.id, form.name)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
