import nodemailer from 'nodemailer';
import { prisma } from '../plugins/prisma.js';

interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}

interface EmailConfig {
  provider: 'smtp' | 'resend';
  from: string;
  fromName: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  resendApiKey?: string;
}

async function getEmailConfig(): Promise<EmailConfig> {
  const rows = await prisma.setting.findMany({
    where: {
      key: { in: ['email_provider', 'email_from', 'email_from_name', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'resend_api_key'] },
    },
  });
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key] = r.value;

  const provider = (s.email_provider === 'resend' ? 'resend' : 'smtp') as EmailConfig['provider'];
  const from = s.email_from || 'noreply@localhost';
  const fromName = s.email_from_name || '';

  return {
    provider,
    from,
    fromName,
    smtpHost: s.smtp_host,
    smtpPort: s.smtp_port ? Number(s.smtp_port) : 587,
    smtpUser: s.smtp_user,
    smtpPass: s.smtp_pass,
    resendApiKey: s.resend_api_key,
  };
}

async function sendViaResend(cfg: EmailConfig, opts: SendMailOptions): Promise<void> {
  if (!cfg.resendApiKey) throw new Error('Resend API key not configured. Add it in Settings → Email.');
  const { Resend } = await import('resend');
  const resend = new Resend(cfg.resendApiKey);
  const from = cfg.fromName ? `${cfg.fromName} <${cfg.from}>` : cfg.from;
  await resend.emails.send({
    from,
    to: Array.isArray(opts.to) ? opts.to : [opts.to],
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

async function sendViaSmtp(cfg: EmailConfig, opts: SendMailOptions): Promise<void> {
  if (!cfg.smtpHost) throw new Error('SMTP host not configured. Add it in Settings → Email.');
  const transport = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort || 587,
    auth: cfg.smtpUser ? { user: cfg.smtpUser, pass: cfg.smtpPass } : undefined,
  });
  const from = cfg.fromName ? `${cfg.fromName} <${cfg.from}>` : cfg.from;
  await transport.sendMail({
    from,
    to: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

export async function sendMail(opts: SendMailOptions): Promise<void> {
  const cfg = await getEmailConfig();
  if (cfg.provider === 'resend') {
    return sendViaResend(cfg, opts);
  }
  return sendViaSmtp(cfg, opts);
}
