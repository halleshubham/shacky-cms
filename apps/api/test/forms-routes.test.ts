import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import Fastify from 'fastify';

const prisma = vi.hoisted(() => ({
  form: { findUnique: vi.fn() },
  formEntry: { create: vi.fn() },
}));
vi.mock('../src/plugins/prisma.js', () => ({ prisma }));
vi.mock('../src/services/email.js', () => ({ sendMail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../src/middleware/auth.js', () => ({
  authenticate: async () => {},
  requireAdmin: async () => {},
}));

import formsRoutes from '../src/routes/forms';

const app = Fastify();
app.register(formsRoutes, { prefix: '/api/forms' });
afterAll(() => app.close());

beforeEach(() => vi.resetAllMocks());

const form = {
  id: 'f1',
  slug: 'contact',
  name: 'Contact',
  isActive: true,
  successMessage: null,
  notifyEmail: null,
  notifyDigest: null,
  webhookUrl: null,
  fields: [
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'age', label: 'Age', type: 'number', required: false },
    { name: 'dob', label: 'Date of birth', type: 'date', required: false },
    { name: 'note', label: 'Note', type: 'text', required: false },
  ],
};

const submit = (data: unknown) => app.inject({ method: 'POST', url: '/api/forms/public/contact', payload: data as any });

beforeEach(() => {
  prisma.form.findUnique.mockResolvedValue(form);
  prisma.formEntry.create.mockResolvedValue({ id: 'e1' });
});

describe('POST /api/forms/public/:slug — field type validation', () => {
  it('rejects a garbage email', async () => {
    const res = await submit({ email: 'not-an-email', age: '30' });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('Email');
    expect(prisma.formEntry.create).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric value in a number field', async () => {
    const res = await submit({ email: 'a@b.com', age: 'thirty' });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('Age');
  });

  it('rejects an invalid date', async () => {
    const res = await submit({ email: 'a@b.com', dob: 'not-a-date' });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('Date of birth');
  });

  it('accepts valid values', async () => {
    const res = await submit({ email: 'a@b.com', age: '30', dob: '1990-01-01', note: 'hi' });
    expect(res.statusCode).toBe(201);
    expect(prisma.formEntry.create).toHaveBeenCalled();
  });

  it('leaves optional empty fields alone (no false-positive validation)', async () => {
    const res = await submit({ email: 'a@b.com', age: '', dob: '' });
    expect(res.statusCode).toBe(201);
  });

  it('still enforces required fields first', async () => {
    const res = await submit({ age: '30' });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain('required');
  });
});
