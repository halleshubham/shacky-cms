import { describe, it, expect, vi, beforeEach } from 'vitest';

const prisma = vi.hoisted(() => ({
  passwordResetToken: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));

import { createPasswordResetToken, consumePasswordResetToken } from '../src/utils/passwordReset';

beforeEach(() => vi.resetAllMocks());

describe('createPasswordResetToken', () => {
  it('returns a raw token distinct from what gets stored', async () => {
    const token = await createPasswordResetToken('u1');
    expect(token).toMatch(/^[A-Za-z0-9_-]{30,}$/); // base64url, no padding
    const stored = prisma.passwordResetToken.create.mock.calls[0][0].data;
    expect(stored.userId).toBe('u1');
    expect(stored.tokenHash).not.toBe(token); // never store the raw token
    expect(stored.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('two tokens for the same user never collide', async () => {
    const a = await createPasswordResetToken('u1');
    const b = await createPasswordResetToken('u1');
    expect(a).not.toBe(b);
    expect(prisma.passwordResetToken.create.mock.calls[0][0].data.tokenHash)
      .not.toBe(prisma.passwordResetToken.create.mock.calls[1][0].data.tokenHash);
  });
});

describe('consumePasswordResetToken', () => {
  it('returns null and deletes nothing when no row matches (invalid/expired)', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue(null);
    const result = await consumePasswordResetToken('whatever');
    expect(result).toBeNull();
    expect(prisma.passwordResetToken.delete).not.toHaveBeenCalled();
  });

  it('returns the userId and deletes the row on a valid token (one-time use)', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue({ id: 'r1', userId: 'u1' });
    const result = await consumePasswordResetToken('real-token');
    expect(result).toBe('u1');
    expect(prisma.passwordResetToken.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
  });

  it('looks up by exact hash and excludes expired rows', async () => {
    prisma.passwordResetToken.findFirst.mockImplementation(({ where }: any) => {
      expect(where.tokenHash).toMatch(/^[0-9a-f]{64}$/); // sha256 hex
      expect(where.expiresAt.gt).toBeInstanceOf(Date);
      return null;
    });
    await consumePasswordResetToken('some-token');
    expect(prisma.passwordResetToken.findFirst).toHaveBeenCalled();
  });
});
