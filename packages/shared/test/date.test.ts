import { describe, it, expect } from 'vitest';
import { computePublishTimestamp } from '../src/utils/date';

describe('computePublishTimestamp', () => {
  const day = new Date(2026, 5, 10);

  it('staggers articles so article 1 publishes last', () => {
    const first = computePublishTimestamp(day, 1, 5, 1);
    const last = computePublishTimestamp(day, 5, 5, 1);
    expect(first.getTime()).toBeGreaterThan(last.getTime());
  });

  it('uses the publish hour and minute offset', () => {
    const d = computePublishTimestamp(day, 2, 4, 6);
    expect(d.getHours()).toBe(6);
    expect(d.getMinutes()).toBe(3);
    expect(d.getSeconds()).toBe(0);
  });

  it('does not mutate the input date', () => {
    const input = new Date(day);
    computePublishTimestamp(input, 1, 3);
    expect(input.getTime()).toBe(day.getTime());
  });
});
