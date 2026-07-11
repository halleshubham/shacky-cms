import { prisma } from '../plugins/prisma.js';
import { env } from '../utils/env.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WaGroup { label: string; url: string; }
export interface WaChannelLink { label: string; url: string; }
export interface WaChannel { id: string; name: string; links: WaChannelLink[]; }

export interface NewsletterSettings {
  siteName: string;
  siteLogo: string;
  tagline: string;
  editors: string[];
  about: string;
  facebookUrl: string;
  subscribeUrl: string;
  waGroups: WaGroup[];
  waChannels: WaChannel[];
}

export interface IssueWithPosts {
  id: string;
  title: string;
  volumeNumber: number;
  issueNumber: number;
  publishDate: Date;
  posts: Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    issueOrder: number | null;
    featuredMedia: { url: string; altText: string | null } | null;
    authors: Array<{ author: { displayName: string } }>;
  }>;
}

type Post = IssueWithPosts['posts'][0];

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getNewsletterSettings(): Promise<NewsletterSettings> {
  const rows = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          'site_title', 'site_logo',
          'newsletter_tagline', 'newsletter_editors', 'newsletter_about',
          'newsletter_facebook', 'newsletter_subscribe_url',
          'newsletter_wa_groups', 'newsletter_wa_channels',
        ],
      },
    },
  });
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;

  const parseJson = <T>(key: string, fallback: T): T => {
    try { return JSON.parse(m[key] || ''); } catch { return fallback; }
  };

  return {
    siteName: m['site_title'] || 'Shacky CMS',
    siteLogo: m['site_logo'] || '',
    tagline: m['newsletter_tagline'] || '',
    editors: (m['newsletter_editors'] || '').split('\n').map((s) => s.trim()).filter(Boolean),
    about: m['newsletter_about'] || '',
    facebookUrl: m['newsletter_facebook'] || '',
    subscribeUrl: m['newsletter_subscribe_url'] || `${env.APP_URL}/subscribe`,
    waGroups: parseJson<WaGroup[]>('newsletter_wa_groups', []),
    waChannels: parseJson<WaChannel[]>('newsletter_wa_channels', []),
  };
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function trunc(s: string | null | undefined, len: number): string {
  if (!s) return '';
  return s.length > len ? s.slice(0, len).trimEnd() + '…' : s;
}

