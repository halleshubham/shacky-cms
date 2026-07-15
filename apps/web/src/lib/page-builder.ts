import { nanoid } from 'nanoid';

// Which builder surface(s) a block type can be used on. Shared types (e.g. issue_articles,
// rich_text) are usable on both; some fields on a shared type only do something on one surface
// (see SECTION_META / per-block config forms for which fields are shown where).
export type Surface = 'homepage' | 'email';

export type SectionType =
  | 'hero'
  | 'post_grid'
  | 'latest_issue'
  | 'issue_articles'
  | 'issue_header'
  | 'category_row'
  | 'download_banner'
  | 'html_embed'
  | 'divider'
  | 'spacer'
  | 'image_block'
  | 'rich_text'
  | 'heading_block'
  | 'button_row'
  | 'file_downloads'
  | 'image_gallery'
  | 'columns_block';

export interface HeroConfig {
  source: 'latest' | 'latest_issue' | 'category';
  categorySlug?: string;
  layout: 'single' | 'split';
  showExcerpt: boolean;
  heroCount: number;
  sidebarCount: number;
}

export interface PostGridConfig {
  title?: string;
  source: 'latest' | 'featured' | 'category' | 'tag';
  slug?: string;
  count: number;
  columns: 2 | 3 | 4;
  size: 'default' | 'compact';
}

export interface LatestIssueConfig {
  showPosts: boolean;
  postCount: number;
}

export interface IssueArticlesConfig {
  // homepage-only: which issue to pull from ('specific' + issueId, or the latest issue)
  source: 'latest_issue' | 'specific';
  issueId?: string;
  // shown on both surfaces
  coverCount: number;
  // homepage-only: grid column count (email is always rendered as a fixed 2-column table)
  columns: 2 | 3 | 4;
  // email-only: homepage reuses <ArticleCard>, which has no per-field image/excerpt toggle
  showImages: boolean;
  showExcerpt: boolean;
  excerptLength: number;
}

export interface IssueHeaderConfig {
  showLogo: boolean;
  showTagline: boolean;
  showIssueMeta: boolean;
  showEditors: boolean;
}

export interface CategoryRowConfig {
  categorySlug: string;
  label?: string;
  count: number;
  layout: 'row' | 'featured';
}

export interface DownloadBannerConfig {
  title: string;
  description?: string;
  buttonLabel: string;
  buttonUrl: string;
}

export interface HtmlEmbedConfig {
  label?: string;
  code: string;
}

export interface DividerConfig {
  label?: string;
}

export interface SpacerConfig {
  height: number;
}

export interface ImageBlockConfig {
  src: string;
  alt?: string;
  caption?: string;
  linkUrl?: string;
  linkNewTab?: boolean;
  align: 'left' | 'center' | 'right' | 'full';
  maxWidth?: string;
}

export interface RichTextConfig {
  html: string;
}

export interface HeadingBlockConfig {
  text: string;
  subtext?: string;
  level: 1 | 2 | 3;
  align: 'left' | 'center' | 'right';
  linkUrl?: string;
  linkNewTab?: boolean;
}

export interface ButtonDef {
  label: string;
  url: string;
  variant: 'primary' | 'outline' | 'ghost';
  newTab?: boolean;
}

export interface ButtonRowConfig {
  buttons: ButtonDef[];
  align: 'left' | 'center' | 'right';
}

export type FileType = 'pdf' | 'docx' | 'ppt' | 'mp4' | 'other';
export type FileLang = 'mr' | 'hi' | 'en' | '';

export interface FileItem {
  label: string;
  url: string;
  lang?: FileLang;
  fileType?: FileType;
}

export interface FileDownloadsConfig {
  title?: string;
  description?: string;
  files: FileItem[];
  layout: 'list' | 'grid';
}

export interface GalleryImage {
  src: string;
  alt?: string;
  caption?: string;
  linkUrl?: string;
  linkNewTab?: boolean;
}

