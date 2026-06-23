// ─── Enums ───────────────────────────────────────────────────────────────────

export type Role = 'superadmin' | 'editor' | 'author' | 'subscriber_manager';

export type PostStatus = 'draft' | 'scheduled' | 'published';

export type IssueType = 'print' | 'blog' | 'combined';

export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced';

export type SubscriberChannel = 'email' | 'whatsapp' | 'both';

export type SubscriberSource = 'web_form' | 'import' | 'api';

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

// ─── Users ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  totpEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationPassword {
  id: string;
  userId: string;
  name: string;
  lastUsed: string | null;
  createdAt: string;
}

// ─── Content ─────────────────────────────────────────────────────────────────

export interface Author {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  email: string | null;
  postCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  postCount: number;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  postCount: number;
}

export interface Media {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string;
  altText: string | null;
  uploadedById: string;
  createdAt: string;
}

export interface Post {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: PostStatus;
  publishedAt: string | null;
  featuredMediaId: string | null;
  featuredMedia: Media | null;
  authors: Author[];
  categories: Category[];
  tags: Tag[];
  seoTitle: string | null;
  seoDescription: string | null;
  issueId: string | null;
  issueOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: PostStatus;
  publishedAt: string | null;
  featuredMediaId: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  volumeNumber: number;
  issueNumber: number;
  title: string;
  publishDate: string;
  type: IssueType;
  posts: Post[];
  createdAt: string;
  updatedAt: string;
}

export interface Revision {
  id: string;
  postId: string;
  content: string;
  title: string;
  createdById: string;
  createdAt: string;
}

// ─── Subscribers ─────────────────────────────────────────────────────────────

export interface Subscriber {
  id: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  status: SubscriberStatus;
  channels: SubscriberChannel;
  source: SubscriberSource;
  subscribedAt: string;
  unsubscribedAt: string | null;
}

export interface SubscriberList {
  id: string;
  name: string;
  description: string | null;
  subscriberCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export interface Campaign {
  id: string;
  name: string;
  issueId: string;
  issue: Issue | null;
  subscriberListId: string;
  subscriberList: SubscriberList | null;
  status: CampaignStatus;
  scheduledAt: string | null;
  sentAt: string | null;
  sentCount: number;
  openCount: number;
  clickCount: number;
  unsubscribeCount: number;
  createdAt: string;
  updatedAt: string;
}

// ─── API Response helpers ─────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
}

// ─── Bulk Ingestion ───────────────────────────────────────────────────────────

export interface IngestArticlePreview {
  number: number;
  title: string;
  authorName: string;
  excerpt: string;
  wordCount: number;
}

export interface IngestPreviewResult {
  articles: IngestArticlePreview[];
  totalArticles: number;
  warnings: string[];
}