function fmtDateLong(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

function fmtDateShort(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

function bylines(post: Post): string {
  return post.authors.map((a) => a.author?.displayName).filter(Boolean).join(', ');
}

// ─── Article card (used in 2-column grid) ────────────────────────────────────

function articleCard(post: Post, appUrl: string): string {
  const authors = bylines(post);
  const excerpt = trunc(post.excerpt, 110);
  const url = `${appUrl}/articles/${post.slug}`;
  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  ${post.featuredMedia ? `<tr><td style="padding-bottom:10px">
    <a href="${url}" style="display:block"><img src="${esc(post.featuredMedia.url)}" alt="${esc(post.title)}" width="256" style="display:block;width:100%;height:144px;object-fit:cover;border-radius:4px" /></a>
  </td></tr>` : ''}
  <tr><td>
    <h3 style="margin:0 0 5px;font-family:Georgia,'Times New Roman',serif;font-size:15px;font-weight:700;color:#111111;line-height:1.35">
      <a href="${url}" style="color:#111111;text-decoration:none">${esc(post.title)}</a>
    </h3>
    ${authors ? `<p style="margin:0 0 5px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#999999">By ${esc(authors)}</p>` : ''}
    ${excerpt ? `<p style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:13px;color:#555555;line-height:1.5">${esc(excerpt)}</p>` : ''}
    <a href="${url}" style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#c8102e;font-weight:600;text-decoration:none">Read &#8594;</a>
  </td></tr>
</table>`;
}

// ─── Newsletter HTML ──────────────────────────────────────────────────────────

export async function generateNewsletterHtml(
  issue: IssueWithPosts,
  opts: { subscriberToken: string },
): Promise<string> {
  const s = await getNewsletterSettings();
  const appUrl = env.APP_URL;
  const unsubUrl = `${appUrl}/unsubscribe/${opts.subscriberToken}`;

  const sorted = [...issue.posts].sort((a, b) => (a.issueOrder ?? 999) - (b.issueOrder ?? 999));
  const [cover, ...rest] = sorted;
  const gridPosts = rest.slice(0, 8);
  const listPosts = rest.slice(8);

  // Build 2-column grid rows
  const gridRows: Post[][] = [];
  for (let i = 0; i < gridPosts.length; i += 2) gridRows.push(gridPosts.slice(i, i + 2));

  const header = `
  <tr><td bgcolor="#1e2537" align="center" style="padding:28px 32px 22px">
    ${s.siteLogo ? `<img src="${esc(s.siteLogo)}" alt="${esc(s.siteName)}" height="48" style="height:48px;width:auto;max-width:200px;display:block;margin:0 auto 14px" />` : ''}
    <h1 style="margin:0 0 7px;font-family:Georgia,'Times New Roman',serif;font-size:52px;font-weight:700;color:#ffffff;letter-spacing:0.3px">${esc(s.siteName)}</h1>
    ${s.tagline ? `<p style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#aaaaaa;font-style:italic">${esc(s.tagline)}</p>` : ''}
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#888888">Volume ${issue.volumeNumber}, Issue ${issue.issueNumber} &bull; ${fmtDateLong(issue.publishDate)}</p>
  </td></tr>`;

  const editorsBar = s.editors.length ? `
  <tr><td bgcolor="#2a2a2a" align="center" style="padding:7px 32px">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa">${s.editors.map(esc).join('&nbsp; &bull; &nbsp;')}</p>
  </td></tr>` : '';

  const coverSection = cover ? `
  <tr><td>
    ${cover.featuredMedia ? `<a href="${appUrl}/articles/${cover.slug}"><img src="${esc(cover.featuredMedia.url)}" alt="${esc(cover.title)}" width="600" style="display:block;width:100%;max-width:600px;height:280px;object-fit:cover" /></a>` : ''}
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:24px 32px 28px">
        <h2 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#111111;line-height:1.3">
          <a href="${appUrl}/articles/${cover.slug}" style="color:#111111;text-decoration:none">${esc(cover.title)}</a>
        </h2>
        ${bylines(cover) ? `<p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#999999">By ${esc(bylines(cover))}</p>` : ''}
        ${cover.excerpt ? `<p style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:15px;color:#444444;line-height:1.65">${esc(trunc(cover.excerpt, 300))}</p>` : ''}
        <a href="${appUrl}/articles/${cover.slug}" style="display:inline-block;background:#c8102e;color:#ffffff;padding:10px 24px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;text-decoration:none;border-radius:3px">Read Full Article &#8594;</a>
      </td></tr>
    </table>
  </td></tr>` : '';

  const moreDivider = gridRows.length ? `
  <tr><td bgcolor="#f7f7f7" style="padding:10px 32px">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#999999">More in this issue</p>
  </td></tr>` : '';

  const gridSection = gridRows.map((pair) => `
  <tr><td style="padding:0 24px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td width="50%" valign="top" style="padding:20px 10px 0 0">${articleCard(pair[0], appUrl)}</td>
        ${pair[1]
          ? `<td width="50%" valign="top" style="padding:20px 0 0 10px">${articleCard(pair[1], appUrl)}</td>`
          : `<td width="50%"></td>`}
      </tr>
      <tr><td colspan="2" style="padding:20px 0 0"><hr style="border:none;border-top:1px solid #eeeeee;margin:0" /></td></tr>
    </table>
  </td></tr>`).join('');

  const listSection = listPosts.length ? `
  <tr><td bgcolor="#f7f7f7" style="padding:10px 32px">
    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:10px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#999999">Also in this issue</p>
  </td></tr>
  <tr><td style="padding:8px 32px 20px">
    <table width="100%" cellpadding="0" cellspacing="0" border="0">
      ${listPosts.map((post, i) => {
        const n = gridPosts.length + i + 2;
        const authors = bylines(post);
        return `<tr><td style="padding:7px 0;border-bottom:1px solid #eeeeee">
          <a href="${appUrl}/articles/${post.slug}" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111111;text-decoration:none;font-weight:600">${n}. ${esc(post.title)}</a>
          ${authors ? `<span style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999"> &mdash; ${esc(authors)}</span>` : ''}
        </td></tr>`;
      }).join('')}
    </table>
  </td></tr>` : '';

  const subscribeBanner = `
  <tr><td bgcolor="#f9f7f4" align="center" style="padding:24px 32px">
    <p style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:16px;font-weight:700;color:#1e2537">Stay informed. Subscribe for free.</p>
    <a href="${esc(s.subscribeUrl)}" style="display:inline-block;background:#1e2537;color:#ffffff;padding:10px 28px;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;text-decoration:none;border-radius:3px">Subscribe &#8594;</a>
  </td></tr>`;

  const footer = `
  <tr><td bgcolor="#1e2537" align="center" style="padding:24px 32px">
    ${s.about ? `<p style="margin:0 0 14px;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#888888;line-height:1.6;max-width:480px;text-align:center">${esc(s.about)}</p>` : ''}
    <table cellpadding="0" cellspacing="0" border="0" align="center">
      <tr>
        <td style="padding:0 10px">
          <a href="${appUrl}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;text-decoration:none">Website</a>
        </td>
        ${s.facebookUrl ? `<td style="padding:0 10px;border-left:1px solid #444444">
          <a href="${esc(s.facebookUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;text-decoration:none">Facebook</a>
        </td>` : ''}
        <td style="padding:0 10px;border-left:1px solid #444444">
          <a href="${esc(s.subscribeUrl)}" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#aaaaaa;text-decoration:none">Subscribe</a>
        </td>
      </tr>
    </table>
    <p style="margin:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;color:#666666">
      <a href="${unsubUrl}" style="color:#666666;text-decoration:none">Unsubscribe</a>
    </p>
  </td></tr>`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${esc(issue.title)}</title>
  <style type="text/css">
    body{margin:0;padding:0;background-color:#f0f0f0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    img{border:0;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
    a{color:#c8102e}
    @media only screen and (max-width:620px){
      .container{width:100%!important}
      .grid-half{display:block!important;width:100%!important;max-width:100%!important;padding-right:0!important;padding-left:0!important}
    }
  </style>
</head>
<body>
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f0f0f0">
  <tr><td align="center" style="padding:20px 10px">
    <table class="container" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:600px;width:100%">
      ${header}
      ${editorsBar}
      ${coverSection}
      ${moreDivider}
      ${gridSection}
      ${listSection}
      ${subscribeBanner}
      ${footer}
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

// ─── WhatsApp helpers ─────────────────────────────────────────────────────────

function numEmoji(n: number): string {
  // Each digit → keycap emoji (e.g. 13 → 1️⃣3️⃣)
  return String(n)
    .split('')
    .map((d) => `${d}️⃣`)
    .join('');
}

// ─── WhatsApp Digest (grouped, 4 articles per part) ──────────────────────────

export async function generateWhatsAppDigest(issue: IssueWithPosts): Promise<string[]> {
  const s = await getNewsletterSettings();
  const appUrl = env.APP_URL;

  const sorted = [...issue.posts].sort((a, b) => (a.issueOrder ?? 999) - (b.issueOrder ?? 999));
  const BATCH = 4;
  const parts: Post[][] = [];
  for (let i = 0; i < sorted.length; i += BATCH) parts.push(sorted.slice(i, i + BATCH));

  const date = fmtDateShort(issue.publishDate);
  const editorBlock = s.editors.join('\n');

  const footerLines: string[] = ['➖➖➖➖➖➖➖➖➖➖➖'];
  if (s.about) footerLines.push(`\n📋 *About ${s.siteName}:*\n${s.about}`);
  if (s.facebookUrl) footerLines.push(`\n📢 Follow us on Facebook\n👍 ${s.facebookUrl}`);
  if (s.subscribeUrl) footerLines.push(`\n📬 *Subscribe for free*\nFill this form: ${s.subscribeUrl}`);
  if (s.waGroups.length) {
    footerLines.push(`\n📬 *Join for WhatsApp version*`);
    s.waGroups.forEach((g) => footerLines.push(`\n*🔴 ${g.label}*: ${g.url}`));
  }
  const footer = footerLines.join('\n');

  return parts.map((batch, idx) => {
    const partHeader = [
      `📮 *${s.siteName}*`,
      s.tagline,
      '',
      `*Part ${idx + 1} of ${parts.length}*`,
      `Vol.${issue.volumeNumber}, No. ${issue.issueNumber} | ${date} Issue`,
      ...(editorBlock ? ['', editorBlock] : []),
    ].filter((l) => l !== undefined).join('\n');

    const articles = batch.map((post, i) => {
      const n = idx * BATCH + i + 1;
      const authors = bylines(post);
      const url = `${appUrl}/articles/${post.slug}`;
      return [
        `${numEmoji(n)} *${post.title}*`,
        authors ? `\n✒️ _${authors}_` : '',
        `\n${url}`,
        '\n-----------------------------------------------------------',
      ].filter(Boolean).join('');
    }).join('\n\n');

    return [partHeader, '', articles, '', footer].join('\n');
  });
}

// ─── WhatsApp Per-Article (channel broadcast format) ─────────────────────────

export async function generateWhatsAppChannelMessages(issue: IssueWithPosts): Promise<Array<{
  id: string;
  name: string;
  messages: string[];
}>> {
  const s = await getNewsletterSettings();
  const appUrl = env.APP_URL;

  const sorted = [...issue.posts].sort((a, b) => (a.issueOrder ?? 999) - (b.issueOrder ?? 999));

  return s.waChannels.map((channel) => {
    const channelFooter = [
      '-----------------------------------------------------------',
      ...channel.links.map((l) => ` 📱 _${l.label}:_\n${l.url}`),
    ].join('\n');

    const messages = sorted.map((post) => {
      const authors = bylines(post);
      const url = `${appUrl}/articles/${post.slug}`;
      const exc = trunc(post.excerpt, 240);
      return [
        `⭕ *${post.title}*`,
        '',
        authors ? `✒️ ${authors}` : '',
        '',
        exc ? `_${exc}_` : '',
        '',
        `*Read full article:*\n${url}`,
        '',
        channelFooter,
      ].filter((l) => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
    });

    return { id: channel.id, name: channel.name, messages };
  });
}
