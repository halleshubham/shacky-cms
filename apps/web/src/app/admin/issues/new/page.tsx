'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

const schema = z.object({
  title: z.string().min(1, 'Title required'),
  volumeNumber: z.coerce.number().int().positive(),
  issueNumber: z.coerce.number().int().positive(),
  publishDate: z.string().min(1, 'Date required'),
  type: z.enum(['print', 'blog', 'combined']),
});

type FormData = z.infer<typeof schema>;

export default function NewIssuePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'combined' },
  });

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      const issue = await api.post<any>('/api/issues', {
        ...data,
        publishDate: new Date(data.publishDate).toISOString(),
      });
      toast.success('Issue created');
      router.push(`/admin/issues/${issue.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create issue');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/issues"><ArrowLeft className="h-4 w-4" /> Issues</Link>
        </Button>
        <h1 className="text-2xl font-bold">New Issue</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input placeholder="Janata Weekly — Vol. 1, No. 1" {...register('title')} />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Volume Number</Label>
                <Input type="number" min={1} {...register('volumeNumber')} />
                {errors.volumeNumber && <p className="text-xs text-destructive">{errors.volumeNumber.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Issue Number</Label>
                <Input type="number" min={1} {...register('issueNumber')} />
                {errors.issueNumber && <p className="text-xs text-destructive">{errors.issueNumber.message}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Publish Date</Label>
              <Input type="date" {...register('publishDate')} />
              {errors.publishDate && <p className="text-xs text-destructive">{errors.publishDate.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select onValueChange={(v) => setValue('type', v as any)} defaultValue="combined">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="print">Print</SelectItem>
                  <SelectItem value="blog">Blog</SelectItem>
                  <SelectItem value="combined">Combined</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? 'Creating…' : 'Create Issue'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
