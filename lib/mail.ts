import nodemailer from 'nodemailer';
import { getSetting } from './db';

/**
 * Email notifications for new form submissions. Optional: if SMTP isn't configured the submission is
 * still saved in the Studio CMS and shows up under "Submissions" — nothing is lost.
 *
 * Environment (use your Hostinger mailbox):
 *   SMTP_HOST=smtp.hostinger.com  SMTP_PORT=465  SMTP_USER=forms@yourdomain.com  SMTP_PASS=…  MAIL_FROM="Dass Rebar <forms@yourdomain.com>"
 * Recipients: Studio CMS > Settings > "Send new submissions to" (or NOTIFY_EMAIL in the environment).
 */
export function notifyRecipients(): string[] {
  return (getSetting('notify_emails') || process.env.NOTIFY_EMAIL || '')
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

/** `recipients` overrides the global list (custom forms can have their own); empty/omitted = the global recipients. */
export async function sendNotification(subject: string, text: string, replyTo?: string, recipients?: string[]): Promise<void> {
  const to = recipients && recipients.length ? recipients : notifyRecipients();
  const host = process.env.SMTP_HOST;
  if (!to.length || !host) {
    console.log(`[mail] not sent (${!host ? 'SMTP_HOST not set' : 'no recipients in Settings'}): ${subject}`);
    return;
  }
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      replyTo: replyTo || undefined,
    });
  } catch (err) {
    // A mail failure must never lose or fail the submission — it is already saved.
    console.error('[mail] failed to send notification:', err instanceof Error ? err.message : err);
  }
}
