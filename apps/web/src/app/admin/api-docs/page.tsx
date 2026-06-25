'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Auth = 'none' | 'any' | 'admin' | 'superadmin' | 'subscriber_manager+';

interface Endpoint {
  method: Method;
  path: string;
  auth: Auth;
  desc: string;
  params?: string[];
  body?: string[];
  notes?: string;
}

interface Group {
  title: string;
  prefix: string;
  endpoints: Endpoint[];
}

const METHOD_STYLE: Record<Method, string> = {
  GET:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  POST:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  PATCH:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  PUT:    'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const AUTH_STYLE: Record<Auth, string> = {
  none:                  'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  any:                   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  admin:                 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  superadmin:            'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  'subscriber_manager+': 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
};

const AUTH_LABEL: Record<Auth, string> = {
  none:                  'Public',
  any:                   'Auth',
  admin:                 'Admin',
  superadmin:            'Superadmin',
  'subscriber_manager+': 'Sub. Manager+',
};

const GROUPS: Group[] = [
  {
    title: 'Authentication',
    prefix: '/api/auth',
    endpoints: [
      { method: 'POST', path: '/login', auth: 'none', desc: 'Log in with email + password. Returns JWT in cookie and body. Returns { requireTotp: true } if 2FA is enabled.', body: ['email', 'password', 'totpCode?'] },
      { method: 'POST', path: '/refresh', auth: 'none', desc: 'Rotate access token using the refresh token cookie.' },
      { method: 'POST', path: '/logout', auth: 'any', desc: 'Clear access and refresh token cookies.' },
      { method: 'POST', path: '/register', auth: 'superadmin', desc: 'Create a new CMS user. Sends a welcome email with credentials.', body: ['email', 'password (min 12)', 'name', 'role?'] },
      { method: 'GET',  path: '/me', auth: 'any', desc: 'Return the currently authenticated user.' },
      { method: 'PATCH', path: '/me', auth: 'any', desc: 'Update own name or password.', body: ['name?', 'currentPassword?', 'newPassword?'] },
      { method: 'POST', path: '/totp/setup', auth: 'any', desc: 'Generate a TOTP secret and QR code for 2FA setup.' },
      { method: 'POST', path: '/totp/verify', auth: 'any', desc: 'Confirm TOTP code to enable 2FA.', body: ['code'] },
      { method: 'POST', path: '/totp/disable', auth: 'superadmin', desc: 'Disable 2FA for any user.', body: ['userId'] },
      { method: 'GET',  path: '/application-passwords', auth: 'any', desc: 'List own application passwords (tokens for headless API access).' },
      { method: 'POST', path: '/application-passwords', auth: 'any', desc: 'Generate a new application password. The raw token is returned once only.', body: ['name'] },
      { method: 'DELETE', path: '/application-passwords/:id', auth: 'any', desc: 'Revoke an application password.' },
    ],
  },
  {
    title: 'Posts',
    prefix: '/api/posts',
    endpoints: [
      { method: 'GET',  path: '/', auth: 'any', desc: 'List posts. Authors only see their own posts.', params: ['page', 'pageSize (max 100)', 'status', 'isFeatured', 'authorId', 'categoryId', 'issueId', 'unassigned', 'search'] },
      { method: 'GET',  path: '/analytics', auth: 'any', desc: 'Per-status counts and top posts by view count.', params: ['limit (default 10)'] },
      { method: 'GET',  path: '/:id', auth: 'any', desc: 'Single post with authors, categories, tags, media, issue.' },
      { method: 'POST', path: '/', auth: 'any', desc: 'Create a post. Slug is auto-generated from title if omitted.', body: ['title', 'content?', 'slug?', 'status?', 'isFeatured?', 'publishedAt?', 'featuredMediaId?', 'authorIds?', 'categoryIds? (max 3)', 'tagIds?', 'seoTitle?', 'seoDescription?', 'issueId?', 'issueOrder?', 'codeInjectionHead?', 'codeInjectionFoot?'] },
      { method: 'PATCH', path: '/:id', auth: 'any', desc: 'Update a post. Saves a revision before applying changes. Authors can only edit their own posts.' },
      { method: 'DELETE', path: '/:id', auth: 'admin', desc: 'Delete a post permanently. Fires post.deleted webhook.' },
      { method: 'POST', path: '/:id/duplicate', auth: 'any', desc: 'Clone a post as draft with a -copy slug suffix.' },
      { method: 'POST', path: '/bulk-action', auth: 'admin', desc: 'Bulk operation on up to 100 posts.', body: ['action: publish | unpublish | delete | feature | unfeature', 'postIds[]'] },
      { method: 'POST', path: '/:id/view', auth: 'none', desc: 'Increment view count (published posts only). Call from frontend on article load.' },
      { method: 'GET',  path: '/:id/revisions', auth: 'any', desc: 'List all saved revisions for a post.' },
      { method: 'POST', path: '/:id/restore/:revisionId', auth: 'any', desc: 'Restore a revision; current content is saved as a new revision first.' },
    ],
  },
  {
    title: 'Pages',
    prefix: '/api/pages',
    endpoints: [
      { method: 'GET',  path: '/', auth: 'any', desc: 'List all static pages.' },
      { method: 'GET',  path: '/:id', auth: 'any', desc: 'Single page.' },
      { method: 'POST', path: '/', auth: 'admin', desc: 'Create a page.', body: ['title', 'content?', 'slug?', 'status?', 'publishedAt?', 'featuredMediaId?', 'seoTitle?', 'seoDescription?'] },
      { method: 'PATCH', path: '/:id', auth: 'admin', desc: 'Update a page.' },
      { method: 'DELETE', path: '/:id', auth: 'admin', desc: 'Delete a page.' },
    ],
  },
  {
    title: 'Issues',
    prefix: '/api/issues',
    endpoints: [
      { method: 'GET',  path: '/', auth: 'any', desc: 'Paginated issue list ordered by volume/issue desc.', params: ['page', 'pageSize'] },
      { method: 'GET',  path: '/:id', auth: 'any', desc: 'Single issue with all its posts ordered by issueOrder.' },
      { method: 'POST', path: '/', auth: 'admin', desc: 'Create an issue.', body: ['volumeNumber', 'issueNumber', 'title', 'publishDate (ISO)', 'type: print | blog | combined'] },
      { method: 'PATCH', path: '/:id', auth: 'admin', desc: 'Update an issue.' },
      { method: 'DELETE', path: '/:id', auth: 'admin', desc: 'Delete an issue (posts are kept but detached).' },
      { method: 'POST', path: '/:id/bulk-publish', auth: 'admin', desc: 'Set all posts in an issue to published or draft.', body: ['status: published | draft'] },
      { method: 'POST', path: '/:id/auto-attach', auth: 'admin', desc: 'Find unattached posts published on the same UTC day as the issue and attach them in order.' },
      { method: 'POST', path: '/:id/attach-posts', auth: 'admin', desc: 'Manually attach specific posts.', body: ['postIds[]'] },
      { method: 'PUT',  path: '/:id/article-order', auth: 'admin', desc: 'Reorder posts within an issue.', body: ['order[]: { postId, order }'] },
    ],
  },
  {
    title: 'Authors',
    prefix: '/api/authors',
    endpoints: [
      { method: 'GET',  path: '/', auth: 'any', desc: 'List all authors with post count.', params: ['search?'] },
      { method: 'GET',  path: '/:id', auth: 'any', desc: 'Single author.' },
      { method: 'POST', path: '/', auth: 'admin', desc: 'Create an author.', body: ['displayName', 'slug?', 'bio?', 'avatarUrl?', 'email?'] },
      { method: 'PATCH', path: '/:id', auth: 'admin', desc: 'Update an author.' },
      { method: 'DELETE', path: '/:id', auth: 'admin', desc: 'Delete an author.' },
      { method: 'POST', path: '/:id/merge/:targetId', auth: 'admin', desc: 'Reassign all posts from source author to target, then delete source.' },
    ],
  },
  {
    title: 'Categories',
    prefix: '/api/categories',
    endpoints: [
      { method: 'GET',  path: '/', auth: 'any', desc: 'All categories with post count and children.' },
      { method: 'GET',  path: '/:id', auth: 'any', desc: 'Single category with parent and children.' },
      { method: 'POST', path: '/', auth: 'admin', desc: 'Create a category.', body: ['name', 'slug?', 'description?', 'parentId?'] },
      { method: 'PATCH', path: '/:id', auth: 'admin', desc: 'Update a category.' },
      { method: 'DELETE', path: '/:id', auth: 'admin', desc: 'Delete a category.' },
    ],
  },
  {
    title: 'Tags',
    prefix: '/api/tags',
    endpoints: [
      { method: 'GET',  path: '/', auth: 'any', desc: 'All tags with post count.', params: ['search?'] },
      { method: 'POST', path: '/', auth: 'admin', desc: 'Create a tag (returns existing if slug matches).', body: ['name', 'slug?', 'description?'] },
      { method: 'PATCH', path: '/:id', auth: 'admin', desc: 'Update a tag.' },
      { method: 'DELETE', path: '/:id', auth: 'admin', desc: 'Delete a tag.' },
    ],
  },
  {
    title: 'Media',
    prefix: '/api/media',
    endpoints: [
      { method: 'GET',  path: '/', auth: 'any', desc: 'List media files.', params: ['page', 'pageSize (default 40)', 'search?', 'mimeType? (prefix, e.g. image/)'] },
      { method: 'GET',  path: '/:id', auth: 'any', desc: 'Single media record.' },
      { method: 'POST', path: '/upload', auth: 'any', desc: 'Upload a file (multipart/form-data). Images are auto-converted to JPEG ≤1920px, thumbnails generated at 150/300/1024px.', notes: 'Field name: file' },
      { method: 'PATCH', path: '/:id', auth: 'any', desc: 'Update alt text.', body: ['altText?'] },
      { method: 'PUT',  path: '/:id/replace', auth: 'admin', desc: 'Swap the file behind a media ID (deletes old file from S3).', notes: 'Multipart upload, field name: file' },
      { method: 'DELETE', path: '/:id', auth: 'admin', desc: 'Delete media. Returns 409 if in use unless ?force=true.', params: ['force?=true'] },
    ],
  },
  {
    title: 'Subscribers',
    prefix: '/api/subscribers',
    endpoints: [
      { method: 'GET',  path: '/', auth: 'subscriber_manager+', desc: 'List subscribers.', params: ['page', 'pageSize (default 50)', 'status?', 'listId?'] },
      { method: 'POST', path: '/subscribe', auth: 'none', desc: 'Public subscribe endpoint.', body: ['email? | phone?', 'name?', 'channels: email | whatsapp | both', 'listId?'] },
      { method: 'GET',  path: '/unsubscribe/:token', auth: 'none', desc: 'One-click unsubscribe via token from emails.' },
      { method: 'DELETE', path: '/:id', auth: 'subscriber_manager+', desc: 'Delete a subscriber.' },
      { method: 'GET',  path: '/lists', auth: 'subscriber_manager+', desc: 'All subscriber lists with member count.' },
      { method: 'POST', path: '/lists', auth: 'subscriber_manager+', desc: 'Create a subscriber list.', body: ['name', 'description?'] },
      { method: 'PATCH', path: '/lists/:id', auth: 'subscriber_manager+', desc: 'Update a list.' },
      { method: 'DELETE', path: '/lists/:id', auth: 'subscriber_manager+', desc: 'Delete a list.' },
      { method: 'POST', path: '/lists/:id/members', auth: 'subscriber_manager+', desc: 'Add subscribers to a list.', body: ['subscriberIds[]'] },
      { method: 'POST', path: '/import', auth: 'subscriber_manager+', desc: 'Import subscribers from CSV (email, phone, name, channels columns). Upserts on email/phone.', notes: 'Multipart upload, field name: file' },
    ],
  },
  {
    title: 'Campaigns',
    prefix: '/api/campaigns',
    endpoints: [
      { method: 'GET',  path: '/', auth: 'subscriber_manager+', desc: 'List campaigns.', params: ['page', 'pageSize'] },
      { method: 'GET',  path: '/:id', auth: 'subscriber_manager+', desc: 'Single campaign.' },
      { method: 'POST', path: '/', auth: 'subscriber_manager+', desc: 'Create a campaign.', body: ['name', 'issueId', 'subscriberListId', 'scheduledAt? (ISO)'] },
      { method: 'PATCH', path: '/:id', auth: 'subscriber_manager+', desc: 'Update a campaign (cannot edit after sent).' },
      { method: 'POST', path: '/:id/test-send', auth: 'subscriber_manager+', desc: 'Send a test email to a single address.', body: ['email'] },
      { method: 'GET',  path: '/:id/newsletter', auth: 'subscriber_manager+', desc: 'Get generated newsletter HTML (cached on campaign record).' },
      { method: 'GET',  path: '/:id/preview', auth: 'subscriber_manager+', desc: 'Preview newsletter as rendered HTML page (Content-Type: text/html).' },
      { method: 'GET',  path: '/:id/whatsapp', auth: 'subscriber_manager+', desc: 'Get WhatsApp digest parts and per-channel article messages.' },
      { method: 'POST', path: '/:id/send', auth: 'subscriber_manager+', desc: 'Send campaign to all active email subscribers on the list.' },
      { method: 'POST', path: '/:id/botsab-send', auth: 'subscriber_manager+', desc: 'Send WhatsApp messages to Botsab groups.', body: ['groupJids[]', 'mode: digest | channel', 'channelId? (required when mode=channel)'] },
      { method: 'DELETE', path: '/:id', auth: 'subscriber_manager+', desc: 'Delete a campaign.' },
    ],
  },
  {
    title: 'Ingest (ZIP → Posts)',
    prefix: '/api/ingest',
    endpoints: [
      { method: 'GET',  path: '/ai-status', auth: 'any', desc: 'Check whether AI is configured and whether image generation is available.' },
      { method: 'POST', path: '/preview', auth: 'admin', desc: 'Upload a ZIP of DOCX articles and get a preview list without creating anything.', notes: 'Multipart, field: file (.zip)' },
      { method: 'POST', path: '/', auth: 'admin', desc: 'Ingest a ZIP into an existing issue. Creates posts synchronously; AI enhancements are queued async.', notes: 'Multipart fields: file (.zip), issueId, publishHour?, aiOptions? (JSON)' },
      { method: 'GET',  path: '/jobs/:jobId', auth: 'any', desc: 'Poll the status of a BullMQ AI-enhancement job returned by the ingest endpoint.' },
    ],
  },
  {
    title: 'AI',
    prefix: '/api/ai',
    endpoints: [
      { method: 'GET',  path: '/config', auth: 'admin', desc: 'Get current AI config with masked API key.' },
      { method: 'POST', path: '/config', auth: 'admin', desc: 'Save AI config.', body: ['provider: openai | gemini | ollama | groq', 'apiKey?', 'apiUrl? (Ollama)', 'textModel?', 'imageModel?'] },
      { method: 'DELETE', path: '/config', auth: 'admin', desc: 'Remove AI config from settings.' },
      { method: 'GET',  path: '/models', auth: 'any', desc: 'Available model lists per provider. Dynamically queries Ollama.', params: ['ollamaUrl? (default http://localhost:11434)'] },
      { method: 'POST', path: '/generate-content', auth: 'any', desc: 'Generate article HTML + excerpt + SEO fields.', body: ['title', 'brief?', 'tone?: neutral | formal | casual | journalistic', 'wordCount? (100–5000)', 'existingContent?', 'instruction?'] },
      { method: 'POST', path: '/generate-excerpt', auth: 'any', desc: 'Generate a short excerpt from existing content.', body: ['title', 'content'] },
      { method: 'POST', path: '/suggest-seo', auth: 'any', desc: 'Suggest SEO title and description.', body: ['title', 'content'] },
      { method: 'POST', path: '/build-image-prompt', auth: 'any', desc: 'Build an image generation prompt from article title/excerpt.', body: ['title', 'excerpt?'] },
      { method: 'POST', path: '/generate-image', auth: 'any', desc: 'Generate a featured image via DALL-E/Imagen, upload to S3, and create a media record.', body: ['prompt', 'style?: photorealistic | illustrated | abstract | documentary'] },
    ],
  },
  {
    title: 'Stock Photos',
    prefix: '/api/stock',
    endpoints: [
      { method: 'GET',  path: '/search', auth: 'any', desc: 'Search or browse stock photos. Omit q to get popular/curated images.', params: ['q?', 'source: unsplash | pexels | pixabay | wikimedia | all (default)', 'page'] },
      { method: 'POST', path: '/use', auth: 'any', desc: 'Download a stock photo, process it (JPEG ≤1920px), upload to S3, create a media record.', body: ['downloadUrl', 'fullUrl', 'alt?', 'credit?', 'creditUrl?', 'source?'] },
      { method: 'GET',  path: '/keys', auth: 'any', desc: 'Check which stock sources are configured (no keys returned).' },
    ],
  },
  {
    title: 'Statistics',
    prefix: '/api/stats',
    endpoints: [
      { method: 'GET', path: '/', auth: 'any', desc: 'Dashboard stats: post counts by status, issue count, subscriber totals, campaign counts, recent posts/issues, top posts by views.' },
    ],
  },
  {
    title: 'Settings',
    prefix: '/api/settings',
    endpoints: [
      { method: 'GET',  path: '/public', auth: 'none', desc: 'Public site settings (title, description, logo, nav). Used by the frontend.' },
      { method: 'GET',  path: '/', auth: 'admin', desc: 'All settings as a key → value object.' },
      { method: 'PATCH', path: '/', auth: 'admin', desc: 'Upsert one or more settings.', body: ['{ [key]: value }'] },
      { method: 'DELETE', path: '/:key', auth: 'admin', desc: 'Remove a setting.' },
      { method: 'GET',  path: '/counts', auth: 'admin', desc: 'Row counts for every purgeable entity (posts, issues, categories, etc.).' },
    ],
  },
  {
    title: 'Webhooks',
    prefix: '/api/webhooks',
    endpoints: [
      { method: 'GET',  path: '/events', auth: 'any', desc: 'List of all supported event names.' },
      { method: 'GET',  path: '/', auth: 'admin', desc: 'List configured webhooks (secret is masked).' },
      { method: 'POST', path: '/', auth: 'admin', desc: 'Register a webhook.', body: ['name', 'event', 'targetUrl', 'secret?', 'isActive?'] },
      { method: 'PATCH', path: '/:id', auth: 'admin', desc: 'Update a webhook.' },
      { method: 'DELETE', path: '/:id', auth: 'admin', desc: 'Delete a webhook.' },
    ],
  },
  {
    title: 'Users',
    prefix: '/api/users',
    endpoints: [
      { method: 'GET',  path: '/', auth: 'superadmin', desc: 'List all CMS users.' },
      { method: 'PATCH', path: '/:id', auth: 'superadmin', desc: 'Update name, role, or password. Sends notification email when password is reset.', body: ['name?', 'role?', 'password? (min 12)'] },
      { method: 'DELETE', path: '/:id', auth: 'superadmin', desc: 'Delete a user (cannot delete yourself).' },
      { method: 'GET',  path: '/audit-log', auth: 'superadmin', desc: 'Paginated audit log.', params: ['page', 'pageSize (default 50)'] },
    ],
  },
  {
    title: 'WordPress Migration',
    prefix: '/api/migration',
    endpoints: [
      { method: 'POST', path: '/wordpress/test', auth: 'admin', desc: 'Verify WP credentials and return content counts.', body: ['baseUrl', 'username', 'appPassword'] },
      { method: 'POST', path: '/wordpress/start', auth: 'admin', desc: 'Start a background migration job. Returns jobId.', body: ['baseUrl', 'username', 'appPassword', 'options: { importCategories, importTags, importAuthors, importPosts, postStatus, skipExisting, dateFrom?, dateTo?, groupByDate, firstVolumeNumber?, firstIssueNumber?, issuesPerVolume }'] },
      { method: 'GET',  path: '/wordpress/status/:jobId', auth: 'any', desc: 'Poll migration job progress.' },
      { method: 'DELETE', path: '/wordpress/job/:jobId', auth: 'admin', desc: 'Cancel a running migration job.' },
    ],
  },
  {
    title: 'Integrations',
    prefix: '/api/integrations',
    endpoints: [
      { method: 'GET', path: '/botsab/groups', auth: 'superadmin', desc: 'List WhatsApp groups from the configured Botsab instance.' },
    ],
  },
  {
    title: 'Public (No Auth)',
    prefix: '/api/public',
    endpoints: [
      { method: 'GET', path: '/posts', auth: 'none', desc: 'Published posts with filters.', params: ['page', 'pageSize (max 50)', 'search?', 'categorySlug?', 'tagSlug?', 'authorSlug?', 'issueId?'] },
      { method: 'GET', path: '/posts/:slug', auth: 'none', desc: 'Single published post by slug, with related posts from same category.' },
      { method: 'GET', path: '/issues', auth: 'none', desc: 'Paginated issue list with cover post.', params: ['page', 'pageSize'] },
      { method: 'GET', path: '/issues/latest', auth: 'none', desc: 'Most recent issue with all published posts.' },
      { method: 'GET', path: '/issues/:id', auth: 'none', desc: 'Single issue with published posts in order.' },
      { method: 'GET', path: '/categories', auth: 'none', desc: 'All root categories with published post counts and children.' },
      { method: 'GET', path: '/authors', auth: 'none', desc: 'All authors with published post count.' },
      { method: 'GET', path: '/authors/:slug', auth: 'none', desc: "Author profile and their published posts.", params: ['page', 'pageSize'] },
      { method: 'GET', path: '/tags', auth: 'none', desc: 'All tags with published post count.' },
      { method: 'GET', path: '/tags/:slug', auth: 'none', desc: 'Tag profile and published posts.', params: ['page', 'pageSize'] },
      { method: 'GET', path: '/featured', auth: 'none', desc: 'Featured published posts.', params: ['limit? (default 6)'] },
      { method: 'GET', path: '/search', auth: 'none', desc: 'Full-text search across title, excerpt, content, authors, categories, tags.', params: ['q (min 2 chars)', 'page', 'pageSize'] },
      { method: 'GET', path: '/settings', auth: 'none', desc: 'Public site settings (title, description, logo, nav).' },
    ],
  },
];

