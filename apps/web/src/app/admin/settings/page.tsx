'use client';
import { useState, useEffect } from 'react';
import { Save, Key, Loader2, Globe, Camera, Sparkles, Upload, X, Image as ImageIcon, AlertTriangle, Mail, Plug, Trash2, Menu, Languages, Volume2 } from 'lucide-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/auth';
import { NavMenuEditor } from '@/components/admin/NavMenuEditor';
import type { NavItem } from '@/lib/site-settings';

function migrateNavItems(items: any[]): NavItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item): NavItem => {
    if (item.type && item.value !== undefined) return item as NavItem;
    // Legacy format: { label, url } → { label, type: 'url', value: url }
    return { label: item.label || '', type: 'url', value: item.url || item.value || '' };
  });
}

const SECTIONS = [
  { id: 'site', label: 'Site & Branding' },
  { id: 'navigation', label: 'Navigation' },
  { id: 'social', label: 'Social Links' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'translation', label: 'Translation' },
  { id: 'tts', label: 'Text to Speech' },
  { id: 'profile', label: 'My Profile' },
  { id: 'stock', label: 'Stock Photos' },
  { id: 'ai', label: 'AI Configuration' },
  { id: '2fa', label: 'Two-Factor Auth' },
  { id: 'danger', label: 'Danger Zone' },
];

