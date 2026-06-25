'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import FormEditor from '../_components/FormEditor';

export default function EditFormPage({ params }: { params: { id: string } }) {
  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<any>(`/api/forms/${params.id}`).then((data) => { setForm(data); setLoading(false); });
  }, [params.id]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (!form) return <div className="text-destructive">Form not found.</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
            <Link href="/admin/forms"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{form.name}</h1>
            <p className="text-muted-foreground text-sm">{form._count?.entries || 0} entr{form._count?.entries !== 1 ? 'ies' : 'y'}</p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/admin/forms/${params.id}/entries`}><List className="h-4 w-4" /> View entries</Link>
        </Button>
      </div>
      <FormEditor
        formId={params.id}
        initialData={{
          name: form.name,
          slug: form.slug,
          fields: form.fields || [],
          isActive: form.isActive,
          successMessage: form.successMessage || '',
          notifyEmail: form.notifyEmail || '',
          notifyDigest: form.notifyDigest || 'none',
          webhookUrl: form.webhookUrl || '',
        }}
      />
    </div>
  );
}