function MethodBadge({ method }: { method: Method }) {
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded text-xs font-bold font-mono w-16 text-center flex-shrink-0', METHOD_STYLE[method])}>
      {method}
    </span>
  );
}

function AuthBadge({ auth }: { auth: Auth }) {
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded text-[11px] font-medium flex-shrink-0', AUTH_STYLE[auth])}>
      {AUTH_LABEL[auth]}
    </span>
  );
}

function EndpointRow({ ep, prefix }: { ep: Endpoint; prefix: string }) {
  const [open, setOpen] = useState(false);
  const hasDetail = ep.params || ep.body || ep.notes;

  return (
    <div className="border-b border-border last:border-0">
      <button
        className={cn('w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors', open && 'bg-muted/40')}
        onClick={() => hasDetail && setOpen((o) => !o)}
      >
        <MethodBadge method={ep.method} />
        <code className="text-sm font-mono text-foreground/80 flex-shrink-0">
          {prefix}{ep.path}
        </code>
        <span className="text-sm text-muted-foreground flex-1 min-w-0 text-left">{ep.desc}</span>
        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <AuthBadge auth={ep.auth} />
          {hasDetail && (
            open
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      {open && hasDetail && (
        <div className="px-4 pb-3 pt-1 grid gap-2 bg-muted/20 text-sm">
          {ep.notes && (
            <p className="text-muted-foreground italic">{ep.notes}</p>
          )}
          {ep.params && (
            <div>
              <span className="font-semibold text-foreground/70 text-xs uppercase tracking-wide">Query params</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {ep.params.map((p) => (
                  <code key={p} className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground/80">{p}</code>
                ))}
              </div>
            </div>
          )}
          {ep.body && (
            <div>
              <span className="font-semibold text-foreground/70 text-xs uppercase tracking-wide">Request body</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {ep.body.map((b) => (
                  <code key={b} className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground/80">{b}</code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group }: { group: Group }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3 bg-muted/50 hover:bg-muted/80 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="font-semibold text-foreground">{group.title}</span>
          <code className="text-xs text-muted-foreground font-mono">{group.prefix}</code>
        </div>
        <span className="text-xs text-muted-foreground">{group.endpoints.length} endpoint{group.endpoints.length !== 1 ? 's' : ''}</span>
      </button>
      {open && (
        <div>
          {group.endpoints.map((ep) => (
            <EndpointRow key={`${ep.method}-${ep.path}`} ep={ep} prefix={group.prefix} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  const total = GROUPS.reduce((s, g) => s + g.endpoints.length, 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">API Reference</h1>
          <p className="text-muted-foreground mt-1">
            {total} endpoints across {GROUPS.length} resource groups. All requests to <code className="text-xs bg-muted px-1 rounded">/api/*</code> are proxied through Next.js — use relative paths from the browser.
          </p>
        </div>
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:bg-muted transition-colors flex-shrink-0"
        >
          <ExternalLink className="h-4 w-4" />
          Swagger UI
        </a>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm p-4 bg-muted/30 rounded-lg border border-border">
        <div className="font-medium text-muted-foreground text-xs uppercase tracking-wide self-center">Auth levels:</div>
        {(Object.entries(AUTH_LABEL) as [Auth, string][]).map(([k, v]) => (
          <span key={k} className={cn('px-2 py-0.5 rounded text-xs font-medium', AUTH_STYLE[k])}>{v}</span>
        ))}
        <span className="text-muted-foreground text-xs self-center">Admin = superadmin or editor &nbsp;|&nbsp; Sub. Manager+ = superadmin, editor, or subscriber_manager</span>
      </div>

      <div className="space-y-3">
        {GROUPS.map((g) => (
          <GroupCard key={g.prefix} group={g} />
        ))}
      </div>

      {/* Health check */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <MethodBadge method="GET" />
          <code className="text-sm font-mono text-foreground/80">/health</code>
          <span className="text-sm text-muted-foreground flex-1">Health check — returns <code className="text-xs">{'{ status: "ok", timestamp }'}</code>. No auth required.</span>
          <AuthBadge auth="none" />
        </div>
      </div>
    </div>
  );
}