type PurgeEntity = 'posts' | 'issues' | 'categories' | 'tags' | 'authors' | 'media' | 'subscribers';
const PURGEABLE: { entity: PurgeEntity; label: string; description: string }[] = [
  { entity: 'posts',       label: 'All Posts',       description: 'Deletes every post, along with their authors, categories, tags and revisions.' },
  { entity: 'issues',      label: 'All Issues',       description: 'Deletes every issue. Posts are kept but detached from their issue.' },
  { entity: 'categories',  label: 'All Categories',   description: 'Deletes every category and removes category assignments from posts.' },
  { entity: 'tags',        label: 'All Tags',         description: 'Deletes every tag and removes tag assignments from posts.' },
  { entity: 'authors',     label: 'All Authors',      description: 'Deletes every author and removes author assignments from posts.' },
  { entity: 'media',       label: 'All Media',        description: 'Deletes all media records. Files in object storage are not removed. Posts are detached from their featured image.' },
  { entity: 'subscribers', label: 'All Subscribers',  description: 'Deletes all subscribers and list memberships.' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [totpSecret, setTotpSecret] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [enablingTotp, setEnablingTotp] = useState(false);
  const [setupMode, setSetupMode] = useState(false);

  // Site settings
  const [siteTitle, setSiteTitle] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [siteLogo, setSiteLogo] = useState('');
  const [siteFavicon, setSiteFavicon] = useState('');
  const [navPrimary, setNavPrimary] = useState<NavItem[]>([]);
  const [navSecondary, setNavSecondary] = useState<NavItem[]>([]);
  const [savingNav, setSavingNav] = useState(false);
  const [codeHead, setCodeHead] = useState('');
  const [codeFoot, setCodeFoot] = useState('');
  const [headerShowTitle, setHeaderShowTitle] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  // Social links
  const [socialFacebook, setSocialFacebook] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [socialWhatsapp, setSocialWhatsapp] = useState('');
  const [socialTelegram, setSocialTelegram] = useState('');
  const [socialYoutube, setSocialYoutube] = useState('');
  const [socialX, setSocialX] = useState('');
  const [savingSocial, setSavingSocial] = useState(false);

  // Profile
  const [profileName, setProfileName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Stock photo API keys
  const [stockUnsplash, setStockUnsplash] = useState('');
  const [stockPexels, setStockPexels] = useState('');
  const [stockPixabay, setStockPixabay] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  // Newsletter / WhatsApp settings
  const [nlTagline, setNlTagline] = useState('');
  const [nlEditors, setNlEditors] = useState('');
  const [nlAbout, setNlAbout] = useState('');
  const [nlFacebook, setNlFacebook] = useState('');
  const [nlSubscribeUrl, setNlSubscribeUrl] = useState('');
  const [nlWaGroups, setNlWaGroups] = useState('');
  const [nlWaChannels, setNlWaChannels] = useState('');
  const [savingNl, setSavingNl] = useState(false);

  // TTS settings
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [ttsLanguage, setTtsLanguage] = useState('mr-IN');
  const [savingTts, setSavingTts] = useState(false);

  // Translation settings
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [translationLanguages, setTranslationLanguages] = useState('mr,hi');
  const [savingTranslation, setSavingTranslation] = useState(false);

  // AI configuration
  const [aiProvider, setAiProvider] = useState<'openai' | 'gemini' | 'ollama' | 'groq'>('openai');
  const [aiApiKey, setAiApiKey] = useState('');
  const [aiApiUrl, setAiApiUrl] = useState('http://localhost:11434');
  const [aiTextModel, setAiTextModel] = useState('');
  const [aiImageModel, setAiImageModel] = useState('');
  const [aiModels, setAiModels] = useState<Record<string, { text: string[]; image: string[] }>>({
    openai: { text: [], image: [] }, gemini: { text: [], image: [] },
    groq: { text: [], image: [] }, ollama: { text: [], image: [] },
  });
  const [aiConfigured, setAiConfigured] = useState(false);
  const [savingAI, setSavingAI] = useState(false);
  const [fetchingOllamaModels, setFetchingOllamaModels] = useState(false);

  useEffect(() => {
    api.get<any>('/api/auth/me').then((me) => setProfileName(me.name || '')).catch(() => {});
    api.get<any>('/api/settings').then((s) => {
      setSiteTitle(s.site_title || '');
      setSiteDescription(s.site_description || '');
      setSiteLogo(s.site_logo || '');
      setSiteFavicon(s.site_icon || '');
      try { setNavPrimary(migrateNavItems(s.nav_primary ? (typeof s.nav_primary === 'string' ? JSON.parse(s.nav_primary) : s.nav_primary) : [])); } catch { setNavPrimary([]); }
      try { setNavSecondary(migrateNavItems(s.nav_secondary ? (typeof s.nav_secondary === 'string' ? JSON.parse(s.nav_secondary) : s.nav_secondary) : [])); } catch { setNavSecondary([]); }
      setCodeHead(s.code_injection_head || '');
      setCodeFoot(s.code_injection_foot || '');
      setHeaderShowTitle(s.header_show_title === 'true');
      setStockUnsplash(s.stock_unsplash_key ? '••••••••' : '');
      setStockPexels(s.stock_pexels_key ? '••••••••' : '');
      setStockPixabay(s.stock_pixabay_key ? '••••••••' : '');
      setNlTagline(s.newsletter_tagline || '');
      setNlEditors(s.newsletter_editors || '');
      setNlAbout(s.newsletter_about || '');
      setNlFacebook(s.newsletter_facebook || '');
      setNlSubscribeUrl(s.newsletter_subscribe_url || '');
      setNlWaGroups(s.newsletter_wa_groups || '');
      setNlWaChannels(s.newsletter_wa_channels || '');
      setTtsEnabled(s.tts_enabled === 'true');
      setTtsLanguage(s.tts_language || 'mr-IN');
      setTranslationEnabled(s.translation_enabled === 'true');
      setTranslationLanguages(s.translation_languages || 'mr,hi');
      setSocialFacebook(s.social_facebook || '');
      setSocialInstagram(s.social_instagram || '');
      setSocialWhatsapp(s.social_whatsapp || '');
      setSocialTelegram(s.social_telegram || '');
      setSocialYoutube(s.social_youtube || '');
      setSocialX(s.social_x || '');
    }).catch(() => {});
    api.get<any>('/api/ai/config').then((cfg) => {
      if (cfg.configured) {
        setAiConfigured(true);
        setAiProvider(cfg.provider);
        // Normalize to bullet-masked so the guard consistently catches it
        if (cfg.apiKeyMasked) setAiApiKey(`••••${cfg.apiKeyMasked.slice(-4)}`);
        if (cfg.apiUrl) setAiApiUrl(cfg.apiUrl);
        setAiTextModel(cfg.textModel || '');
        setAiImageModel(cfg.imageModel || '');
      }
    }).catch(() => {});
    api.get<any>('/api/ai/models').then(setAiModels).catch(() => {});
  }, []);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload: any = {};
      if (profileName) payload.name = profileName;
      if (newPassword) { payload.currentPassword = currentPassword; payload.newPassword = newPassword; }
      await api.patch('/api/auth/me', payload);
      toast.success('Profile updated');
      setCurrentPassword(''); setNewPassword('');
    } catch (err: any) { toast.error(err?.message || 'Update failed'); }
    finally { setSavingProfile(false); }
  };

  const saveSiteSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.patch('/api/settings', {
        site_title: siteTitle,
        site_description: siteDescription,
        site_logo: siteLogo,
        site_icon: siteFavicon,
        code_injection_head: codeHead,
        code_injection_foot: codeFoot,
        header_show_title: String(headerShowTitle),
      });
      toast.success('Site settings saved');
    } catch (err: any) { toast.error(err?.message || 'Save failed'); }
    finally { setSavingSettings(false); }
  };

  const saveNavSettings = async () => {
    setSavingNav(true);
    try {
      await api.patch('/api/settings', {
        nav_primary: JSON.stringify(navPrimary),
        nav_secondary: JSON.stringify(navSecondary),
      });
      toast.success('Navigation saved');
    } catch (err: any) { toast.error(err?.message || 'Save failed'); }
    finally { setSavingNav(false); }
  };

  const saveSocialLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSocial(true);
    try {
      await api.patch('/api/settings', {
        social_facebook: socialFacebook,
        social_instagram: socialInstagram,
        social_whatsapp: socialWhatsapp,
        social_telegram: socialTelegram,
        social_youtube: socialYoutube,
        social_x: socialX,
      });
      toast.success('Social links saved');
    } catch (err: any) { toast.error(err?.message || 'Save failed'); }
    finally { setSavingSocial(false); }
  };

  const saveNewsletterSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNl(true);
    try {
      await api.patch('/api/settings', {
        newsletter_tagline: nlTagline,
        newsletter_editors: nlEditors,
        newsletter_about: nlAbout,
        newsletter_facebook: nlFacebook,
        newsletter_subscribe_url: nlSubscribeUrl,
        newsletter_wa_groups: nlWaGroups,
        newsletter_wa_channels: nlWaChannels,
      });
      toast.success('Newsletter settings saved');
    } catch (err: any) { toast.error(err?.message || 'Save failed'); }
    finally { setSavingNl(false); }
  };

  const saveTtsSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTts(true);
    try {
      await api.patch('/api/settings', {
        tts_enabled: String(ttsEnabled),
        tts_language: ttsLanguage,
      });
      toast.success('TTS settings saved');
    } catch (err: any) { toast.error(err?.message || 'Save failed'); }
    finally { setSavingTts(false); }
  };

  const saveTranslationSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTranslation(true);
    try {
      await api.patch('/api/settings', {
        translation_enabled: String(translationEnabled),
        translation_languages: translationLanguages,
      });
      toast.success('Translation settings saved');
    } catch (err: any) { toast.error(err?.message || 'Save failed'); }
    finally { setSavingTranslation(false); }
  };

  const saveStockKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingStock(true);
    try {
      const payload: Record<string, string> = {};
      if (stockUnsplash && !stockUnsplash.startsWith('•')) payload.stock_unsplash_key = stockUnsplash;
      if (stockPexels && !stockPexels.startsWith('•')) payload.stock_pexels_key = stockPexels;
      if (stockPixabay && !stockPixabay.startsWith('•')) payload.stock_pixabay_key = stockPixabay;
      if (Object.keys(payload).length > 0) {
        await api.patch('/api/settings', payload);
        toast.success('Stock photo API keys saved');
      }
    } catch (err: any) { toast.error(err?.message || 'Save failed'); }
    finally { setSavingStock(false); }
  };

  const uploadImage = async (file: File, setter: (url: string) => void, setUploading: (v: boolean) => void) => {
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = await api.upload<{ url: string }>('/api/media/upload', form);
      setter(result.url);
      toast.success('Uploaded');
    } catch (err: any) { toast.error(err?.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  const saveAIConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    // Key is "new" only if it was typed (not masked). Masked = starts with •.
    const keyIsNew = aiProvider !== 'ollama' && !!aiApiKey && !aiApiKey.startsWith('•');
    // Require a key only on first-time setup (not already configured)
    if (aiProvider !== 'ollama' && !aiConfigured && !keyIsNew) {
      toast.error('Enter your API key to save'); return;
    }
    setSavingAI(true);
    try {
      await api.post('/api/ai/config', {
        provider: aiProvider,
        // Only include apiKey when user actually typed a new one — never re-send the masked placeholder
        ...(keyIsNew ? { apiKey: aiApiKey } : {}),
        apiUrl: aiProvider === 'ollama' ? aiApiUrl : undefined,
        textModel: aiTextModel || undefined,
        imageModel: (aiProvider === 'openai' || aiProvider === 'gemini') ? (aiImageModel || undefined) : undefined,
      });
      setAiConfigured(true);
      if (keyIsNew) setAiApiKey(`••••${aiApiKey.slice(-4)}`);
      toast.success('AI configuration saved');
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
    finally { setSavingAI(false); }
  };

  const removeAIConfig = async () => {
    if (!confirm('Remove AI configuration?')) return;
    try {
      await api.delete('/api/ai/config');
      setAiConfigured(false); setAiApiKey(''); setAiTextModel(''); setAiImageModel('');
      toast.success('AI configuration removed');
    } catch (err: any) { toast.error(err?.message || 'Failed'); }
  };

  const refreshOllamaModels = async () => {
    setFetchingOllamaModels(true);
    try {
      const data = await api.get<any>(`/api/ai/models?ollamaUrl=${encodeURIComponent(aiApiUrl)}`);
      setAiModels(data);
      toast.success(`Found ${data.ollama?.text?.length || 0} Ollama model(s)`);
    } catch { toast.error('Could not reach Ollama server'); }
    finally { setFetchingOllamaModels(false); }
  };


  const setupTotp = async () => {
    const data = await api.post<any>('/api/auth/totp/setup');
    setQrCode(data.qrCode);
    setTotpSecret(data.secret);
    setSetupMode(true);
  };

  const verifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnablingTotp(true);
    try {
      await api.post('/api/auth/totp/verify', { code: totpCode });
      toast.success('2FA enabled successfully');
      setSetupMode(false);
      setQrCode(null);
    } catch (err: any) {
      toast.error(err?.message || 'Invalid code');
    } finally {
      setEnablingTotp(false);
    }
  };


  // Danger Zone
  const [counts, setCounts] = useState<Record<PurgeEntity, number> | null>(null);
  const [purgeTarget, setPurgeTarget] = useState<PurgeEntity | null>(null);
  const [purgeConfirm, setPurgeConfirm] = useState('');
  const [purging, setPurging] = useState(false);

  useEffect(() => {
    api.get<Record<PurgeEntity, number>>('/api/settings/counts').then(setCounts).catch(() => {});
  }, []);

  const openPurge = (entity: PurgeEntity) => { setPurgeTarget(entity); setPurgeConfirm(''); };
  const closePurge = () => { if (!purging) { setPurgeTarget(null); setPurgeConfirm(''); } };

  const confirmPurge = async () => {
    if (!purgeTarget || purgeConfirm !== 'DELETE') return;
    setPurging(true);
    try {
      const { deleted } = await api.post<{ deleted: number }>('/api/settings/purge', { entity: purgeTarget });
      toast.success(`Deleted ${deleted} ${purgeTarget}`);
      setCounts((prev) => prev ? { ...prev, [purgeTarget]: 0 } : prev);
      closePurge();
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setPurging(false);
    }
  };

  return (
    <>
    <div className="flex gap-8 items-start">
      {/* Quick-nav sidebar */}
      <nav className="hidden lg:flex flex-col gap-0.5 w-44 shrink-0 sticky top-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-2">Jump to</p>
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="text-sm text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted transition-colors"
          >
            {s.label}
          </a>
        ))}
        <div className="mt-3 pt-3 border-t border-border">
          <a
            href="/admin/integrations"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted transition-colors"
          >
            <Plug className="h-3.5 w-3.5" /> Integrations
          </a>
        </div>
      </nav>

      <div className="flex-1 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Site & Branding */}
      <Card id="site">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Site &amp; Branding</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveSiteSettings} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Site Title</Label>
              <Input value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} placeholder="Shacky CMS" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Site Description</Label>
              <textarea value={siteDescription} onChange={(e) => setSiteDescription(e.target.value)} rows={2}
                placeholder="An independent weekly publication…"
                className="w-full text-sm bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            {/* Logo upload */}
            <div className="space-y-2">
              <Label className="text-xs">Logo</Label>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, setSiteLogo, setUploadingLogo); e.target.value = ''; }} />
              {siteLogo ? (
                <div className="flex items-center gap-3 p-2 border border-border rounded-md">
                  {/* Checkered background shows PNG transparency */}
                  <div className="rounded overflow-hidden shrink-0"
                    style={{ backgroundImage: 'repeating-conic-gradient(#80808022 0% 25%, transparent 0% 50%)', backgroundSize: '10px 10px' }}>
                    <img src={siteLogo} alt="Logo" className="h-10 w-auto max-w-[140px] object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{siteLogo.split('/').pop()}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                      {uploadingLogo ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Replace
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setSiteLogo('')}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}
                  className="flex items-center gap-2 w-full border-2 border-dashed border-border rounded-md px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors">
                  {uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  {uploadingLogo ? 'Uploading…' : 'Upload logo image'}
                  <span className="text-xs ml-auto opacity-60">PNG (transparent), SVG, WebP</span>
                </button>
              )}
              <Input value={siteLogo} onChange={(e) => setSiteLogo(e.target.value)} placeholder="Or paste a URL…" className="text-xs" />
              {siteLogo && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    id="header-show-title"
                    type="checkbox"
                    checked={headerShowTitle}
                    onChange={(e) => setHeaderShowTitle(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="header-show-title" className="text-xs cursor-pointer">
                    Show site title next to logo in header
                  </Label>
                </div>
              )}
            </div>

            {/* Favicon upload */}
            <div className="space-y-2">
              <Label className="text-xs">Favicon</Label>
              <input ref={faviconInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f, setSiteFavicon, setUploadingFavicon); e.target.value = ''; }} />
              {siteFavicon ? (
                <div className="flex items-center gap-3 p-2 border border-border rounded-md bg-muted/30">
                  <img src={siteFavicon} alt="Favicon" className="h-8 w-8 object-contain rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{siteFavicon.split('/').pop()}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon}>
                      {uploadingFavicon ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Replace
                    </Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground" onClick={() => setSiteFavicon('')}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => faviconInputRef.current?.click()} disabled={uploadingFavicon}
                  className="flex items-center gap-2 w-full border-2 border-dashed border-border rounded-md px-4 py-3 text-sm text-muted-foreground hover:border-primary hover:text-foreground transition-colors">
                  {uploadingFavicon ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  {uploadingFavicon ? 'Uploading…' : 'Upload favicon'}
                  <span className="text-xs ml-auto opacity-60">32×32 or 64×64 recommended</span>
                </button>
              )}
              <Input value={siteFavicon} onChange={(e) => setSiteFavicon(e.target.value)} placeholder="Or paste a URL…" className="text-xs" />
            </div>


            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Code Injection &lt;head&gt;</Label>
                <textarea value={codeHead} onChange={(e) => setCodeHead(e.target.value)} rows={3}
                  placeholder="<!-- Analytics, etc -->"
                  className="w-full text-xs font-mono bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Code Injection &lt;/body&gt;</Label>
                <textarea value={codeFoot} onChange={(e) => setCodeFoot(e.target.value)} rows={3}
                  placeholder="<!-- Footer scripts -->"
                  className="w-full text-xs font-mono bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <Button type="submit" disabled={savingSettings} className="gap-2">
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Navigation */}
      <Card id="navigation">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Menu className="h-4 w-4" /> Navigation</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Header Menu</p>
              <p className="text-xs text-muted-foreground mt-0.5">Links shown in the top navigation bar. Drag ↑↓ to reorder.</p>
            </div>
            <NavMenuEditor value={navPrimary} onChange={setNavPrimary} />
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-medium">Footer Menu</p>
              <p className="text-xs text-muted-foreground mt-0.5">Links shown in the site footer.</p>
            </div>
            <NavMenuEditor value={navSecondary} onChange={setNavSecondary} />
          </div>

          <Button onClick={saveNavSettings} disabled={savingNav} className="gap-2">
            {savingNav ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Navigation
          </Button>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card id="social">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Social Links</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Social profile URLs shown in the site header and footer. Leave blank to hide an icon.
          </p>
          <form onSubmit={saveSocialLinks} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="social_facebook">Facebook</Label>
                <Input id="social_facebook" placeholder="https://facebook.com/yourpage" value={socialFacebook} onChange={(e) => setSocialFacebook(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="social_instagram">Instagram</Label>
                <Input id="social_instagram" placeholder="https://instagram.com/yourhandle" value={socialInstagram} onChange={(e) => setSocialInstagram(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="social_whatsapp">WhatsApp</Label>
                <Input id="social_whatsapp" placeholder="https://wa.me/919876543210" value={socialWhatsapp} onChange={(e) => setSocialWhatsapp(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="social_telegram">Telegram</Label>
                <Input id="social_telegram" placeholder="https://t.me/yourchannel" value={socialTelegram} onChange={(e) => setSocialTelegram(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="social_youtube">YouTube</Label>
                <Input id="social_youtube" placeholder="https://youtube.com/@yourchannel" value={socialYoutube} onChange={(e) => setSocialYoutube(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="social_x">X (Twitter)</Label>
                <Input id="social_x" placeholder="https://x.com/yourhandle" value={socialX} onChange={(e) => setSocialX(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={savingSocial} className="gap-2">
              {savingSocial ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Social Links
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Newsletter & WhatsApp */}
      <Card id="newsletter">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Mail className="h-4 w-4" /> Newsletter &amp; WhatsApp</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Configure the branding and links used when generating HTML newsletters and WhatsApp messages from campaigns.
          </p>
          <form onSubmit={saveNewsletterSettings} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Tagline</Label>
              <Input value={nlTagline} onChange={(e) => setNlTagline(e.target.value)} placeholder="India's oldest Socialist Weekly!" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Editors (one per line, e.g. "Editor: Dr. G.G. Parikh")</Label>
              <textarea value={nlEditors} onChange={(e) => setNlEditors(e.target.value)} rows={3}
                placeholder={"Editor: Dr. G.G. Parikh\nAssociate Editor: Neeraj Jain\nManaging Editor: Guddi"}
                className="w-full text-sm bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">About (short paragraph used in email footer and WhatsApp footer)</Label>
              <textarea value={nlAbout} onChange={(e) => setNlAbout(e.target.value)} rows={3}
                placeholder="An independent socialist journal raising its voice of principled dissent…"
                className="w-full text-sm bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Facebook URL</Label>
                <Input value={nlFacebook} onChange={(e) => setNlFacebook(e.target.value)} placeholder="https://facebook.com/yourpage" type="url" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Subscribe Page URL</Label>
                <Input value={nlSubscribeUrl} onChange={(e) => setNlSubscribeUrl(e.target.value)} placeholder="https://yoursite.com/subscribe" type="url" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">WhatsApp Groups — Digest footer (JSON)</Label>
              <p className="text-xs text-muted-foreground">Array of groups shown at the bottom of each digest part.</p>
              <textarea value={nlWaGroups} onChange={(e) => setNlWaGroups(e.target.value)} rows={3}
                placeholder={'[{"label":"Group 1","url":"https://chat.whatsapp.com/..."},{"label":"Group 2","url":"..."}]'}
                className="w-full text-xs font-mono bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">WhatsApp Channels — Per-article footer (JSON)</Label>
              <p className="text-xs text-muted-foreground">Each channel generates its own set of per-article messages with a custom footer.</p>
              <textarea value={nlWaChannels} onChange={(e) => setNlWaChannels(e.target.value)} rows={5}
                placeholder={'[{"id":"abhivyakti","name":"Abhivyakti","links":[{"label":"Join English Channel","url":"https://..."},{"label":"Join Marathi Channel","url":"https://..."}]}]'}
                className="w-full text-xs font-mono bg-background border border-input rounded-md p-2 resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <Button type="submit" disabled={savingNl} className="gap-2">
              {savingNl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Newsletter Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Translation */}
      <Card id="translation">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Languages className="h-4 w-4" /> Translation</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Show language buttons on article pages so readers can translate content using Google Translate.
          </p>
          <form onSubmit={saveTranslationSettings} className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                id="translation-enabled"
                type="checkbox"
                checked={translationEnabled}
                onChange={(e) => setTranslationEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="translation-enabled" className="text-sm font-medium cursor-pointer">
                Enable browser translation buttons
              </Label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Languages (comma-separated codes)</Label>
              <Input
                value={translationLanguages}
                onChange={(e) => setTranslationLanguages(e.target.value)}
                placeholder="mr,hi"
                className="max-w-xs text-sm font-mono"
                disabled={!translationEnabled}
              />
              <p className="text-xs text-muted-foreground">e.g. <code>mr</code> = Marathi, <code>hi</code> = Hindi. Default: <code>mr,hi</code></p>
            </div>
            <Button type="submit" disabled={savingTranslation} className="gap-2">
              {savingTranslation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Translation Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Text to Speech */}
      <Card id="tts">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Volume2 className="h-4 w-4" /> Text to Speech</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Show a Play button on article pages so readers can listen to articles using the browser&apos;s built-in speech engine. No API key required.
          </p>
          <form onSubmit={saveTtsSettings} className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                id="tts-enabled"
                type="checkbox"
                checked={ttsEnabled}
                onChange={(e) => setTtsEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="tts-enabled" className="text-sm font-medium cursor-pointer">
                Enable text-to-speech on articles
              </Label>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Language / voice code</Label>
              <Input
                value={ttsLanguage}
                onChange={(e) => setTtsLanguage(e.target.value)}
                placeholder="mr-IN"
                className="max-w-xs text-sm font-mono"
                disabled={!ttsEnabled}
              />
              <p className="text-xs text-muted-foreground">
                BCP-47 code: <code>mr-IN</code> = Marathi, <code>hi-IN</code> = Hindi, <code>en-US</code> = English.
                Voice availability depends on the reader&apos;s OS and browser.
              </p>
            </div>
            <Button type="submit" disabled={savingTts} className="gap-2">
              {savingTts ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save TTS Settings
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Profile */}
      <Card id="profile">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Key className="h-4 w-4" /> My Profile</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Display Name</Label>
              <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Your name" />
            </div>
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Change Password</p>
              <div className="space-y-1">
                <Label className="text-xs">Current Password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••••••" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">New Password (min 12 chars)</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••••••" />
              </div>
            </div>
            <Button type="submit" disabled={savingProfile} className="gap-2">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Profile
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Stock Photos */}
      <Card id="stock">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Camera className="h-4 w-4" /> Stock Photos API Keys</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Connect free stock photo services to search and use copyright-free images in your posts.
            <strong> Wikimedia Commons works without any key.</strong>
          </p>
          <form onSubmit={saveStockKeys} className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-black" />
                Unsplash Access Key
              </Label>
              <Input
                value={stockUnsplash}
                onChange={(e) => setStockUnsplash(e.target.value)}
                placeholder="Paste your Unsplash Client-ID key…"
                type={stockUnsplash.startsWith('•') ? 'password' : 'text'}
                onFocus={(e) => { if (e.target.value.startsWith('•')) setStockUnsplash(''); }}
              />
              <p className="text-xs text-muted-foreground">
                Get a free key at <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="text-primary underline">unsplash.com/developers</a>
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#05A081]" />
                Pexels API Key
              </Label>
              <Input
                value={stockPexels}
                onChange={(e) => setStockPexels(e.target.value)}
                placeholder="Paste your Pexels API key…"
                type={stockPexels.startsWith('•') ? 'password' : 'text'}
                onFocus={(e) => { if (e.target.value.startsWith('•')) setStockPexels(''); }}
              />
              <p className="text-xs text-muted-foreground">
                Get a free key at <a href="https://www.pexels.com/api/" target="_blank" rel="noopener noreferrer" className="text-primary underline">pexels.com/api</a>
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-[#2EC66E]" />
                Pixabay API Key
              </Label>
              <Input
                value={stockPixabay}
                onChange={(e) => setStockPixabay(e.target.value)}
                placeholder="Paste your Pixabay API key…"
                type={stockPixabay.startsWith('•') ? 'password' : 'text'}
                onFocus={(e) => { if (e.target.value.startsWith('•')) setStockPixabay(''); }}
              />
              <p className="text-xs text-muted-foreground">
                Get a free key at <a href="https://pixabay.com/api/docs/" target="_blank" rel="noopener noreferrer" className="text-primary underline">pixabay.com/api</a>
              </p>
            </div>
            <Button type="submit" disabled={savingStock} className="gap-2">
              {savingStock ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save API Keys
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* AI Configuration */}
      <Card id="ai">
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> AI Configuration</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Connect an AI provider to enable article writing assistance, SEO suggestions, and featured image generation.
          </p>
          <form onSubmit={saveAIConfig} className="space-y-4">
            {/* Provider selector */}
            <div className="space-y-1">
              <Label className="text-xs">Provider</Label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { id: 'openai',  label: 'OpenAI',         sub: 'GPT-4o · DALL-E · paid' },
                  { id: 'gemini',  label: 'Google Gemini',  sub: 'Gemini · Imagen · paid' },
                  { id: 'groq',    label: 'Groq',           sub: 'Llama · Mixtral · free' },
                  { id: 'ollama',  label: 'Ollama',         sub: 'Local models · free' },
                ] as const).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { setAiProvider(p.id); setAiTextModel(''); setAiImageModel(''); }}
                    className={`py-2 px-3 rounded-md border text-left transition-colors ${
                      aiProvider === p.id ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
                    }`}
                  >
                    <div className="text-sm font-medium">{p.label}</div>
                    <div className="text-xs opacity-60 mt-0.5">{p.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Ollama: URL field */}
            {aiProvider === 'ollama' ? (
              <div className="space-y-1">
                <Label className="text-xs">Ollama Server URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={aiApiUrl}
                    onChange={(e) => setAiApiUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                  />
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={refreshOllamaModels}
                    disabled={fetchingOllamaModels}
                    className="shrink-0 gap-1.5"
                  >
                    {fetchingOllamaModels ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Fetch models
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Install from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">ollama.com</a>. Run <code className="bg-muted px-1 rounded">ollama pull llama3.2</code> to download a model.
                </p>
              </div>
            ) : (
              /* API Key for all other providers */
              <div className="space-y-1">
                <Label className="text-xs">
                  {aiProvider === 'openai' ? 'OpenAI' : aiProvider === 'gemini' ? 'Gemini' : 'Groq'} API Key
                </Label>
                <Input
                  value={aiApiKey}
                  onChange={(e) => setAiApiKey(e.target.value)}
                  onFocus={(e) => { if (e.target.value.startsWith('•')) setAiApiKey(''); }}
                  placeholder={aiProvider === 'openai' ? 'sk-…' : aiProvider === 'groq' ? 'gsk_…' : 'AI…'}
                  type={aiApiKey.startsWith('•') ? 'password' : 'text'}
                />
                <p className="text-xs text-muted-foreground">
                  {aiProvider === 'openai' && <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">platform.openai.com/api-keys</a>}
                  {aiProvider === 'gemini' && <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline">aistudio.google.com/app/apikey</a>}
                  {aiProvider === 'groq' && <><a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">console.groq.com/keys</a> — free tier, very fast</>}
                </p>
              </div>
            )}

            {/* Model selectors */}
            <div className={`grid gap-3 ${(aiProvider === 'openai' || aiProvider === 'gemini') ? 'grid-cols-2' : 'grid-cols-1'}`}>
              <div className="space-y-1">
                <Label className="text-xs">Text / Writing Model</Label>
                {aiProvider === 'ollama' ? (
                  <Input
                    value={aiTextModel}
                    onChange={(e) => setAiTextModel(e.target.value)}
                    placeholder="e.g. llama3.2"
                    className="text-sm"
                  />
                ) : (
                  <select
                    value={aiTextModel}
                    onChange={(e) => setAiTextModel(e.target.value)}
                    className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— default —</option>
                    {(aiModels[aiProvider]?.text || []).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                )}
              </div>
              {(aiProvider === 'openai' || aiProvider === 'gemini') && (
                <div className="space-y-1">
                  <Label className="text-xs">Image Generation Model</Label>
                  <select
                    value={aiImageModel}
                    onChange={(e) => setAiImageModel(e.target.value)}
                    className="w-full h-9 text-sm rounded-md border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">— default —</option>
                    {(aiModels[aiProvider]?.image || []).map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {(aiProvider === 'groq' || aiProvider === 'ollama') && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Image generation is not supported with {aiProvider === 'ollama' ? 'Ollama' : 'Groq'}. Use OpenAI or Gemini to generate featured images.
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={savingAI} className="gap-2">
                {savingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save AI Config
              </Button>
              {aiConfigured && (
                <Button type="button" variant="outline" onClick={removeAIConfig} className="text-destructive hover:text-destructive border-destructive/30">
                  Remove
                </Button>
              )}
            </div>

            {aiConfigured && (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                AI configured · {
                  aiProvider === 'openai' ? 'OpenAI' :
                  aiProvider === 'gemini' ? 'Google Gemini' :
                  aiProvider === 'groq' ? 'Groq (free)' : 'Ollama (local)'
                } is ready
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Two-Factor Auth */}
      <Card id="2fa">
        <CardHeader>
          <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user?.totpEnabled ? (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              2FA is enabled on your account
            </div>
          ) : setupMode ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Scan this QR code with your authenticator app:</p>
              {qrCode && <img src={qrCode} alt="TOTP QR Code" className="w-48 h-48 border rounded" />}
              <p className="text-xs font-mono bg-muted p-2 rounded break-all">Secret: {totpSecret}</p>
              <form onSubmit={verifyTotp} className="flex gap-2">
                <Input
                  placeholder="Enter 6-digit code"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  maxLength={6}
                  inputMode="numeric"
                  className="max-w-xs"
                />
                <Button type="submit" disabled={enablingTotp || totpCode.length < 6}>
                  {enablingTotp ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Enable'}
                </Button>
              </form>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Add an extra layer of security to your account.</p>
              <Button onClick={setupTotp} variant="outline" className="gap-2">
                <Key className="h-4 w-4" /> Set up 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card id="danger" className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <p className="text-sm text-muted-foreground mb-4">
            Permanently delete all records of a given type. These actions are irreversible.
          </p>
          <div className="divide-y border border-destructive/20 rounded-lg">
            {PURGEABLE.map(({ entity, label, description }) => (
              <div key={entity} className="flex items-center justify-between px-4 py-3 gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{label}
                    {counts && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        ({counts[entity].toLocaleString()} records)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openPurge(entity)}
                  className="shrink-0 text-destructive border-destructive/40 hover:bg-destructive hover:text-destructive-foreground"
                  disabled={counts?.[entity] === 0}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete All
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>

    {/* Purge confirmation dialog */}
    <Dialog open={!!purgeTarget} onOpenChange={(open) => { if (!open) closePurge(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete {PURGEABLE.find((p) => p.entity === purgeTarget)?.label}?
          </DialogTitle>
          <DialogDescription>
            {PURGEABLE.find((p) => p.entity === purgeTarget)?.description}
            {' '}This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label className="text-sm">Type <span className="font-mono font-bold">DELETE</span> to confirm</Label>
          <Input
            value={purgeConfirm}
            onChange={(e) => setPurgeConfirm(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            className="font-mono"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={closePurge} disabled={purging}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={confirmPurge}
            disabled={purgeConfirm !== 'DELETE' || purging}
            className="gap-2"
          >
            {purging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {purging ? 'Deleting…' : 'Delete permanently'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
