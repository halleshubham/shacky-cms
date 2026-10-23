import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateApplicationSecret,
  buildApplicationToken,
  parseApplicationToken,
} from '../src/utils/password';

describe('password hashing', () => {
  it('verifies the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash).not.toBe('correct horse');
    expect(await verifyPassword('correct horse', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});

describe('application tokens', () => {
  it('round-trips record id and secret', () => {
    const token = buildApplicationToken('rec123', 'sec.ret');
    expect(token).toBe('shacky_rec123.sec.ret');
    expect(parseApplicationToken(token)).toEqual({ recordId: 'rec123', secret: 'sec.ret' });
  });

  it('rejects tokens without the prefix or record id', () => {
    expect(parseApplicationToken('abc.def')).toBeNull();
    expect(parseApplicationToken('shacky_nodot')).toBeNull();
    expect(parseApplicationToken('shacky_.secret')).toBeNull();
  });

  it('generates a random 64-char hex secret with a matching hash', async () => {
    const a = generateApplicationSecret();
    const b = generateApplicationSecret();
    expect(a.secret).toMatch(/^[0-9a-f]{64}$/);
    expect(a.secret).not.toBe(b.secret);
    expect(await verifyPassword(a.secret, await a.hash)).toBe(true);
  });
});
