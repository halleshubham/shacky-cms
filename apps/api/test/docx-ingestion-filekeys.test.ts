import { describe, it, expect } from 'vitest';
import { buildArticleFileKeyMaps } from '../src/services/docxIngestion';

// Regression coverage: the original code re-scanned the full zip file-name
// list (Array#find) once per article to locate its .docx, and up to
// imgExts.length (4) times per article for its image even though every one
// of those passes checked the exact same combined regex. This replaces both
// with a single pass building article-number -> zip-key maps.
describe('buildArticleFileKeyMaps', () => {
  it('maps a docx file to its leading article number', () => {
    const { docxKeyByNumber } = buildArticleFileKeyMaps([
      'Summary.docx',
      '1-Budget Announcement_Asha.docx',
      '2.Local Elections.docx',
      '3 Weather Report.docx',
    ]);
    expect(docxKeyByNumber.get(1)).toBe('1-Budget Announcement_Asha.docx');
    expect(docxKeyByNumber.get(2)).toBe('2.Local Elections.docx');
    expect(docxKeyByNumber.get(3)).toBe('3 Weather Report.docx');
    expect(docxKeyByNumber.has(4)).toBe(false);
  });

  it('matches an image by any of the supported extensions, case-insensitively', () => {
    const { imageKeyByNumber } = buildArticleFileKeyMaps(['1.JPG', '2.png', '3.webp', '4.gif']);
    expect(imageKeyByNumber.get(1)).toBe('1.JPG');
    expect(imageKeyByNumber.get(2)).toBe('2.png');
    expect(imageKeyByNumber.get(3)).toBe('3.webp');
    expect(imageKeyByNumber.has(4)).toBe(false); // .gif isn't a supported extension
  });

  it('keeps the first match per number, same as the Array#find() it replaces', () => {
    const { docxKeyByNumber, imageKeyByNumber } = buildArticleFileKeyMaps([
      '1-First.docx',
      '1-Second.docx',
      '2.jpg',
      '2.png',
    ]);
    expect(docxKeyByNumber.get(1)).toBe('1-First.docx');
    expect(imageKeyByNumber.get(2)).toBe('2.jpg');
  });

  it('only looks at the basename, ignoring any folder path inside the zip', () => {
    const { docxKeyByNumber, imageKeyByNumber } = buildArticleFileKeyMaps([
      'articles/1-Story.docx',
      'images/2.png',
    ]);
    expect(docxKeyByNumber.get(1)).toBe('articles/1-Story.docx');
    expect(imageKeyByNumber.get(2)).toBe('images/2.png');
  });

  it('does not match an image filename with no number prefix (e.g. a stray asset)', () => {
    const { imageKeyByNumber } = buildArticleFileKeyMaps(['logo.png', 'cover.jpg']);
    expect(imageKeyByNumber.size).toBe(0);
  });
});
