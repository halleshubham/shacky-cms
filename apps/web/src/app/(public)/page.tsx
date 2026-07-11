import { HomepageSections } from '@/components/public/homepage/HomepageSections';
import { getSiteSettings } from '@/lib/site-settings';
import { getTheme } from '@/lib/theme-registry';

const API = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL;

async function getLatestIssue() {
  try {
    const res = await fetch(`${API}/api/public/issues/latest`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function getRecentPosts() {
  try {
    const res = await fetch(`${API}/api/public/posts?pageSize=8`, { next: { revalidate: 60 } });
    if (!res.ok) return { data: [] };
    return res.json();
  } catch { return { data: [] }; }
}

export default async function HomePage() {
  const settings = await getSiteSettings();

  // If sections are configured in builder, use those (overrides theme HomePage)
  if (settings.homepage_sections && settings.homepage_sections.length > 0) {
    return <HomepageSections sections={settings.homepage_sections} />;
  }

  const [issue, recent] = await Promise.all([getLatestIssue(), getRecentPosts()]);
  const issuePosts: any[] = issue?.posts || [];
  const recentPosts: any[] = recent?.data || [];

  const hero = issuePosts[0] || recentPosts[0] || null;
  const gridPosts = issuePosts.length > 1 ? issuePosts.slice(1, 4) : recentPosts.slice(1, 4);
  const listPosts = recentPosts.slice(4, 8);

  const issueData = issue
    ? {
        id: issue.id,
        title: issue.title,
        volumeNumber: issue.volumeNumber,
        issueNumber: issue.issueNumber,
        publishDate: issue.publishDate,
      }
    : null;

  const { HomePage: ThemeHomePage } = getTheme(settings.public_theme);

  return (
    <ThemeHomePage
      hero={hero}
      gridPosts={gridPosts}
      listPosts={listPosts}
      issue={issueData}
    />
  );
}
