// Runs `fn` over `items` with at most `limit` in flight at once, in the
// original order of `items`. Used for campaign sends, which previously
// awaited one recipient at a time — for a list of thousands of subscribers
// that turned a send that could complete in seconds into one that took
// many minutes while holding the admin's HTTP request open the whole time.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
