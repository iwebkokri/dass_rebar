'use server';

// Email page actions (administrators only). Every action starts with requireCap — actions are public HTTP endpoints.
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { getMailConfig, saveMailConnection, saveMailTemplate } from '@/lib/mail-settings';
import { firstInvalidEmail, parseEmailList } from '@/lib/mail-util';
import { resendMail, sendTestEmail } from '@/lib/mailer';

const text = (fd: FormData, key: string, max: number) => String(fd.get(key) ?? '').replace(/\u0000/g, '').slice(0, max);

function go(tab: string, params: Record<string, string>): never {
  const qs = new URLSearchParams({ tab, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) }).toString();
  redirect(`/admin/email?${qs}`);
}

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');
  if (!host) return '';
  return `${h.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https')}://${host}`;
}

export async function saveMailSettings(fd: FormData) {
  const user = await requireCap('manage_email');
  const r = saveMailConnection({
    preset: text(fd, 'preset', 30),
    host: text(fd, 'host', 253),
    port: text(fd, 'port', 6),
    security: text(fd, 'security', 10),
    user: text(fd, 'user', 254),
    password: text(fd, 'password', 500), // blank = keep the saved one
    clearPassword: fd.get('clear_password') === '1',
    fromName: text(fd, 'from_name', 60),
    fromEmail: text(fd, 'from_email', 254),
    notifyEmails: text(fd, 'notify_emails', 1000),
    siteUrl: text(fd, 'site_url', 300),
    timezone: text(fd, 'timezone', 60),
    subject: text(fd, 'subject', 200),
  });
  if (!r.ok) go('settings', { error: r.error });
  logActivity(user, 'update', 'email', 0, 'Email settings');
  revalidatePath('/admin', 'layout');
  go('settings', { ok: 'Email settings saved. Use “Send test email” to check that they work.' });
}

export async function saveMailDesign(fd: FormData) {
  const user = await requireCap('manage_email');
  const r = saveMailTemplate({
    logo: text(fd, 'logo', 500),
    accent: text(fd, 'accent', 7),
    footer: text(fd, 'footer', 300),
    autoReplyIntro: text(fd, 'auto_reply_intro', 600),
  });
  if (!r.ok) go('design', { error: r.error });
  logActivity(user, 'update', 'email', 0, 'Email design');
  go('design', { ok: 'Email design saved.' });
}

export async function sendTest(fd: FormData) {
  await requireCap('manage_email');
  const cfg = getMailConfig();
  const raw = text(fd, 'to', 500).trim();
  const bad = raw ? firstInvalidEmail(raw) : undefined;
  if (bad) go('settings', { error: `“${bad.slice(0, 60)}” is not a valid email address.` });
  const to = raw ? parseEmailList(raw) : cfg.to;
  if (!to.length) go('settings', { error: 'Enter an address to send the test to, or save the owner notification address first.' });
  const kind = fd.get('kind') === 'autoreply' ? 'autoreply' : 'owner';
  const r = await sendTestEmail(to, kind, await requestOrigin());
  if (r.ok) go('settings', { ok: `Test email sent to ${to.join(', ')}. Check the inbox (and the spam folder the first time).` });
  go('settings', { error: `The test email could not be sent: ${r.error || 'unknown error'}` });
}

export async function resendLog(fd: FormData) {
  await requireCap('manage_email');
  const id = Number(fd.get('id'));
  if (!Number.isInteger(id) || id < 1) go('log', { error: 'Unknown email.' });
  const r = await resendMail(id, await requestOrigin());
  const back = text(fd, 'status', 10);
  const extra = back === 'sent' || back === 'failed' ? { status: back } : {};
  if (r.ok) go('log', { ...extra, ok: 'Sent.' });
  go('log', { ...extra, error: `Still failing: ${r.error || 'unknown error'}` });
}
