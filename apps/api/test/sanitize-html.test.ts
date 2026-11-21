import { describe, it, expect } from 'vitest';
import { sanitizePostContent } from '../src/utils/sanitizeHtml';

// Regression coverage: post/page content (from the TipTap editor, AI
// generation, or WordPress import) was stored and later rendered via
// dangerouslySetInnerHTML with zero server-side sanitization anywhere in
// the pipeline — a single compromised or malicious author/editor account,
// or a spoofed WordPress source, could plant persistent script execution
// against every visitor of the public site.
describe('sanitizePostContent', () => {
  it('strips <script> tags entirely, including their text content', () => {
    const out = sanitizePostContent('<p>hello</p><script>alert(document.cookie)</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('alert');
    expect(out).toContain('<p>hello</p>');
  });

  it('strips inline event handler attributes', () => {
    const out = sanitizePostContent('<img src="a.jpg" onerror="alert(1)" alt="x">');
    expect(out).not.toContain('onerror');
    expect(out).not.toContain('alert');
  });

  it('strips javascript: URLs in links', () => {
    const out = sanitizePostContent('<a href="javascript:alert(1)">click</a>');
    expect(out).not.toContain('javascript:');
  });

  it('strips javascript: URLs in image sources', () => {
    const out = sanitizePostContent('<img src="javascript:alert(1)">');
    expect(out).not.toContain('javascript:');
  });

  it('removes a disguised SVG onload payload', () => {
    const out = sanitizePostContent('<svg onload="alert(1)"><circle /></svg>');
    expect(out).not.toContain('onload');
    expect(out).not.toContain('alert');
  });

  it('preserves every tag the TipTap editor can actually produce', () => {
    const html =
      '<h1>Title</h1><p>Some <strong>bold</strong> and <em>italic</em> and <u>underline</u> and <s>strike</s> text.</p>' +
      '<blockquote>quote</blockquote><ul><li>one</li></ul><ol><li>two</li></ol>' +
      '<pre><code>const x = 1;</code></pre><hr><img src="https://cms.test/img.jpg" alt="pic">' +
      '<a href="https://example.com">link</a>' +
      '<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>d</td></tr></tbody></table>';
    const out = sanitizePostContent(html);
    for (const tag of ['h1', 'strong', 'em', 'u', 's', 'blockquote', 'ul', 'li', 'ol', 'pre', 'code', 'hr', 'img', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td']) {
      expect(out).toContain(`<${tag}`);
    }
    expect(out).toContain('https://cms.test/img.jpg');
    expect(out).toContain('https://example.com');
  });

  it('keeps legitimate http/https/mailto links and image sources untouched', () => {
    const out = sanitizePostContent('<a href="mailto:a@b.com">mail</a><img src="https://cms.test/x.jpg">');
    expect(out).toContain('mailto:a@b.com');
    expect(out).toContain('https://cms.test/x.jpg');
  });

  it('keeps video embeds from the CSP-allowed hosts and layout wrappers, but drops their inline styles', () => {
    const yt = '<div style="position:absolute" class="video"><iframe src="https://www.youtube.com/embed/abc" style="x:y" onload="alert(1)" loading="lazy"></iframe></div>';
    const out = sanitizePostContent(yt);
    expect(out).toContain('<iframe src="https://www.youtube.com/embed/abc"');
    expect(out).toContain('class="video"');
    expect(out).not.toContain('style=');
    expect(out).not.toContain('onload');
    const fig = sanitizePostContent('<figure class="f"><img src="https://cms.test/a.jpg"><figcaption>c</figcaption></figure>');
    expect(fig).toContain('<figcaption>c</figcaption>');
  });

  it('removes iframes from any other host', () => {
    expect(sanitizePostContent('<iframe src="https://evil.example/x"></iframe>')).not.toContain('iframe');
    expect(sanitizePostContent('<iframe src="javascript:alert(1)"></iframe>')).not.toContain('iframe');
  });

  it('passes through empty content unchanged', () => {
    expect(sanitizePostContent('')).toBe('');
  });
});
