import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Star, Clock } from 'lucide-react';

interface ArticleCardProps {
  post: {
    id: string;
    slug: string;
    title: string;
    excerpt?: string | null;
    publishedAt?: string | null;
    isFeatured?: boolean;
    readingTime?: number;
    featuredMedia?: { url: string; altText?: string | null } | null;
    authors?: { displayName: string; slug: string }[];
    categories?: { name: string; slug: string }[];
  };
  size?: 'default' | 'large' | 'compact';
}

export function ArticleCard({ post, size = 'default' }: ArticleCardProps) {
  const author = post.authors?.[0];
  const category = post.categories?.[0];
  const timeAgo = post.publishedAt
    ? formatDistanceToNow(new Date(post.publishedAt), { addSuffix: true })
    : null;

  if (size === 'compact') {
    return (
      <Link href={`/articles/${post.slug}`} className="flex gap-3 group">
        {post.featuredMedia && (
          <div className="relative w-20 h-16 shrink-0 rounded overflow-hidden bg-muted">
            <Image src={post.featuredMedia.url} alt={post.featuredMedia.altText || post.title} fill className="object-cover" />
          </div>
        )}
        <div className="min-w-0">
          {category && (
            <span className="text-xs font-medium text-primary uppercase tracking-wide">{category.name}</span>
          )}
          <h3 className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2 mt-0.5">
            {post.title}
          </h3>
          {timeAgo && <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>}
        </div>
      </Link>
    );
  }

  if (size === 'large') {
    return (
      <Link href={`/articles/${post.slug}`} className="group block">
        {post.featuredMedia && (
          <div className="relative aspect-[16/9] rounded-lg overflow-hidden bg-muted mb-4">
            <Image src={post.featuredMedia.url} alt={post.featuredMedia.altText || post.title} fill className="object-cover group-hover:scale-[1.02] transition-transform duration-300" />
          </div>
        )}
        {category && (
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">{category.name}</span>
        )}
        <h2 className="text-2xl font-bold leading-tight mt-1 group-hover:text-primary transition-colors">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="text-muted-foreground mt-2 leading-relaxed line-clamp-3">{post.excerpt}</p>
        )}
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          {post.isFeatured && <span className="flex items-center gap-1 text-amber-500"><Star className="h-3.5 w-3.5 fill-current" /> Featured</span>}
          {author && <span>{author.displayName}</span>}
          {author && timeAgo && <span>·</span>}
          {timeAgo && <span>{timeAgo}</span>}
          {post.readingTime && <><span>·</span><span className="flex items-center gap-1"><Clock className="h-3 w-3" />{post.readingTime} min</span></>}
        </div>
      </Link>
    );
  }

  return (
    <Link href={`/articles/${post.slug}`} className="group block">
      {post.featuredMedia && (
        <div className="relative aspect-[16/9] rounded-md overflow-hidden bg-muted mb-3">
          <Image src={post.featuredMedia.url} alt={post.featuredMedia.altText || post.title} fill className="object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        </div>
      )}
      {category && (
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">{category.name}</span>
      )}
      <h3 className="text-base font-semibold leading-snug mt-1 group-hover:text-primary transition-colors line-clamp-2">
        {post.title}
      </h3>
      {post.excerpt && (
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
      )}
      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
        {post.isFeatured && <span className="flex items-center gap-0.5 text-amber-500"><Star className="h-3 w-3 fill-current" /></span>}
        {author && <span>{author.displayName}</span>}
        {author && timeAgo && <span>·</span>}
        {timeAgo && <span>{timeAgo}</span>}
        {post.readingTime && <><span>·</span><span>{post.readingTime} min</span></>}
      </div>
    </Link>
  );
}
