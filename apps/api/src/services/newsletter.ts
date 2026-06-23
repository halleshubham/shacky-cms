import Handlebars from 'handlebars';
import type { Issue, Post } from '@prisma/client';
import { env } from '../utils/env.js';

const TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{{issue.title}}</title>
<style>
  body{font-family:Georgia,serif;background:#f4f4f4;margin:0;padding:0;color:#222}
  .wrapper{max-width:640px;margin:0 auto;background:#fff}
  .header{background:#1a1a2e;color:#fff;padding:32px 24px;text-align:center}
  .header h1{margin:0 0 8px;font-size:28px;letter-spacing:1px}
  .header p{margin:0;font-size:14px;opacity:.8}
  .cover{padding:24px}
  .cover img{width:100%;height:220px;object-fit:cover;border-radius:6px}
  .cover h2{font-size:24px;margin:16px 0 8px}
  .cover p{color:#555;line-height:1.6}
  .cta{display:inline-block;background:#e63946;color:#fff;padding:10px 22px;border-radius:4px;text-decoration:none;font-size:14px;margin-top:12px}
  .section-title{padding:8px 24px;background:#f0f0f0;font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#888}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding:16px 24px}
  .card{border:1px solid #eee;border-radius:6px;overflow:hidden}
  .card img{width:100%;height:120px;object-fit:cover}
  .card-body{padding:12px}
  .card-body h3{margin:0 0 6px;font-size:15px;line-height:1.3}
  .card-body p{margin:0;font-size:13px;color:#666;line-height:1.5}
  .card-body a{color:#e63946;font-size:12px;text-decoration:none}
  .footer{background:#1a1a2e;color:#aaa;padding:24px;text-align:center;font-size:12px}
  .footer a{color:#aaa}
  @media(max-width:480px){.grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>{{siteName}}</h1>
    <p>Volume {{issue.volumeNumber}}, Issue {{issue.issueNumber}} &bull; {{formatDate issue.publishDate}}</p>
    {{#if editors}}<p style="margin-top:8px;font-size:12px">Editors: {{editors}}</p>{{/if}}
  </div>

  {{#if coverArticle}}
  <div class="cover">
    {{#if coverArticle.featuredMedia}}
    <img src="{{coverArticle.featuredMedia.url}}" alt="{{coverArticle.featuredMedia.altText}}"/>
    {{/if}}
    <h2>{{coverArticle.title}}</h2>
    {{#if coverArticle.authors.length}}
    <p style="font-size:13px;color:#888;margin:0 0 8px">By {{authorNames coverArticle.authors}}</p>
    {{/if}}
    <p>{{coverArticle.excerpt}}</p>
    <a class="cta" href="{{appUrl}}/articles/{{coverArticle.slug}}">Read More &rarr;</a>
  </div>
  {{/if}}

  {{#if remainingArticles.length}}
  <div class="section-title">More in this issue</div>
  <div class="grid">
    {{#each remainingArticles}}
    <div class="card">
      {{#if this.featuredMedia}}
      <img src="{{this.featuredMedia.url}}" alt="{{this.featuredMedia.altText}}"/>
      {{/if}}
      <div class="card-body">
        <h3>{{this.title}}</h3>
        {{#if this.authors.length}}
        <p style="font-size:12px;color:#888;margin-bottom:4px">{{../authorNames this.authors}}</p>
        {{/if}}
        <p>{{truncate this.excerpt 120}}</p>
        <a href="{{../appUrl}}/articles/{{this.slug}}">Read &rarr;</a>
      </div>
    </div>
    {{/each}}
  </div>
  {{/if}}

  <div class="footer">
    <p>{{siteName}} &bull; <a href="{{appUrl}}">Visit Website</a></p>
    <p style="margin-top:8px">
      <a href="{{unsubscribeUrl}}">Unsubscribe</a>
    </p>
  </div>
</div>
</body>
</html>`;

Handlebars.registerHelper('formatDate', (date: Date | string) => {
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
});

Handlebars.registerHelper('authorNames', (authors: Array<{ author: { displayName: string } }>) => {
  return authors.map((a) => a.author?.displayName || '').filter(Boolean).join(', ');
});

Handlebars.registerHelper('truncate', (str: string, len: number) => {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
});

const compiled = Handlebars.compile(TEMPLATE);

interface IssueWithPosts {
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

export function generateNewsletterHtml(
  issue: IssueWithPosts,
  opts: {
    siteName?: string;
    editors?: string;
    subscriberToken: string;
  },
): string {
  const sorted = [...issue.posts].sort((a, b) => (a.issueOrder || 0) - (b.issueOrder || 0));
  const [coverArticle, ...remainingArticles] = sorted;

  return compiled({
    issue,
    coverArticle,
    remainingArticles,
    siteName: opts.siteName || 'Shacky CMS',
    editors: opts.editors || '',
    appUrl: env.APP_URL,
    unsubscribeUrl: `${env.APP_URL}/unsubscribe/${opts.subscriberToken}`,
  });
}

export function generateWhatsAppMessage(
  issue: IssueWithPosts,
  channel: 'janata' | 'lokayat' | 'abhivyakti',
  appUrl: string,
): string {
  const sorted = [...issue.posts].sort((a, b) => (a.issueOrder || 0) - (b.issueOrder || 0));

  const header = `*${issue.title}*\nVolume ${issue.volumeNumber}, Issue ${issue.issueNumber}\n\n`;

  const articles = sorted
    .map((post, i) => {
      const authors = post.authors.map((a) => a.author?.displayName).filter(Boolean).join(', ');
      return `*${i + 1}. ${post.title}*${authors ? `\n_${authors}_` : ''}\n${post.excerpt || ''}\n${appUrl}/articles/${post.slug}`;
    })
    .join('\n\n');

  return `${header}${articles}`;
}
