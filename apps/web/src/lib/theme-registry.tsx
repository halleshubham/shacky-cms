import type { ComponentType } from 'react';
import type { ThemeHeaderProps, ThemeFooterProps, ThemeHomeProps } from './theme-types';

export type { ThemeHeaderProps, ThemeFooterProps, ThemeHomeProps };

// ─── Theme config ──────────────────────────────────────────────────────────────

export interface ThemeConfig {
  id: string;
  label: string;
  description: string;
  dataTheme?: string;
  wrapperClass: string;
  mainClass: string;
  Header: ComponentType<ThemeHeaderProps>;
  Footer: ComponentType<ThemeFooterProps>;
  HomePage: ComponentType<ThemeHomeProps>;
  adminPreview: {
    background: string;
    border?: string;
    primaryBar: string;
    secondaryBar: string;
    accentBar: string;
  };
}

// ─── Theme component imports ───────────────────────────────────────────────────

import { ClassicHeader }   from '@/components/public/themes/classic/Header';
import { ClassicFooter }   from '@/components/public/themes/classic/Footer';
import { ClassicHomePage } from '@/components/public/themes/classic/HomePage';
import { MedusaHeader }   from '@/components/public/themes/medusa/Header';
import { MedusaFooter }   from '@/components/public/themes/medusa/Footer';
import { MedusaHomePage } from '@/components/public/themes/medusa/HomePage';
import { CoppperHeader }   from '@/components/public/themes/coppper/Header';
import { CoppperFooter }   from '@/components/public/themes/coppper/Footer';
import { CoppperHomePage } from '@/components/public/themes/coppper/HomePage';

// ─── Registry ─────────────────────────────────────────────────────────────────
// To add a theme: POST /api/themes/generate from the admin Appearance panel.

export const THEME_REGISTRY: Record<string, ThemeConfig> = {
  'classic': {
    id: 'classic',
    label: 'Classic',
    description: 'Playfair Display serif typeface, cobalt blue accents, editorial magazine layout',
    dataTheme: undefined,
    wrapperClass: 'min-h-screen flex flex-col bg-background text-foreground',
    mainClass: 'flex-1 max-w-6xl mx-auto w-full px-4 py-8',
    Header:   ClassicHeader,
    Footer:   ClassicFooter,
    HomePage: ClassicHomePage,
    adminPreview: {
      background: '#F0F4F8',
      primaryBar: '#0F172A',
      secondaryBar: '#94A3B8',
      accentBar: '#2563EB',
    },
  },

  'medusa': {
    id: 'medusa',
    label: 'Medusa',
    description: 'Inter sans-serif, black & white palette, premium minimal SaaS aesthetic',
    dataTheme: 'medusa',
    wrapperClass: 'min-h-screen flex flex-col bg-background text-foreground',
    mainClass: 'flex-1 w-full px-4 sm:px-6 md:px-10 max-w-[1280px] mx-auto',
    Header:   MedusaHeader,
    Footer:   MedusaFooter,
    HomePage: MedusaHomePage,
    adminPreview: {
      background: '#FFFFFF',
      border: '#E5E7EB',
      primaryBar: '#111111',
      secondaryBar: '#888888',
      accentBar: '#4f46e5',
    },
  },

  'coppper': {
    id: 'coppper',
    label: 'Coppper',
    description: 'A premium digital magazine theme inspired by the warm elegance of copper.',
    dataTheme: 'coppper',
    wrapperClass: 'min-h-screen flex flex-col bg-background text-foreground',
    mainClass: 'max-w-7xl mx-auto flex-1 p-6',
    Header:   CoppperHeader,
    Footer:   CoppperFooter,
    HomePage: CoppperHomePage,
    adminPreview: {
      background: '#FAF8F5',
      primaryBar: '#B87333',
      secondaryBar: '#F3EEE8',
      accentBar: '#D49A6A',
    },
  },
};

export const DEFAULT_THEME_ID = 'classic';

export function getTheme(id?: string | null): ThemeConfig {
  return THEME_REGISTRY[id ?? DEFAULT_THEME_ID] ?? THEME_REGISTRY[DEFAULT_THEME_ID];
}

export function getAllThemes(): ThemeConfig[] {
  return Object.values(THEME_REGISTRY);
}
