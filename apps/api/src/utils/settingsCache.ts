// getAIConfig/getEmailConfig/getBotsabConfig/getNewsletterSettings each did
// their own prisma.setting.findMany on every single call, even though these
// values (AI provider key, SMTP host, Botsab credentials, newsletter
// branding) change rarely. The worst case was generateNewsletterHtml calling
// getNewsletterSettings() once per subscriber inside a campaign send loop —
// for a 5,000-subscriber list that's 5,000 redundant Settings queries to
// produce what is otherwise identical output. A short TTL cache removes that
// cost from the hot path while still picking up an admin's config change
// within seconds; PATCH /settings also calls invalidate() directly so a save
// in the admin UI takes effect immediately rather than waiting out the TTL.
const CACHE_TTL_MS = 30_000;

const cache = new Map<string, { value: unknown; expiresAt: number }>();

export async function cachedSettings<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value as T;
  const value = await fetcher();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

export function invalidateSettingsCache(): void {
  cache.clear();
}
