import { describe, it, expect } from 'vitest';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../src/utils/jwt';

const payload = { sub: 'user1', email: 'a@b.test', role: 'editor' as const };

describe('jwt', () => {
  it('signs and verifies an access token', async () => {
    const claims = await verifyAccessToken(await signAccessToken(payload));
    expect(claims).toMatchObject({ sub: 'user1', email: 'a@b.test', role: 'editor', type: 'access' });
    expect(claims.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('signs and verifies a refresh token', async () => {
    const claims = await verifyRefreshToken(await signRefreshToken(payload));
    expect(claims).toMatchObject({ sub: 'user1', type: 'refresh' });
  });

  it('does not accept a refresh token as an access token (and vice versa)', async () => {
    await expect(verifyAccessToken(await signRefreshToken(payload))).rejects.toThrow();
    await expect(verifyRefreshToken(await signAccessToken(payload))).rejects.toThrow();
  });

  it('rejects garbage', async () => {
    await expect(verifyAccessToken('not.a.jwt')).rejects.toThrow();
  });
});
