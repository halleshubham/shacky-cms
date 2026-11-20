import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cachedSettings, invalidateSettingsCache } from '../src/utils/settingsCache';

beforeEach(() => {
  invalidateSettingsCache();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// Regression coverage: getAIConfig/getEmailConfig/getBotsabConfig/
// getNewsletterSettings each re-queried the Setting table on every single
// call — the worst case being generateNewsletterHtml calling
// getNewsletterSettings() once per subscriber inside a campaign send loop,
// turning a 5,000-subscriber send into 5,000 redundant Settings queries.
describe('cachedSettings', () => {
  it('only calls the fetcher once for repeated calls within the TTL', async () => {
    const fetcher = vi.fn().mockResolvedValue('value');
    await cachedSettings('k', fetcher);
    await cachedSettings('k', fetcher);
    await cachedSettings('k', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('re-fetches once the TTL has expired', async () => {
    const fetcher = vi.fn().mockResolvedValue('value');
    await cachedSettings('k', fetcher);
    vi.advanceTimersByTime(31_000);
    await cachedSettings('k', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('caches a null result (a provider that is not configured) instead of re-querying every time', async () => {
    const fetcher = vi.fn().mockResolvedValue(null);
    expect(await cachedSettings('k', fetcher)).toBeNull();
    expect(await cachedSettings('k', fetcher)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('keeps separate keys independent', async () => {
    const a = vi.fn().mockResolvedValue('a');
    const b = vi.fn().mockResolvedValue('b');
    await cachedSettings('a', a);
    await cachedSettings('b', b);
    await cachedSettings('a', a);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('invalidateSettingsCache() forces the next call to re-fetch (an admin save takes effect immediately)', async () => {
    const fetcher = vi.fn().mockResolvedValue('value');
    await cachedSettings('k', fetcher);
    invalidateSettingsCache();
    await cachedSettings('k', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
