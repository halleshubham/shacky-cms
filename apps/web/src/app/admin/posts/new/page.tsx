'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';

export default function NewPostPage() {
  const router = useRouter();
  const params = useSearchParams();
  const issueId = params.get('issueId');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Title required'); return; }
    setSaving(true);
    try {
      const post = await api.post<any>('/api/posts', {
        title,
        content,
        status,
        issueId: issueId || null,
      });
      toast.success('Post created');
      router.push(`/admin/posts/${post.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create post');
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href={issueId ? `/admin/issues/${issueId}` : '/admin/posts'}><ArrowLeft className="h-4 w-4" /> Back</Link>
          </Button>
          <h1 className="text-xl font-bold">New Post</h1>
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </div>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Post title"
        className="text-lg font-semibold"
        autoFocus
      />
      <RichTextEditor value={content} onChange={setContent} placeholder="Write your article here…" />
    </div>
  );
}