export interface ImageGalleryConfig {
  title?: string;
  images: GalleryImage[];
  columns: 2 | 3 | 4;
  showCaptions: boolean;
}

export type ColumnContentType = 'card' | Exclude<SectionType, 'columns_block'>;

export interface ColumnItem {
  // 'card' is the default flat layout; any other SectionType nests a full block
  contentType?: ColumnContentType;
  nestedConfig?: SectionConfig;

  // Card layout fields (used when contentType is 'card' or absent)
  title?: string;
  text?: string;
  imageSrc?: string;
  imageAlt?: string;
  imageLink?: string;
  imageLinkNewTab?: boolean;
  imageDownload?: boolean;
  buttonLabel?: string;
  buttonUrl?: string;
  buttonVariant?: 'primary' | 'outline' | 'ghost';
  buttonNewTab?: boolean;
}

export interface ColumnsBlockConfig {
  columns: ColumnItem[];
  columnsPerRow: 1 | 2 | 3 | 4;
  textAlign: 'left' | 'center' | 'right';
}

export type SectionConfig =
  | HeroConfig
  | PostGridConfig
  | LatestIssueConfig
  | IssueArticlesConfig
  | IssueHeaderConfig
  | CategoryRowConfig
  | DownloadBannerConfig
  | HtmlEmbedConfig
  | DividerConfig
  | SpacerConfig
  | ImageBlockConfig
  | RichTextConfig
  | HeadingBlockConfig
  | ButtonRowConfig
  | FileDownloadsConfig
  | ImageGalleryConfig
  | ColumnsBlockConfig;

export interface Section {
  id: string;
  type: SectionType;
  config: SectionConfig;
}

export interface SectionMeta {
  label: string;
  description: string;
  color: string;
  surfaces: Surface[];
}

