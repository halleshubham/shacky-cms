'use client';
import { useState, useEffect } from 'react';
import { PageBuilderCanvas, type Category } from '@/components/admin/PageBuilderCanvas';
import type { IssueOption } from '@/components/admin/blocks/IssueArticlesBlock';
import { api } from '@/lib/api';
import type { Section } from '@/lib/page-builder';
import toast from 'react-hot-toast';

export default function HomepageBuilderPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [issues, setIssues] = useState<IssueOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<any>('/api/settings'),
      api.get<any>('/api/categories').catch(() => ({ data: [] })),
      api.get<any>('/api/issues?pageSize=50').catch(() => ({ data: [] })),
    ]).then(([raw, cats, issueData]) => {
      if (raw.homepage_sections) {
        try {
          const parsed = JSON.parse(raw.homepage_sections);
          if (Array.isArray(parsed)) setSections(parsed);
        } catch { /* empty */ }
      }
      setCategories((cats.data ?? cats ?? []).filter((c: any) => !c.parentId));
      setIssues((issueData.data ?? issueData ?? []).map((i: any) => ({ id: i.id, title: i.title })));
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch('/api/settings', { homepage_sections: JSON.stringify(sections) });
      await fetch('/api/revalidate?tag=site-settings', { method: 'POST' }).catch(() => {});
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;

  return (
    <PageBuilderCanvas
      sections={sections}
      onSectionsChange={setSections}
      categories={categories}
      issues={issues}
      title="Homepage Builder"
      backHref="/admin"
      previewHref="/"
      onSave={save}
      saving={saving}
      savedOk={savedOk}
    />
  );
}
