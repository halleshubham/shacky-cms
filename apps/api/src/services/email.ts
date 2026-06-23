import nodemailer from 'nodemailer';
import { env } from '../utils/env.js';

interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

async function sendViaResend(opts: SendMailOptions): Promise<void> {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY not configured');
  const { Resend } = await import('resend');
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

async function sendViaSmtp(opts: SendMailOptions): Promise<void> {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT || 587,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  await transport.sendMail({
    from: `${env.EMAIL_FROM_NAME} <${env.EMAIL_FROM}>`,
    to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

export async function sendMail(opts: SendMailOptions): Promise<void> {
  if (env.EMAIL_PROVIDER === 'resend') {
    return sendViaResend(opts);
  }
  return sendViaSmtp(opts);
}
