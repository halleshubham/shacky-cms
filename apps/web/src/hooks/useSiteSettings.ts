'use client';
import { useState, useEffect } from 'react';
import type { SiteSettings } from '@/lib/site-settings';

let _cache: SiteSettings | null = null;
let _fetchedAt = 0;

export function useSiteSettings(): SiteSettings {
  const [settings, setSettings] = useState<SiteSettings>(_cache || {});

  useEffect(() => {
    if (_cache && Date.now() - _fetchedAt < 60_000) return;
    fetch('/api/settings/public')
      .then((r) => r.json())
      .then((data) => {
        _cache = data;
        _fetchedAt = Date.now();
        setSettings(data);
      })
      .catch(() => {});
  }, []);

  return settings;
}
