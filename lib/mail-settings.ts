// Mail configuration: what is stored (settings table, keys smtp_* + the existing notify_emails), how the SMTP password is
// encrypted, and the EFFECTIVE values used for sending (Email page first, then the old SMTP_* / NOTIFY_EMAIL environment variables).
//
// Every smtp_* key matches SECRET_KEY in lib/settings.ts, so none of it is ever included in an export.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDataDir } from './db-core.mjs';
import { getSetting, setSetting } from './db';
import { SITE_DEFAULTS, getSiteSettings } from './settings';
import { safeUrl } from './builder/url.mjs';
import type { MailSecurity } from './mail-presets';
import { DEFAULT_ACCENT, cleanHeader, firstInvalidEmail, isHex, parseEmailList, validEmail, validTimeZone } from './mail-util';

export const DEFAULT_TZ = 'America/Toronto';
export const DEFAULT_SUBJECT = 'New lead — {form} — {name}';
export const DEFAULT_AUTOREPLY_INTRO = 'Thank you for getting in touch. We have received your message and a member of our team will get back to you shortly.';

// ------------------------------------------------------------------ password encryption (AES-256-GCM)
function secretKey(): Buffer {
  const env = process.env.APP_SECRET || process.env.SECRET_KEY;
  if (env && env.length >= 8) return createHash('sha256').update(`dassrebar:mail:${env}`).digest();
  const dir = path.join(getDataDir(), 'private');
  const file = path.join(dir, 'mail.key');
  const read = () => {
    try {
      const b = Buffer.from(readFileSync(file, 'utf8').trim(), 'hex');
      return b.length === 32 ? b : null;
    } catch {
      return null;
    }
  };
  const existing = read();
  if (existing) return existing;
  mkdirSync(dir, { recursive: true });
  const k = randomBytes(32);
  try {
    writeFileSync(file, k.toString('hex'), { mode: 0o600, flag: 'wx' });
    return k;
  } catch {
    return read() ?? k; // another request created it first
  }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', secretKey(), iv);
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}

/** '' when it can't be decrypted (key file lost / APP_SECRET changed) — the Email page then asks for the password again. */
export function decryptSecret(blob: string): string {
  const [v, iv, tag, ct] = String(blob || '').split(':');
  if (v !== 'v1' || !iv || !tag || !ct) return '';
  try {
    const d = createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// ------------------------------------------------------------------ stored values
export type MailStored = {
  preset: string; host: string; port: string; security: MailSecurity; user: string; hasPassword: boolean; passwordUnreadable: boolean;
  fromName: string; fromEmail: string; notifyEmails: string; siteUrl: string; timezone: string; subject: string;
  logo: string; accent: string; footer: string; autoReplyIntro: string;
};

const secureOf = (v: string): MailSecurity => (v === 'ssl' || v === 'starttls' || v === 'none' ? v : 'ssl');

export function getMailStored(): MailStored {
  const enc = getSetting('smtp_pass_enc');
  return {
    preset: getSetting('smtp_preset') || 'custom',
    host: getSetting('smtp_host'),
    port: getSetting('smtp_port'),
    security: secureOf(getSetting('smtp_security')),
    user: getSetting('smtp_user'),
    hasPassword: !!enc,
    passwordUnreadable: !!enc && !decryptSecret(enc),
    fromName: getSetting('smtp_from_name'),
    fromEmail: getSetting('smtp_from_email'),
    notifyEmails: getSetting('notify_emails'),
    siteUrl: getSetting('smtp_site_url'),
    timezone: getSetting('smtp_timezone'),
    subject: getSetting('smtp_subject'),
    logo: getSetting('smtp_tpl_logo'),
    accent: getSetting('smtp_tpl_accent'),
    footer: getSetting('smtp_tpl_footer'),
    autoReplyIntro: getSetting('smtp_tpl_autoreply_intro'),
  };
}

// ------------------------------------------------------------------ effective configuration
export type MailConfig = {
  source: 'admin' | 'env' | 'none';
  host: string; port: number; security: MailSecurity; user: string; pass: string;
  fromName: string; fromEmail: string;
  /** Where every lead notification goes (the Email page, else NOTIFY_EMAIL). */
  to: string[];
  siteName: string;
  timezone: string;
  subject: string;
  /** A mail server and a valid From address (and a readable password when a login is set) — enough to send to ANY recipient. */
  sendable: boolean;
  /** Everything needed to notify the owner is present (sendable + at least one owner address). */
  configured: boolean;
  /** Human-readable reasons it is not (shown on the Email page and the dashboard). */
  problems: string[];
  passwordUnreadable: boolean;
};

/** "Dass Rebar <leads@x.com>" or a bare address → { name, email } */
export function parseFrom(v: string): { name: string; email: string } {
  const s = String(v || '').trim();
  const m = /^"?([^"<]*?)"?\s*<([^<>\s]+)>$/.exec(s);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { name: '', email: s };
}

