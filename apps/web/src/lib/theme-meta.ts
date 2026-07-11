export interface ThemeMeta {
  id: string;
  label: string;
  description: string;
  adminPreview: {
    background: string;
    border?: string;
    primaryBar: string;
    secondaryBar: string;
    accentBar: string;
  };
}

export const DEFAULT_THEME_ID = 'classic';

export const THEME_META: ThemeMeta[] = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Playfair Display serif typeface, cobalt blue accents, editorial magazine layout',
    adminPreview: {
      background: '#F0F4F8',
      primaryBar: '#0F172A',
      secondaryBar: '#94A3B8',
      accentBar: '#2563EB',
    },
  },
  {
    id: 'medusa',
    label: 'Medusa',
    description: 'Inter sans-serif, black & white palette, premium minimal SaaS aesthetic',
    adminPreview: {
      background: '#FFFFFF',
      border: '#E5E7EB',
      primaryBar: '#111111',
      secondaryBar: '#888888',
      accentBar: '#4f46e5',
    },
  },
  {
    id: 'coppper',
    label: 'Coppper',
    description: 'A premium digital magazine theme inspired by the warm elegance of copper.',
    adminPreview: {
      background: '#FAF8F5',
      primaryBar: '#B87333',
      secondaryBar: '#F3EEE8',
      accentBar: '#D49A6A',
    },
  },
];
