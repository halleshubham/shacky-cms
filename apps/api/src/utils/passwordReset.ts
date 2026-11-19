import { randomBytes, createHash } from 'crypto';
import { prisma } from '../plugins/prisma.js';

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000; // 48h — long enough for a busy admin's invite to still work

function hashToken(rawToken: string): string {
  // Same reasoning as RefreshToken: this is a high-entropy opaque value, not
  // a human password, so a plain SHA-256 digest (not bcrypt) is correct —
  // no truncation, exact O(1) lookup by the token the user actually clicks.
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Issues a one-time token for a user to set their own password, in place of ever emailing one. */
export async function createPasswordResetToken(userId: string): Promise<string> {
  const rawToken = randomBytes(32).toString('base64url');
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hashToken(rawToken), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
  });
  return rawToken;
}

/** Consumes a presented token: returns the userId it belongs to, or null if invalid/expired/already used. */
export async function consumePasswordResetToken(rawToken: string): Promise<string | null> {
  const row = await prisma.passwordResetToken.findFirst({
    where: { tokenHash: hashToken(rawToken), expiresAt: { gt: new Date() } },
  });
  if (!row) return null;
  await prisma.passwordResetToken.delete({ where: { id: row.id } }); // one-time use
  return row.userId;
}
