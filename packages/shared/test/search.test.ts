import { describe, it, expect } from 'vitest';
import { escapeLikeWildcards } from '../src/utils/search';

describe('escapeLikeWildcards', () => {
  it('escapes % so it is matched literally, not as a wildcard', () => {
    expect(escapeLikeWildcards('50%')).toBe('50\\%');
  });

  it('escapes _ so it is matched literally, not as a single-char wildcard', () => {
    expect(escapeLikeWildcards('track_record')).toBe('track\\_record');
  });

  it('escapes a literal backslash first, so later escaping does not double up', () => {
    expect(escapeLikeWildcards('C:\\path')).toBe('C:\\\\path');
  });

  it('escapes backslash before wildcards when both are present', () => {
    expect(escapeLikeWildcards('100%\\_done')).toBe('100\\%\\\\\\_done');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeLikeWildcards('hello world')).toBe('hello world');
  });

  it('handles an empty string', () => {
    expect(escapeLikeWildcards('')).toBe('');
  });
});