export const SECTION_META: Record<SectionType, SectionMeta> = {
  columns_block:   { label: 'Columns',         description: 'Multi-column layout with title, text, image & button', color: 'bg-lime-100 text-lime-700 border-lime-200', surfaces: ['homepage'] },
  file_downloads:  { label: 'Downloads',      description: 'Downloadable files (PDF, DOCX, PPT…)', color: 'bg-orange-100 text-orange-700 border-orange-200', surfaces: ['homepage'] },
  image_gallery:   { label: 'Gallery',         description: 'Image grid with optional links',        color: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200', surfaces: ['homepage'] },
  hero:            { label: 'Hero',            description: 'Large featured article with image',   color: 'bg-violet-100 text-violet-700 border-violet-200', surfaces: ['homepage'] },
  post_grid:       { label: 'Post Grid',       description: 'Grid of article cards',               color: 'bg-blue-100 text-blue-700 border-blue-200', surfaces: ['homepage'] },
  latest_issue:    { label: 'Latest Issue',    description: 'Banner with latest issue info',       color: 'bg-emerald-100 text-emerald-700 border-emerald-200', surfaces: ['homepage'] },
  issue_articles:  { label: 'Issue Articles',  description: 'All articles in an issue — image + summary', color: 'bg-blue-100 text-blue-700 border-blue-200', surfaces: ['homepage', 'email'] },
  issue_header:    { label: 'Masthead',        description: 'Site name, tagline, volume/issue, editors bar', color: 'bg-violet-100 text-violet-700 border-violet-200', surfaces: ['email'] },
  category_row:    { label: 'Category Row',    description: 'Category label + article row',        color: 'bg-amber-100 text-amber-700 border-amber-200', surfaces: ['homepage'] },
  download_banner: { label: 'Download Banner', description: 'Call-to-action with button',          color: 'bg-pink-100 text-pink-700 border-pink-200', surfaces: ['homepage'] },
  html_embed:      { label: 'HTML Embed',      description: 'Custom HTML / widget code',           color: 'bg-slate-100 text-slate-700 border-slate-200', surfaces: ['homepage'] },
  divider:         { label: 'Divider',         description: 'Visual section separator',            color: 'bg-gray-100 text-gray-600 border-gray-200', surfaces: ['homepage', 'email'] },
  spacer:          { label: 'Spacer',          description: 'Blank vertical space',                 color: 'bg-slate-100 text-slate-700 border-slate-200', surfaces: ['homepage', 'email'] },
  image_block:     { label: 'Image',           description: 'Image with optional link & caption',  color: 'bg-cyan-100 text-cyan-700 border-cyan-200', surfaces: ['homepage', 'email'] },
  rich_text:       { label: 'Rich Text',       description: 'Formatted text with links',           color: 'bg-indigo-100 text-indigo-700 border-indigo-200', surfaces: ['homepage', 'email'] },
  heading_block:   { label: 'Heading',         description: 'Title + subtitle with optional link', color: 'bg-rose-100 text-rose-700 border-rose-200', surfaces: ['homepage', 'email'] },
  button_row:      { label: 'Buttons',         description: 'Row of CTA buttons with links',       color: 'bg-teal-100 text-teal-700 border-teal-200', surfaces: ['homepage', 'email'] },
};

export function defaultConfig(type: SectionType): SectionConfig {
  switch (type) {
    case 'hero':            return { source: 'latest_issue', layout: 'split', showExcerpt: true, heroCount: 1, sidebarCount: 3 } as HeroConfig;
    case 'post_grid':       return { title: 'Recent Articles', source: 'latest', count: 8, columns: 4, size: 'default' } as PostGridConfig;
    case 'latest_issue':    return { showPosts: true, postCount: 4 } as LatestIssueConfig;
    case 'issue_articles':  return { source: 'latest_issue', coverCount: 1, columns: 4, showImages: true, showExcerpt: true, excerptLength: 150 } as IssueArticlesConfig;
    case 'issue_header':    return { showLogo: true, showTagline: true, showIssueMeta: true, showEditors: true } as IssueHeaderConfig;
    case 'category_row':    return { categorySlug: '', label: '', count: 4, layout: 'row' } as CategoryRowConfig;
    case 'download_banner': return { title: "Download This Week's Issue", description: '', buttonLabel: 'Download PDF', buttonUrl: '/issues' } as DownloadBannerConfig;
    case 'html_embed':      return { label: 'Custom Widget', code: '' } as HtmlEmbedConfig;
    case 'divider':         return { label: '' } as DividerConfig;
    case 'spacer':          return { height: 24 } as SpacerConfig;
    case 'image_block':     return { src: '', alt: '', caption: '', linkUrl: '', linkNewTab: false, align: 'center', maxWidth: '100%' } as ImageBlockConfig;
    case 'rich_text':       return { html: '<p>Enter your text here…</p>' } as RichTextConfig;
    case 'heading_block':   return { text: 'Section Heading', subtext: '', level: 2, align: 'left', linkUrl: '', linkNewTab: false } as HeadingBlockConfig;
    case 'button_row':      return { buttons: [{ label: 'Learn More', url: '/', variant: 'primary', newTab: false }], align: 'left' } as ButtonRowConfig;
    case 'file_downloads':  return { title: 'Downloads', description: '', files: [], layout: 'list' } as FileDownloadsConfig;
    case 'image_gallery':   return { title: '', images: [], columns: 3, showCaptions: true } as ImageGalleryConfig;
    case 'columns_block':   return { columns: [{ title: 'Column 1', text: '', imageSrc: '', buttonLabel: '', buttonUrl: '', buttonVariant: 'primary', buttonNewTab: false }, { title: 'Column 2', text: '', imageSrc: '', buttonLabel: '', buttonUrl: '', buttonVariant: 'primary', buttonNewTab: false }], columnsPerRow: 2, textAlign: 'left' } as ColumnsBlockConfig;
  }
}

export function createSection(type: SectionType): Section {
  return { id: nanoid(8), type, config: defaultConfig(type) };
}
