import sanitizeHtml from 'sanitize-html';

// Matches exactly the HTML the TipTap editor can actually produce (see the
// @tiptap/extension-* list in apps/web/package.json: blockquote, bold,
// bullet-list, code-block, document, heading, horizontal-rule, image,
// italic, link, list-item, ordered-list, paragraph, strike, table*, text,
// underline — no custom marks beyond these). Content reaches post/page
// storage from three places that are NOT all admin-controlled — the TipTap
// editor (any content-role user), AI-generated content inserted into the
// editor, and WordPress import — and is rendered back on the public site
// via dangerouslySetInnerHTML with no client-side sanitization, so this is
// the one point that has to hold the line against stored XSS.
const ALLOWED_TAGS = [
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'blockquote', 'ul', 'ol', 'li', 'pre', 'code',
  'img', 'a', 'hr', 'br',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions['allowedAttributes'] = {
  a: ['href', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height'],
  th: ['colspan', 'rowspan'],
  td: ['colspan', 'rowspan'],
};

export function sanitizePostContent(html: string): string {
  if (!html) return html;
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
  });
}
