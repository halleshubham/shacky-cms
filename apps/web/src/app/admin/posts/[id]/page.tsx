'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Loader2, Clock, History, Star, Code, Sparkles, Wand2, ChevronDown, ChevronUp, Search, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor } from '@/components/editor/RichTextEditor';
import { FeaturedImagePicker } from '@/components/editor/FeaturedImagePicker';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import toast from 'react-hot-toast';

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [status, setStatus] = useState('draft');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [autoSaved, setAutoSaved] = useState<Date | null>(null);
  const [revisions, setRevisions] = useState<any[]>([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [authors, setAuthors] = useState<any[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [featuredMedia, setFeaturedMedia] = useState<any>(null);
  const [isFeatured, setIsFeatured] = useState(false);
  const [codeInjectionHead, setCodeInjectionHead] = useState('');
  const [codeInjectionFoot, setCodeInjectionFoot] = useState('');

  // Search state for sidebar lists
  const [authorSearch, setAuthorSearch] = useState('');
  const [categorySearch, setCategorySearch] = useState('');

  // AI assistant state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMode, setAiMode] = useState<'write' | 'improve'>('write');
  const [aiBrief, setAiBrief] = useState('');
  const [aiTone, setAiTone] = useState('journalistic');
  const [aiWordCount, setAiWordCount] = useState(600);
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  const load = async () => {
    const [postData, catData, authorData] = await Promise.all([
      api.get<any>(`/api/posts/${id}`),
      api.get<any>('/api/categories'),
      api.get<any>('/api/authors'),
    ]);
    setPost(postData);
    setTitle(postData.title);
    setContent(postData.content);
    setExcerpt(postData.excerpt || '');
    setStatus(postData.status);
    setSeoTitle(postData.seoTitle || '');
    setSeoDescription(postData.seoDescription || '');
    setCategories(catData);
    setAuthors(authorData);
    setSelectedCategories(postData.categories?.map((c: any) => c.id) || []);
    setSelectedAuthors(postData.authors?.map((a: any) => a.id) || []);
    setFeaturedMedia(postData.featuredMedia || null);
    setIsFeatured(postData.isFeatured || false);
    setCodeInjectionHead(postData.codeInjectionHead || '');
    setCodeInjectionFoot(postData.codeInjectionFoot || '');
  };

  useEffect(() => { load(); }, [id]);

  const save = useCallback(async (isAuto = false) => {
    if (!post) return;
    if (!isAuto) setSaving(true);
    try {
      await api.patch(`/api/posts/${id}`, {
        title,
        content,
        excerpt: excerpt || null,
        status,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        featuredMediaId: featuredMedia?.id || null,
        isFeatured,
        codeInjectionHead: codeInjectionHead || null,
        codeInjectionFoot: codeInjectionFoot || null,
        categoryIds: selectedCategories,
        authorIds: selectedAuthors,
        ...(status === 'published' && !post.publishedAt && { publishedAt: new Date().toISOString() }),
      });
      if (isAuto) {
        setAutoSaved(new Date());
      } else {
        toast.success('Post saved');
      }
    } catch (err: any) {
      if (!isAuto) toast.error(err?.message || 'Save failed');
    } finally {
      if (!isAuto) setSaving(false);
    }
  }, [post, id, title, content, excerpt, status, seoTitle, seoDescription, featuredMedia, isFeatured, codeInjectionHead, codeInjectionFoot, selectedCategories, selectedAuthors]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => save(true), 30000);
    return () => clearInterval(timer);
  }, [save]);

  const loadRevisions = async () => {
    const data = await api.get<any[]>(`/api/posts/${id}/revisions`);
    setRevisions(data);
    setShowRevisions(true);
  };

  const restoreRevision = async (revisionId: string) => {
    const data = await api.post<any>(`/api/posts/${id}/restore/${revisionId}`);
    setContent(data.content);
    setTitle(data.title);
    setShowRevisions(false);
    toast.success('Revision restored');
  };

  const runAI = async (action: string) => {
    setAiLoading(action);
    try {
      if (action === 'content') {
        const payload: any = { title, tone: aiTone, wordCount: aiWordCount };
        if (aiBrief) payload.brief = aiBrief;
        if (aiMode === 'improve' && content) { payload.existingContent = content; payload.instruction = aiBrief || 'Improve and expand this content.'; }
        const res = await api.post<any>('/api/ai/generate-content', payload);
        setContent(res.content);
        if (res.excerpt) setExcerpt(res.excerpt);
        if (res.seoTitle) setSeoTitle(res.seoTitle);
        if (res.seoDescription) setSeoDescription(res.seoDescription);
        toast.success('Article generated');
      } else if (action === 'excerpt') {
        if (!content) { toast.error('Write some content first'); return; }
        const res = await api.post<any>('/api/ai/generate-excerpt', { content, title });
        setExcerpt(res.excerpt);
        toast.success('Excerpt generated');
      } else if (action === 'seo') {
        if (!content && !title) { toast.error('Add a title or content first'); return; }
        const res = await api.post<any>('/api/ai/suggest-seo', { title, content });
        if (res.seoTitle) setSeoTitle(res.seoTitle);
        if (res.seoDescription) setSeoDescription(res.seoDescription);
        toast.success('SEO suggestions applied');
      } else if (action === 'image') {
        if (!title) { toast.error('Add a title first'); return; }
        const { prompt } = await api.post<any>('/api/ai/build-image-prompt', { title, excerpt: excerpt || undefined });
        const res = await api.post<any>('/api/ai/generate-image', { prompt, style: 'photorealistic' });
        setFeaturedMedia({ id: res.mediaId, url: res.url, altText: prompt.slice(0, 100), filename: 'ai-generated.jpg' });
        toast.success('Featured image generated');
      }
    } catch (err: any) {
      toast.error(err?.message || `${action} failed`);
    } finally {
      setAiLoading(null);
    }
  };

  if (!post) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/posts"><ArrowLeft className="h-4 w-4" /> Posts</Link>
          </Button>
          <h1 className="text-xl font-bold truncate max-w-md">{post.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {autoSaved && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" /> Auto-saved {formatDateTime(autoSaved)}
            </span>
          )}
          {post.status === 'published' && post.slug && (
            <Button variant="outline" size="sm" asChild>
              <a href={`/articles/${post.slug}`} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> View Article
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadRevisions}>
            <History className="h-4 w-4" /> History
          </Button>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => save()} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Post title"
            className="text-lg font-semibold"
          />
          <RichTextEditor value={content} onChange={setContent} placeholder="Write your article here…" />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* AI Assistant */}
          <Card>
            <CardHeader className="pb-3">
              <button
                onClick={() => setAiOpen(!aiOpen)}
                className="flex items-center justify-between w-full text-left"
              >
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> AI Assistant
                </CardTitle>
                {aiOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            </CardHeader>
            {aiOpen && (
              <CardContent className="space-y-3 pt-0">
                {/* Mode toggle */}
                <div className="flex gap-1 p-1 bg-muted rounded-md">
                  {(['write', 'improve'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setAiMode(m)}
                      className={`flex-1 py-1 text-xs font-medium rounded transition-colors ${aiMode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {m === 'write' ? 'Write New' : 'Improve'}
                    </button>
                  ))}
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {aiMode === 'write' ? 'Brief / key points (optional)' : 'Instruction (optional)'}
                  </Label>
                  <textarea
                    value={aiBrief}
                    onChange={(e) => setAiBrief(e.target.value)}
                    rows={2}
                    placeholder={aiMode === 'write' ? 'Key topics to cover…' : 'E.g. make it more concise…'}
                    className="w-full text-xs bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tone</Label>
                    <select
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      className="w-full h-8 text-xs rounded border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="journalistic">Journalistic</option>
                      <option value="formal">Formal</option>
                      <option value="neutral">Neutral</option>
                      <option value="casual">Casual</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Words</Label>
                    <input
                      type="number"
                      value={aiWordCount}
                      onChange={(e) => setAiWordCount(Number(e.target.value))}
                      min={100} max={5000} step={100}
                      className="w-full h-8 text-xs rounded border border-input bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>

                <Button
                  className="w-full gap-2 text-xs h-8"
                  onClick={() => runAI('content')}
                  disabled={!!aiLoading || !title.trim()}
                >
                  {aiLoading === 'content'
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                    : <><Sparkles className="h-3.5 w-3.5" /> {aiMode === 'write' ? 'Generate Article' : 'Improve Content'}</>
                  }
                </Button>

                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Quick Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline" size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => runAI('excerpt')}
                      disabled={!!aiLoading}
                    >
                      {aiLoading === 'excerpt' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                      Excerpt
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="text-xs h-7 gap-1"
                      onClick={() => runAI('seo')}
                      disabled={!!aiLoading}
                    >
                      {aiLoading === 'seo' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
                      SEO
                    </Button>
                  </div>
                  <Button
                    variant="outline" size="sm"
                    className="w-full text-xs h-7 gap-1"
                    onClick={() => runAI('image')}
                    disabled={!!aiLoading || !title.trim()}
                  >
                    {aiLoading === 'image'
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating image…</>
                      : <><Sparkles className="h-3 w-3" /> Generate Featured Image</>
                    }
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Featured Image</CardTitle></CardHeader>
            <CardContent>
              <FeaturedImagePicker value={featuredMedia} onChange={setFeaturedMedia} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Excerpt</CardTitle></CardHeader>
            <CardContent>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={3}
                placeholder="Short description…"
                className="w-full text-sm bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Authors</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={authorSearch}
                  onChange={(e) => setAuthorSearch(e.target.value)}
                  placeholder="Search authors…"
                  className="w-full h-7 pl-7 pr-2 text-xs bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {authors
                  .filter((a) => a.displayName.toLowerCase().includes(authorSearch.toLowerCase()))
                  .map((a) => (
                    <label key={a.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedAuthors.includes(a.id)}
                        onChange={() => setSelectedAuthors((prev) =>
                          prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                        )}
                        className="rounded"
                      />
                      {a.displayName}
                    </label>
                  ))}
                {authors.filter((a) => a.displayName.toLowerCase().includes(authorSearch.toLowerCase())).length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">No authors match</p>
                )}
              </div>
              {selectedAuthors.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedAuthors.length} selected</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Categories <span className="text-muted-foreground font-normal">(max 3)</span></CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search categories…"
                  className="w-full h-7 pl-7 pr-2 text-xs bg-background border border-input rounded focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {categories
                  .filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                  .map((c) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(c.id)}
                        onChange={() => setSelectedCategories((prev) => {
                          if (prev.includes(c.id)) return prev.filter((x) => x !== c.id);
                          if (prev.length >= 3) { toast.error('Max 3 categories'); return prev; }
                          return [...prev, c.id];
                        })}
                        className="rounded"
                      />
                      {c.name}
                    </label>
                  ))}
                {categories.filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase())).length === 0 && (
                  <p className="text-xs text-muted-foreground py-1">No categories match</p>
                )}
              </div>
              {selectedCategories.length > 0 && (
                <p className="text-xs text-muted-foreground">{selectedCategories.length}/3 selected</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">SEO</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">SEO Title</Label>
                <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder="SEO title…" className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Meta Description</Label>
                <textarea
                  value={seoDescription}
                  onChange={(e) => setSeoDescription(e.target.value)}
                  rows={2}
                  placeholder="Meta description…"
                  className="w-full text-sm bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Star className="h-3.5 w-3.5" /> Featured</CardTitle></CardHeader>
            <CardContent>
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsFeatured(!isFeatured)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${isFeatured ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${isFeatured ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm text-muted-foreground">{isFeatured ? 'Featured post' : 'Not featured'}</span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Code className="h-3.5 w-3.5" /> Code Injection</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Before &lt;/head&gt;</Label>
                <textarea
                  value={codeInjectionHead}
                  onChange={(e) => setCodeInjectionHead(e.target.value)}
                  rows={3}
                  placeholder="<!-- Custom head code -->"
                  className="w-full text-xs font-mono bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Before &lt;/body&gt;</Label>
                <textarea
                  value={codeInjectionFoot}
                  onChange={(e) => setCodeInjectionFoot(e.target.value)}
                  rows={3}
                  placeholder="<!-- Custom footer code -->"
                  className="w-full text-xs font-mono bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revision history panel */}
      {showRevisions && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Revision History</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowRevisions(false)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent>
            {revisions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No revisions yet</p>
            ) : (
              <div className="divide-y">
                {revisions.map((rev) => (
                  <div key={rev.id} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-medium">{rev.title}</p>
                      <p className="text-xs text-muted-foreground">by {rev.createdBy?.name} · {formatDateTime(rev.createdAt)}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => restoreRevision(rev.id)}>Restore</Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
