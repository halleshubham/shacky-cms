import { describe, it, expect, vi } from 'vitest';

vi.mock('../src/services/newsletter.js', () => ({
  generateNewsletterHtml: vi.fn(),
  getNewsletterSettings: vi.fn(),
}));
vi.mock('../src/services/email.js', () => ({ sendMail: vi.fn() }));
vi.mock('../src/services/stockSearch.js', () => ({
  searchAllStock: vi.fn(),
  downloadAndStoreStockImage: vi.fn(),
}));

import { createMcpServer } from '../src/services/mcpServer';

function registeredTools(role: any, scopes: string[]) {
  const server = createMcpServer({} as any, 'user1', role, scopes);
  return Object.keys((server as any)._registeredTools);
}

// Regression coverage for the real bug: MCP tools were gated only by the
// OAuth scope granted to a client, never by the approving user's actual CMS
// role — so any authenticated user (even subscriber_manager, the lowest-
// trust role) who self-registered an OAuth client and was granted
// posts:write/campaigns:write could create/publish posts, issues, pages,
// and send real campaign emails, none of which their CMS role permits via
// the REST API. Every tool must now require BOTH the scope AND the same
// role the equivalent REST route enforces.
describe('MCP tool registration — role must match the REST route it mirrors, not just scope', () => {
  const ALL_WRITE_SCOPES = ['posts:write', 'media:read', 'campaigns:write', 'campaigns:read', 'subscribers:read'];

  it('subscriber_manager with every write scope gets none of the content/admin tools (the original bug)', () => {
    const tools = registeredTools('subscriber_manager', ALL_WRITE_SCOPES);
    expect(tools).not.toContain('create_post');
    expect(tools).not.toContain('update_post');
    expect(tools).not.toContain('create_issue');
    expect(tools).not.toContain('publish_issue');
    expect(tools).not.toContain('create_category');
    expect(tools).not.toContain('create_tag');
    expect(tools).not.toContain('create_page');
    expect(tools).not.toContain('set_post_featured_image_from_stock');
  });

  it('author with posts:write gets content tools but NOT admin-only tools (matches requireContentRole vs requireAdmin)', () => {
    const tools = registeredTools('author', ALL_WRITE_SCOPES);
    expect(tools).toContain('create_post');
    expect(tools).toContain('update_post');
    // issues/pages/categories/tags creation is requireAdmin-gated on the REST
    // routes — author is deliberately excluded there too.
    expect(tools).not.toContain('create_issue');
    expect(tools).not.toContain('create_category');
    expect(tools).not.toContain('create_tag');
    expect(tools).not.toContain('create_page');
  });

  it('editor gets both content and admin-only tools', () => {
    const tools = registeredTools('editor', ALL_WRITE_SCOPES);
    expect(tools).toContain('create_post');
    expect(tools).toContain('create_issue');
    expect(tools).toContain('publish_issue');
    expect(tools).toContain('create_category');
    expect(tools).toContain('create_page');
  });

  it('author does NOT get campaign/subscriber tools even with those scopes (canManage excludes author)', () => {
    const tools = registeredTools('author', ALL_WRITE_SCOPES);
    expect(tools).not.toContain('create_campaign');
    expect(tools).not.toContain('send_campaign');
    expect(tools).not.toContain('list_campaigns');
    expect(tools).not.toContain('list_subscribers');
  });

  it('subscriber_manager DOES get campaign/subscriber tools (matches canManage on campaigns.ts/subscribers.ts)', () => {
    const tools = registeredTools('subscriber_manager', ALL_WRITE_SCOPES);
    expect(tools).toContain('create_campaign');
    expect(tools).toContain('send_campaign');
    expect(tools).toContain('list_campaigns');
    expect(tools).toContain('list_subscribers');
  });

  it('set_post_featured_image_from_stock needs both media:read AND posts:write AND a content role', () => {
    expect(registeredTools('author', ['media:read'])).not.toContain('set_post_featured_image_from_stock');
    expect(registeredTools('subscriber_manager', ['media:read', 'posts:write'])).not.toContain('set_post_featured_image_from_stock');
    expect(registeredTools('author', ['media:read', 'posts:write'])).toContain('set_post_featured_image_from_stock');
  });

  it('read-only tools stay available to any role once the scope is granted (matches GET routes needing only authenticate)', () => {
    for (const role of ['author', 'subscriber_manager', 'editor', 'superadmin']) {
      const tools = registeredTools(role, ['posts:read', 'media:read']);
      expect(tools).toContain('list_posts');
      expect(tools).toContain('get_post');
      expect(tools).toContain('list_media');
    }
  });
});
