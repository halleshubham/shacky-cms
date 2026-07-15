'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { EmailBuilderCanvas } from '@/components/admin/EmailBuilderCanvas';
import { api } from '@/lib/api';
import type { Section } from '@/lib/page-builder';
import toast from 'react-hot-toast';

export default function CampaignBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [blocks, setBlocks] = useState<Section[]>([]);
  const [campaignName, setCampaignName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    api.get<any>(`/api/campaigns/${id}`)
      .then((c) => {
        setBlocks(Array.isArray(c.blocks) ? c.blocks : []);
        setCampaignName(c.name);
      })
      .catch((err) => toast.error(err?.message || 'Failed to load campaign'))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/campaigns/${id}`, { blocks });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 3000);
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const preview = useCallback(async () => {
    const res = await api.post<{ html: string }>(`/api/campaigns/${id}/preview-blocks`, { blocks });
    return res.html;
  }, [id, blocks]);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>;

  return (
    <EmailBuilderCanvas
      blocks={blocks}
      onBlocksChange={setBlocks}
      title={`${campaignName} — Content`}
      backHref={`/admin/campaigns/${id}`}
      onSave={save}
      saving={saving}
      savedOk={savedOk}
      onPreview={preview}
    />
  );
}
