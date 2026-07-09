'use client';
import { useState, useEffect } from 'react';
import { GripVertical, X, ChevronUp, ChevronDown, Plus, Link2, FolderOpen, Tag, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import type { NavItem } from '@/lib/site-settings';

type ItemType = NavItem['type'];

const TYPE_META: Record<ItemType, { label: string; icon: React.ReactNode; color: string }> = {
  category: { label: 'Category', icon: <FolderOpen className="h-3 w-3" />, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  tag:      { label: 'Tag',      icon: <Tag className="h-3 w-3" />,         color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' },
  page:     { label: 'Page',     icon: <FileText className="h-3 w-3" />,    color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' },
  url:      { label: 'Link',     icon: <Link2 className="h-3 w-3" />,       color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
};

function typeHref(type: ItemType, value: string): string {
  if (type === 'category') return `/category/${value}`;
  if (type === 'tag')      return `/tag/${value}`;
  if (type === 'page')     return `/${value}`;
  return value;
}

interface PickerItem { id: string; name?: string; title?: string; slug: string }

interface NavMenuEditorProps {
  value: NavItem[];
  onChange: (items: NavItem[]) => void;
}

export function NavMenuEditor({ value, onChange }: NavMenuEditorProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ItemType>('category');
  const [search, setSearch] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [pickerItems, setPickerItems] = useState<Record<ItemType, PickerItem[]>>({
    category: [], tag: [], page: [], url: [],
  });
  const [loadingPicker, setLoadingPicker] = useState(false);

  // Load categories/tags/pages when dialog opens
  useEffect(() => {
    if (!addOpen) return;
    setLoadingPicker(true);
    Promise.all([
      api.get<any[]>('/api/categories').catch(() => []),
      api.get<any[]>('/api/tags').catch(() => []),
      api.get<any[]>('/api/pages').catch(() => []),
    ]).then(([cats, tags, pages]) => {
      setPickerItems({
        category: cats.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })),
        tag:      tags.map((t: any) => ({ id: t.id, name: t.name, slug: t.slug })),
        page:     pages.map((p: any) => ({ id: p.id, title: p.title, slug: p.slug })),
        url:      [],
      });
    }).finally(() => setLoadingPicker(false));
  }, [addOpen]);

  const move = (index: number, dir: -1 | 1) => {
    const next = [...value];
    const swap = index + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[index], next[swap]] = [next[swap], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  const addItem = (type: ItemType, item: PickerItem) => {
    const label = item.name || item.title || item.slug;
    // Prevent duplicates
    if (value.some((v) => v.type === type && v.value === item.slug)) return;
    onChange([...value, { label, type, value: item.slug }]);
  };

  const addCustom = () => {
    if (!customLabel.trim() || !customUrl.trim()) return;
    onChange([...value, { label: customLabel.trim(), type: 'url', value: customUrl.trim() }]);
    setCustomLabel('');
    setCustomUrl('');
  };

  const filtered = activeTab === 'url'
    ? []
    : pickerItems[activeTab].filter((item) => {
        const name = (item.name || item.title || '').toLowerCase();
        return name.includes(search.toLowerCase());
      });

  const tabs: ItemType[] = ['category', 'tag', 'page', 'url'];

  return (
    <div className="space-y-2">
      {/* Current items */}
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-md">
          No items yet — click Add Item to build your menu.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((item, i) => {
            const meta = TYPE_META[item.type];
            return (
              <li key={i} className="flex items-center gap-2 p-2.5 border border-border rounded-md bg-card group">
                <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${meta.color}`}>
                  {meta.icon} {meta.label}
                </span>
                <span className="text-sm font-medium flex-1 truncate">{item.label}</span>
                <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px]">
                  {typeHref(item.type, item.value)}
                </span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === value.length - 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-20 transition-colors"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button type="button" variant="outline" size="sm" onClick={() => { setAddOpen(true); setSearch(''); }}
        className="gap-1.5 w-full">
        <Plus className="h-3.5 w-3.5" /> Add Item
      </Button>

      {/* Picker dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Menu Item</DialogTitle>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border pb-0 -mb-px">
            {tabs.map((tab) => {
              const meta = TYPE_META[tab];
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => { setActiveTab(tab); setSearch(''); }}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {meta.icon} {meta.label}
                </button>
              );
            })}
          </div>

          <div className="pt-1 space-y-3">
            {activeTab === 'url' ? (
              /* Custom link form */
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="e.g. Subscribe"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">URL</Label>
                  <Input
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="e.g. /subscribe or https://..."
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => { addCustom(); setAddOpen(false); }}
                  disabled={!customLabel.trim() || !customUrl.trim()}
                  className="w-full"
                >
                  Add Link
                </Button>
              </div>
            ) : (
              /* Picker list */
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={`Search ${TYPE_META[activeTab].label.toLowerCase()}s…`}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <ul className="max-h-64 overflow-y-auto space-y-0.5">
                  {loadingPicker ? (
                    <li className="text-sm text-muted-foreground text-center py-6">Loading…</li>
                  ) : filtered.length === 0 ? (
                    <li className="text-sm text-muted-foreground text-center py-6">No results</li>
                  ) : (
                    filtered.map((item) => {
                      const label = item.name || item.title || item.slug;
                      const already = value.some((v) => v.type === activeTab && v.value === item.slug);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => { addItem(activeTab, item); }}
                            disabled={already}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-left transition-colors ${
                              already
                                ? 'opacity-40 cursor-not-allowed'
                                : 'hover:bg-muted'
                            }`}
                          >
                            <span className="font-medium">{label}</span>
                            <span className="text-xs text-muted-foreground">/{item.slug}</span>
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
