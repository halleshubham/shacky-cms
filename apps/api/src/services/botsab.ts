import { prisma } from '../plugins/prisma.js';

export interface BotsabGroup {
  id: string;
  name: string | null;
  participantCount: number;
}

export interface BotsabConfig {
  apiKey: string;
  baseUrl: string;
  instanceId: string;
}

export async function getBotsabConfig(): Promise<BotsabConfig | null> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['botsab_api_key', 'botsab_base_url', 'botsab_instance_id'] } },
  });
  const m: Record<string, string> = {};
  for (const r of rows) m[r.key] = r.value;

  if (!m.botsab_api_key || !m.botsab_instance_id) return null;

  return {
    apiKey: m.botsab_api_key,
    baseUrl: (m.botsab_base_url || 'https://botsab.shackyapps.in').replace(/\/$/, ''),
    instanceId: m.botsab_instance_id,
  };
}

async function botsabFetch(config: BotsabConfig, path: string, init?: RequestInit) {
  const res = await fetch(`${config.baseUrl}${path}`, {
    ...init,
    headers: {
      'x-api-key': config.apiKey,
      'Content-Type': 'application/json',
      ...((init?.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Botsab ${res.status}: ${text}`);
  }
  return res.json();
}

export async function listBotsabGroups(): Promise<BotsabGroup[]> {
  const config = await getBotsabConfig();
  if (!config) throw new Error('Botsab is not configured — add API key and instance ID in Integrations settings');

  const data = await botsabFetch(config, `/instances/${config.instanceId}/groups`);
  const list: any[] = data.data ?? data ?? [];
  return list.map((g: any) => ({
    id: g.id,
    name: g.name || null,
    participantCount: g.participantCount ?? 0,
  }));
}

export async function sendMessagesToGroups(
  groupJids: string[],
  messages: string[],
): Promise<{ sent: number; errors: string[] }> {
  const config = await getBotsabConfig();
  if (!config) throw new Error('Botsab is not configured');

  // Order: all parts to group1, then all parts to group2, etc.
  const bulk: Array<{ to: string; type: 'text'; text: string }> = [];
  for (const jid of groupJids) {
    for (const text of messages) {
      bulk.push({ to: jid, type: 'text', text });
    }
  }

  // sendBulk: max 50 per request
  const CHUNK = 50;
  let sent = 0;
  const errors: string[] = [];

  for (let i = 0; i < bulk.length; i += CHUNK) {
    const chunk = bulk.slice(i, i + CHUNK);
    try {
      await botsabFetch(config, `/instances/${config.instanceId}/messages/sendBulk`, {
        method: 'POST',
        body: JSON.stringify({ messages: chunk, delayMs: 2000 }),
      });
      sent += chunk.length;
    } catch (err: any) {
      errors.push(err.message ?? 'Unknown error');
    }
  }

  return { sent, errors };
}
