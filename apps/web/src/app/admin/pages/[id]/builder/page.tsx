'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { PageBuilderCanvas, type Category } from '@/components/admin/PageBuilderCanvas';
import { api } from '@/lib/api';
import type { Section } from '@/lib/page-builder';
import toast from 'react-hot-toast';

export default function PageBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState<{ title: string; slug: string } | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<any>(`/api/pages/${id}`),
      api.get<any>('/api/categories').catch(() => ({ data: [] })),
    ]).then(([pg, cats]) => {
      setPage({ title: pg.title, slug: pg.slug });
      if (pg.sectionsJson) {
        try {
          const parsed = JSON.parse(pg.sectionsJson);
          if (Array.isArray(parsed)) setSections(parsed);
        } catch { /* start empty */ }
      }
      setCategories((cats.data ?? cats ?? []).filter((c: any) => !c.parentId));
    }).catch(() => toast.error('Failed to load page'))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/pages/${id}`, { sectionsJson: JSON.stringify(sections) });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;
  if (!page) return <div className="flex items-center justify-center h-64 text-muted-foreground">Page not found</div>;

  return (
    <PageBuilderCanvas
      sections={sections}
      onSectionsChange={setSections}
      categories={categories}
      title={page.title}
      backHref={`/admin/pages/${id}`}
      previewHref={`/pages/${page.slug}`}
      onSave={save}
      saving={saving}
      savedOk={savedOk}
    />
  );
}