const portOf = (v: string | number | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : fallback;
};

export function siteNameSetting(): string {
  return getSiteSettings().site_title || SITE_DEFAULTS.title;
}

export function getMailConfig(): MailConfig {
  const st = getMailStored();
  const env = process.env;
  const useAdmin = !!st.host;
  const useEnv = !useAdmin && !!env.SMTP_HOST;

  let host = '', port = 465, security: MailSecurity = 'ssl', user = '', pass = '', fromName = '', fromEmail = '';
  if (useAdmin) {
    host = st.host;
    port = portOf(st.port, st.security === 'ssl' ? 465 : 587);
    security = st.security;
    user = st.user;
    pass = st.hasPassword ? decryptSecret(getSetting('smtp_pass_enc')) : '';
    fromName = st.fromName;
    fromEmail = st.fromEmail;
  } else if (useEnv) {
    host = env.SMTP_HOST || '';
    port = portOf(env.SMTP_PORT, 465);
    security = env.SMTP_SECURE ? (env.SMTP_SECURE === 'true' ? 'ssl' : 'starttls') : port === 465 ? 'ssl' : port === 25 ? 'none' : 'starttls';
    user = env.SMTP_USER || '';
    pass = env.SMTP_PASS || '';
    const f = parseFrom(env.MAIL_FROM || '');
    fromName = f.name;
    fromEmail = f.email;
  }
  if (!fromEmail && validEmail(user)) fromEmail = user; // a mailbox login is almost always also the sending address

  const to = parseEmailList(st.notifyEmails || env.NOTIFY_EMAIL || '');
  const siteName = siteNameSetting();
  const problems: string[] = [];
  if (!host) problems.push('No mail server is set up (SMTP host).');
  if (host && !validEmail(fromEmail)) problems.push('No valid From address is set.');
  if (!to.length) problems.push('No address is set to receive lead notifications.');
  if (useAdmin && st.passwordUnreadable) problems.push('The saved SMTP password can no longer be read on this server — enter it again.');
  if (useAdmin && user && !pass && !st.passwordUnreadable) problems.push('A username is set but no password is saved.');

  const sendable = !!host && validEmail(fromEmail) && !(useAdmin && st.passwordUnreadable) && !(useAdmin && !!user && !pass);

  return {
    source: useAdmin ? 'admin' : useEnv ? 'env' : 'none',
    host, port, security, user, pass,
    fromName: fromName || siteName,
    fromEmail,
    to,
    siteName,
    timezone: st.timezone && validTimeZone(st.timezone) ? st.timezone : DEFAULT_TZ,
    subject: st.subject || DEFAULT_SUBJECT,
    sendable,
    configured: problems.length === 0,
    problems,
    passwordUnreadable: st.passwordUnreadable,
  };
}

/** Public address of the site for links inside emails. Email-page setting → SITE_URL → the request's own origin (dev only). */
export function siteBase(requestOrigin?: string): string {
  for (const c of [getSetting('smtp_site_url'), process.env.SITE_URL, requestOrigin]) {
    const u = (c || '').trim().replace(/\/+$/, '');
    if (/^https?:\/\/[^\s/]+$/i.test(u)) return u;
    const m = /^(https?:\/\/[^\s/]+)(\/.*)?$/i.exec(u);
    if (m) return m[1];
  }
  return '';
}

