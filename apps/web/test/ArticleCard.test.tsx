import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ArticleCard } from '@/components/public/ArticleCard';

const post = {
  id: '1',
  slug: 'hello-world',
  title: 'Hello world',
  excerpt: 'An excerpt',
  featuredMedia: { url: 'https://example.com/a.jpg', altText: 'alt' },
  featuredImagePosition: '50% 15%',
  authors: [{ displayName: 'Asha', slug: 'asha' }],
  categories: [{ name: 'Culture', slug: 'culture' }],
};

describe('ArticleCard', () => {
  it.each(['default', 'large', 'compact'] as const)('links to /articles/<slug> (%s)', (size) => {
    const { container } = render(<ArticleCard post={post} size={size} />);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/articles/hello-world');
  });

  it.each(['default', 'large', 'compact'] as const)('applies the featured image crop focus (%s)', (size) => {
    const { container } = render(<ArticleCard post={post} size={size} />);
    const img = container.querySelector('img') as HTMLElement;
    expect(img.style.objectPosition).toBe('50% 15%');
  });

  it('renders without an image or a crop focus', () => {
    const { container } = render(<ArticleCard post={{ ...post, featuredMedia: null, featuredImagePosition: null }} />);
    expect(container.querySelector('img')).toBeNull();
  });
});
