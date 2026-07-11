// Shared prop types for theme components.
// Must NOT import from theme-registry.tsx (would create a circular dependency).

export interface ThemeHeaderProps {
  categories: Array<{ id: string; name: string; slug: string }>;
  siteTitle?: string;
  siteLogo?: string;
  navItems?: Array<{ label: string; url: string }>;
}

export interface ThemeFooterProps {
  categories: Array<{ id: string; name: string; slug: string }>;
  siteTitle: string;
  siteDescription?: string;
}

type PostShape = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  publishedAt?: string | null;
  isFeatured?: boolean;
  readingTime?: number;
  featuredMedia?: { url: string; altText?: string | null } | null;
  authors?: Array<{ displayName: string; slug: string }>;
  categories?: Array<{ name: string; slug: string }>;
};

export interface ThemeHomeProps {
  hero: PostShape | null;
  gridPosts: PostShape[];
  listPosts: PostShape[];
  issue: {
    id: string;
    title: string;
    volumeNumber: number;
    issueNumber: number;
    publishDate: string;
  } | null;
}
