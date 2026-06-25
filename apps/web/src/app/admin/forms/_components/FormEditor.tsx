'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'date';
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export interface FormData {
  name: string;
  slug: string;
  fields: FormField[];
  isActive: boolean;
  successMessage: string;
  notifyEmail: string;
  notifyDigest: string;
  webhookUrl: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Short text' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'radio', label: 'Radio buttons' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
];

const DIGEST_OPTIONS = [
  { value: '', label: 'No email notifications' },
  { value: 'per_entry', label: 'Immediately (per entry)' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'weekly', label: 'Weekly digest' },
  { value: 'monthly', label: 'Monthly digest' },
];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function newField(): FormField {
  return { name: '', label: '', type: 'text', required: false, placeholder: '' };
}

interface FieldEditorProps {
  field: FormField;
  index: number;
  onChange: (index: number, field: FormField) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}

function FieldEditor({ field, index, onChange, onRemove, onMove, isFirst, isLast }: FieldEditorProps) {
  const update = (patch: Partial<FormField>) => onChange(index, { ...field, ...patch });
  const hasOptions = field.type === 'select' || field.type === 'radio';

  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-3 space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex flex-col gap-0.5 pt-1 shrink-0">
            <button onClick={() => onMove(index, -1)} disabled={isFirst} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <GripVertical className="h-4 w-4 text-muted-foreground/40" />
            <button onClick={() => onMove(index, 1)} disabled={isLast} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Label *</Label>
              <Input
                value={field.label}
                placeholder="e.g. Full Name"
                onChange={(e) => {
                  const label = e.target.value;
                  const name = slugify(label).replace(/-/g, '_');
                  update({ label, name });
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Field name (key)</Label>
              <Input
                value={field.name}
                placeholder="e.g. full_name"
                onChange={(e) => update({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={field.type} onValueChange={(v) => update({ type: v as FormField['type'] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Placeholder</Label>
              <Input value={field.placeholder || ''} onChange={(e) => update({ placeholder: e.target.value })} />
            </div>
            {hasOptions && (
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Options (one per line)</Label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={(field.options || []).join('\n')}
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  onChange={(e) => update({ options: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                />
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0 pt-1">
            <button
              onClick={() => onRemove(index)}
              className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={!!field.required}
                onChange={(e) => update({ required: e.target.checked })}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">Required</span>
            </label>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  initialData?: Partial<FormData>;
  formId?: string;
}

export default function FormEditor({ initialData, formId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FormData>({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    fields: initialData?.fields || [],
    isActive: initialData?.isActive ?? true,
    successMessage: initialData?.successMessage || '',
    notifyEmail: initialData?.notifyEmail || '',
    notifyDigest: initialData?.notifyDigest || '',
    webhookUrl: initialData?.webhookUrl || '',
  });

  const set = (patch: Partial<FormData>) => setData((d) => ({ ...d, ...patch }));

  const addField = () => set({ fields: [...data.fields, newField()] });

  const updateField = (i: number, field: FormField) => {
    const fields = [...data.fields];
    fields[i] = field;
    set({ fields });
  };

  const removeField = (i: number) => set({ fields: data.fields.filter((_, idx) => idx !== i) });

  const moveField = (i: number, dir: -1 | 1) => {
    const fields = [...data.fields];
    const j = i + dir;
    if (j < 0 || j >= fields.length) return;
    [fields[i], fields[j]] = [fields[j], fields[i]];
    set({ fields });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data.name || !data.slug) return toast.error('Name and slug are required');
    for (const f of data.fields) {
      if (!f.name || !f.label) return toast.error('All fields must have a name and label');
    }
    setSaving(true);
    try {
      const payload = {
        ...data,
        notifyDigest: data.notifyDigest || null,
        webhookUrl: data.webhookUrl || null,
        notifyEmail: data.notifyEmail || null,
        successMessage: data.successMessage || null,
      };
      if (formId) {
        await api.patch(`/api/forms/${formId}`, payload);
        toast.success('Form saved');
      } else {
        const created = await api.post<any>('/api/forms', payload);
        toast.success('Form created');
        router.push(`/admin/forms/${created.id}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Basic info */}
      <Card>
        <CardHeader><CardTitle className="text-base">Form settings</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Form name *</Label>
              <Input
                value={data.name}
                placeholder="Contact Us"
                onChange={(e) => {
                  const name = e.target.value;
                  set({ name, slug: data.slug || slugify(name) });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Slug *</Label>
              <Input
                value={data.slug}
                placeholder="contact-us"
                onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              />
              <p className="text-xs text-muted-foreground">Public URL: /api/forms/public/{data.slug || 'slug'}</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Success message</Label>
            <Input value={data.successMessage} placeholder="Thank you for your submission." onChange={(e) => set({ successMessage: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isActive" checked={data.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="rounded" />
            <Label htmlFor="isActive" className="cursor-pointer">Form is active (accepts submissions)</Label>
          </div>
        </CardContent>
      </Card>

      {/* Fields */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Fields</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addField} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add field
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.fields.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No fields yet. Click "Add field" to get started.</p>
          ) : (
            data.fields.map((field, i) => (
              <FieldEditor
                key={i}
                field={field}
                index={i}
                onChange={updateField}
                onRemove={removeField}
                onMove={moveField}
                isFirst={i === 0}
                isLast={i === data.fields.length - 1}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHeader><CardTitle className="text-base">Notifications</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Notify email(s)</Label>
              <Input value={data.notifyEmail} placeholder="admin@example.com, team@example.com" onChange={(e) => set({ notifyEmail: e.target.value })} />
              <p className="text-xs text-muted-foreground">Comma-separated for multiple recipients</p>
            </div>
            <div className="space-y-1.5">
              <Label>Notification frequency</Label>
              <Select value={data.notifyDigest} onValueChange={(v) => set({ notifyDigest: v })}>
                <SelectTrigger><SelectValue placeholder="No notifications" /></SelectTrigger>
                <SelectContent>
                  {DIGEST_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <Input value={data.webhookUrl} placeholder="https://example.com/webhook" onChange={(e) => set({ webhookUrl: e.target.value })} />
            <p className="text-xs text-muted-foreground">Receives a POST with form data on every submission</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.push('/admin/forms')}>Cancel</Button>
        <Button type="submit" disabled={saving}>{saving ? 'Saving…' : formId ? 'Save changes' : 'Create form'}</Button>
      </div>
    </form>
  );
}