export type TemplateSettings = { logo: string; accent: string; footer: string; autoReplyIntro: string };
export function getTemplateSettings(): TemplateSettings {
  const st = getMailStored();
  return {
    logo: st.logo,
    accent: isHex(st.accent) ? st.accent : DEFAULT_ACCENT,
    footer: st.footer,
    autoReplyIntro: st.autoReplyIntro || DEFAULT_AUTOREPLY_INTRO,
  };
}

// ------------------------------------------------------------------ saving (validates everything)
export type MailInput = {
  preset: string; host: string; port: string; security: string; user: string; password: string; clearPassword: boolean;
  fromName: string; fromEmail: string; notifyEmails: string; siteUrl: string; timezone: string; subject: string;
};

const HOST = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

export function saveMailConnection(i: MailInput): { ok: boolean; error?: string } {
  const host = cleanHeader(i.host, 253);
  if (host && !HOST.test(host)) return { ok: false, error: 'The mail server must be a host name like smtp.example.com.' };
  const portN = Number(i.port);
  if (i.port && (!Number.isInteger(portN) || portN < 1 || portN > 65535)) return { ok: false, error: 'The port must be a number between 1 and 65535.' };
  const security = secureOf(i.security);
  const fromEmail = cleanHeader(i.fromEmail, 254);
  if (fromEmail && !validEmail(fromEmail)) return { ok: false, error: `“${fromEmail}” is not a valid From address.` };
  const bad = firstInvalidEmail(i.notifyEmails);
  if (bad) return { ok: false, error: `“${bad.slice(0, 60)}” is not a valid email address.` };
  if (parseEmailList(i.notifyEmails).length > 10) return { ok: false, error: 'At most 10 notification addresses.' };
  const tz = cleanHeader(i.timezone, 60);
  if (tz && !validTimeZone(tz)) return { ok: false, error: `“${tz}” is not a known time zone (use a name like America/Toronto).` };
  let siteUrl = cleanHeader(i.siteUrl, 300).replace(/\/+$/, '');
  if (siteUrl && !/^https?:\/\/[^\s/]+$/i.test(siteUrl)) return { ok: false, error: 'The public site address must look like https://www.example.com (no path).' };
  const subject = cleanHeader(i.subject, 200);

  setSetting('smtp_preset', cleanHeader(i.preset, 30));
  setSetting('smtp_host', host);
  setSetting('smtp_port', host ? String(portN || (security === 'ssl' ? 465 : 587)) : '');
  setSetting('smtp_security', security);
  setSetting('smtp_user', cleanHeader(i.user, 254));
  setSetting('smtp_from_name', cleanHeader(i.fromName, 60));
  setSetting('smtp_from_email', fromEmail);
  setSetting('notify_emails', parseEmailList(i.notifyEmails).join(', '));
  setSetting('smtp_site_url', siteUrl);
  setSetting('smtp_timezone', tz);
  setSetting('smtp_subject', subject === DEFAULT_SUBJECT ? '' : subject);
  if (i.clearPassword) setSetting('smtp_pass_enc', '');
  else if (i.password) setSetting('smtp_pass_enc', encryptSecret(i.password.slice(0, 500)));
  return { ok: true };
}

export function saveMailTemplate(i: { logo: string; accent: string; footer: string; autoReplyIntro: string }): { ok: boolean; error?: string } {
  const logo = i.logo.trim();
  if (logo && !/^(\/(?!\/)|https?:\/\/)/i.test(safeUrl(logo))) return { ok: false, error: 'The logo must be an image address starting with https:// or /.' };
  const accent = i.accent.trim();
  if (accent && !isHex(accent)) return { ok: false, error: 'The accent colour must look like #7F5F47.' };
  setSetting('smtp_tpl_logo', logo);
  setSetting('smtp_tpl_accent', accent && accent.toLowerCase() !== DEFAULT_ACCENT.toLowerCase() ? accent : '');
  setSetting('smtp_tpl_footer', i.footer.replace(/\u0000/g, '').trim().slice(0, 300));
  setSetting('smtp_tpl_autoreply_intro', i.autoReplyIntro.replace(/\u0000/g, '').trim().slice(0, 600));
  return { ok: true };
}

/** Is there anything on disk that proves a key exists? (used only by tests / docs) */
export const keyFileExists = () => existsSync(path.join(getDataDir(), 'private', 'mail.key'));
