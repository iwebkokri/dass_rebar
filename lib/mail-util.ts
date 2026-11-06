// Small, dependency-free helpers shared by the email template, the mailer and the Email admin page.
// Everything that ends up in a mail HEADER (subject, display name, reply-to) must go through these.

/** Strict single-address check: no whitespace, no list separators, no angle brackets, quotes or control characters. */
const ADDR = /^[^\s@<>,;:"'()[\]\\\u0000-\u001f\u007f]+@[^\s@<>,;:"'()[\]\\\u0000-\u001f\u007f]+\.[^\s@<>,;:"'()[\]\\\u0000-\u001f\u007f]+$/;
export const validEmail = (s: unknown): s is string => typeof s === 'string' && s.length <= 254 && ADDR.test(s);

/** Split "a@x.com, b@y.com; c@z.com" and keep only the valid, de-duplicated addresses (lower-cased domain part untouched). */
export function parseEmailList(v: string): string[] {
  const out: string[] = [];
  for (const raw of String(v || '').split(/[\s,;]+/)) {
    const s = raw.trim();
    if (validEmail(s) && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
  }
  return out;
}

/** Anything between the separators that isn't a valid address (for the "x is not a valid email" message). */
export const firstInvalidEmail = (v: string): string | undefined => String(v || '').split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).find((s) => !validEmail(s));

/** One line of header text: control characters (CR/LF/NUL/…) become spaces, whitespace collapses, length is capped. */
export function cleanHeader(s: unknown, max = 200): string {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * A display name that is safe in a From header: single line, no angle brackets / quotes / backslashes, and nothing that looks
 * like an e-mail address inside it (mail filters treat "someone@bank.com <you@yours.com>" as phishing).
 */
export function cleanDisplayName(s: unknown, max = 60): string {
  const t = cleanHeader(s, 300)
    .replace(/[<>"\\]/g, '')
    .split(' ')
    .filter((w) => !w.includes('@'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return t.slice(0, max).trim();
}

export const esc = (v: unknown): string =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Escaped text with line breaks kept (Outlook ignores white-space: pre-wrap, so use <br>). */
export const escBr = (v: unknown): string => esc(String(v ?? '').replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>');

export const isHex = (s: unknown): s is string => typeof s === 'string' && /^#[0-9a-fA-F]{6}$/.test(s);

/** Button colour of the email design (brand brown); editable on the Email page. */
export const DEFAULT_ACCENT = '#7F5F47';

/** Absolute http(s) / mailto / tel URL or ''. (Used for every href in an email.) */
export function mailUrl(u: unknown): string {
  const s = String(u ?? '').trim();
  if (!s || s.length > 2000 || /[\u0000-\u001f\u007f<>"'\\\s]/.test(s)) return '';
  return /^(https?:\/\/|mailto:|tel:)/i.test(s) ? s : '';
}

/** Does this IANA time zone exist? */
export function validTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "{form} — {name}" style templates: unknown tags are left alone, empty values vanish together with their dash separators. */
export function mergeTags(template: string, values: Record<string, string>, brace: '{}' | '{{}}' = '{}'): string {
  const re = brace === '{}' ? /\{(\w+)\}/g : /\{\{(\w+)\}\}/g;
  return template.replace(re, (m, k: string) => (k in values ? values[k] : m));
}

/** Tidy a subject after merging: drop empty "— —" segments left by blank merge values. */
export function tidySubject(s: string): string {
  const line = cleanHeader(s, 400).replace(/^[—–-]\s+/, '');
  return line.split(/\s+[—–-](?:\s+|$)/).map((p) => p.trim()).filter(Boolean).join(' — ').slice(0, 200);
}
