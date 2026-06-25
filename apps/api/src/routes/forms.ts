import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../plugins/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendMail } from '../services/email.js';

const fieldSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'email', 'phone', 'number', 'textarea', 'select', 'checkbox', 'radio', 'date']),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

const formSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  fields: z.array(fieldSchema).default([]),
  isActive: z.boolean().optional(),
  successMessage: z.string().optional(),
  notifyEmail: z.string().optional(),
  notifyDigest: z.enum(['per_entry', 'daily', 'weekly', 'monthly']).nullable().optional(),
  webhookUrl: z.string().url().nullable().optional(),
});

type FormField = z.infer<typeof fieldSchema>;

function escHtml(s: unknown): string {
  return String(s ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function entriesToCsv(fields: FormField[], entries: { data: unknown; createdAt: Date; ip: string | null }[]): string {
  const fieldNames = fields.map((f) => f.name);
  const header = [...fieldNames, 'submitted_at', 'ip'].map((h) => `"${h}"`).join(',');
  const rows = entries.map((e) => {
    const data = e.data as Record<string, unknown>;
    const cols = [...fieldNames.map((n) => `"${String(data[n] ?? '').replace(/"/g, '""')}"`),
      `"${e.createdAt.toISOString()}"`,
      `"${e.ip ?? ''}"`];
    return cols.join(',');
  });
  return [header, ...rows].join('\n');
}

function entryEmailHtml(formName: string, fields: FormField[], data: Record<string, unknown>): string {
  const rows = fields
    .map((f) => `<tr><td style="padding:4px 8px;font-weight:600;color:#555">${escHtml(f.label)}</td><td style="padding:4px 8px">${escHtml(data[f.name])}</td></tr>`)
    .join('');
  return `<p>New entry for <strong>${escHtml(formName)}</strong>:</p><table border="0" cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%">${rows}</table>`;
}

function digestEmailHtml(formName: string, fields: FormField[], entries: { data: unknown; createdAt: Date }[]): string {
  if (entries.length === 0) return '';
  const rows = entries.map((e) => {
    const data = e.data as Record<string, unknown>;
    const cols = fields.map((f) => `<td style="padding:4px 8px;border-bottom:1px solid #eee">${escHtml(data[f.name])}</td>`).join('');
    return `<tr>${cols}<td style="padding:4px 8px;border-bottom:1px solid #eee;color:#888;font-size:12px">${escHtml(e.createdAt.toLocaleString())}</td></tr>`;
  }).join('');
  const heads = [...fields.map((f) => `<th style="padding:4px 8px;text-align:left;background:#f5f5f5">${escHtml(f.label)}</th>`), '<th style="padding:4px 8px;text-align:left;background:#f5f5f5">Submitted</th>'].join('');
  return `<p><strong>${entries.length}</strong> new entr${entries.length === 1 ? 'y' : 'ies'} for <strong>${escHtml(formName)}</strong>:</p><table border="0" cellspacing="0" style="border-collapse:collapse;width:100%"><thead><tr>${heads}</tr></thead><tbody>${rows}</tbody></table>`;
}

async function fireFormWebhook(webhookUrl: string, formSlug: string, data: Record<string, unknown>): Promise<void> {
  try {
    const body = JSON.stringify({ event: 'form.entry', form: formSlug, data, timestamp: new Date().toISOString() });
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // fire-and-forget
  }
}

const formsRoutes: FastifyPluginAsync = async (fastify) => {
  // --- Admin: CRUD ---

  fastify.get('/', { preHandler: [authenticate] }, async (_req, reply) => {
    const forms = await prisma.form.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { entries: true } } },
    });
    return reply.send(forms);
  });

  fastify.post('/', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const body = formSchema.parse(req.body);
    const form = await prisma.form.create({ data: { ...body, fields: body.fields as any } });
    return reply.status(201).send(form);
  });

  fastify.get('/:id', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const form = await prisma.form.findUnique({
      where: { id },
      include: { _count: { select: { entries: true } } },
    });
    if (!form) return reply.status(404).send({ message: 'Not found' });
    return reply.send(form);
  });

  fastify.patch('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = formSchema.partial().parse(req.body);
    const form = await prisma.form.update({ where: { id }, data: { ...body, fields: body.fields as any } });
    return reply.send(form);
  });

  fastify.delete('/:id', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.form.delete({ where: { id } });
    return reply.send({ success: true });
  });

  // --- Entries ---

  fastify.get('/:id/entries', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const query = req.query as { page?: string; pageSize?: string };
    const page = parseInt(query.page || '1');
    const pageSize = Math.min(parseInt(query.pageSize || '50'), 100);
    const skip = (page - 1) * pageSize;
    const [entries, total] = await Promise.all([
      prisma.formEntry.findMany({ where: { formId: id }, orderBy: { createdAt: 'desc' }, skip, take: pageSize }),
      prisma.formEntry.count({ where: { formId: id } }),
    ]);
    return reply.send({ data: entries, total, page, pageSize });
  });

  fastify.delete('/:id/entries', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { count } = await prisma.formEntry.deleteMany({ where: { formId: id } });
    return reply.send({ deleted: count });
  });

  fastify.delete('/:id/entries/:entryId', { preHandler: [authenticate, requireAdmin] }, async (req, reply) => {
    const { entryId } = req.params as { id: string; entryId: string };
    await prisma.formEntry.delete({ where: { id: entryId } });
    return reply.send({ success: true });
  });

  fastify.get('/:id/entries/export', { preHandler: [authenticate] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const form = await prisma.form.findUnique({ where: { id } });
    if (!form) return reply.status(404).send({ message: 'Not found' });
    const entries = await prisma.formEntry.findMany({ where: { formId: id }, orderBy: { createdAt: 'desc' } });
    const fields = (form.fields as unknown as FormField[]) ?? [];
    const csv = entriesToCsv(fields, entries.map((e) => ({ data: e.data, createdAt: e.createdAt, ip: e.ip })));
    const filename = `form-${form.slug}-entries.csv`;
    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return reply.send(csv);
  });

  // --- Public form definition (for rendering the form) ---

  fastify.get('/public/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const form = await prisma.form.findUnique({
      where: { slug },
      select: { name: true, slug: true, fields: true, isActive: true, successMessage: true },
    });
    if (!form || !form.isActive) return reply.status(404).send({ message: 'Form not found' });
    reply.send(form);
  });

  // --- Public submit ---

  fastify.post('/public/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const form = await prisma.form.findUnique({ where: { slug } });
    if (!form || !form.isActive) return reply.status(404).send({ message: 'Form not found' });

    const fields = (form.fields as unknown as FormField[]) ?? [];
    const submitted = (req.body as Record<string, unknown>) ?? {};

    // Validate required fields
    for (const field of fields) {
      if (field.required && !submitted[field.name]) {
        return reply.status(400).send({ message: `"${field.label}" is required` });
      }
    }

    // Only keep known field values
    const data: Record<string, unknown> = {};
    for (const field of fields) {
      data[field.name] = submitted[field.name] ?? null;
    }

    const entry = await prisma.formEntry.create({
      data: {
        formId: form.id,
        data: data as any,
        ip: req.ip,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    // Per-entry email notification
    if (form.notifyEmail && form.notifyDigest === 'per_entry') {
      const html = entryEmailHtml(form.name, fields, data);
      sendMail({
        to: form.notifyEmail.split(',').map((e) => e.trim()).filter(Boolean),
        subject: `New form entry: ${form.name}`,
        html,
      }).catch(() => {});
    }

    // Webhook notification
    if (form.webhookUrl) {
      fireFormWebhook(form.webhookUrl, form.slug, data).catch(() => {});
    }

    return reply.status(201).send({
      success: true,
      message: form.successMessage || 'Thank you for your submission.',
      entryId: entry.id,
    });
  });
};

export default formsRoutes;

// Exported for use by the scheduler
export { entriesToCsv, digestEmailHtml, entryEmailHtml };
export type { FormField };
