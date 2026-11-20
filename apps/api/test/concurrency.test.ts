import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '../src/utils/concurrency';

describe('mapWithConcurrency', () => {
  it('returns results in the original order regardless of completion order', async () => {
    const delays = [30, 10, 20, 5, 25];
    const result = await mapWithConcurrency(delays, 3, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms));
      return i;
    });
    expect(result).toEqual([0, 1, 2, 3, 4]);
  });

  it('never runs more than `limit` at once', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapWithConcurrency(items, 4, async (i) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return i;
    });
    expect(maxInFlight).toBeLessThanOrEqual(4);
  });

  it('processes every item exactly once', async () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const seen: number[] = [];
    await mapWithConcurrency(items, 7, async (i) => {
      seen.push(i);
      return i;
    });
    expect(seen.length).toBe(50);
    expect(new Set(seen).size).toBe(50);
  });

  it('handles an empty array', async () => {
    const result = await mapWithConcurrency([], 5, async (i) => i);
    expect(result).toEqual([]);
  });

  it('handles limit larger than the item count', async () => {
    const result = await mapWithConcurrency([1, 2, 3], 100, async (i) => i * 2);
    expect(result).toEqual([2, 4, 6]);
  });

  it('propagates a rejection rather than silently swallowing it', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (i) => {
        if (i === 2) throw new Error('boom');
        return i;
      }),
    ).rejects.toThrow('boom');
  });
});
