import { prisma } from '../plugins/prisma.js';
import crypto from 'crypto';

export async function fireWebhook(event: string, payload: unknown): Promise<void> {
  const hooks = await prisma.webhook.findMany({ where: { event, isActive: true } });
  if (hooks.length === 0) return;

  await Promise.allSettled(
    hooks.map(async (hook) => {
      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };

      if (hook.secret) {
        const sig = crypto.createHmac('sha256', hook.secret).update(body).digest('hex');
        headers['X-Shacky-Signature'] = `sha256=${sig}`;
      }

      try {
        await fetch(hook.targetUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(10000) });
      } catch {
        // Fire-and-forget; failures are silent
      }
    }),
  );
}
