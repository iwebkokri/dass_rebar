// The emailer. ONE entry point — notifyLead(submissionId) — is called from the single place a lead is saved (POST /api/forms), so
// every lead type (contact, quote, calculator, newsletter, custom forms, forms inside popups) is emailed the same way.
//
//   * The submission is stored first; email never blocks or fails it.
//   * Every message is a row in mail_log. The body is rebuilt from the submission whenever it is (re)sent, so a retry or a manual
//     "Resend" sends the same designed email. Failures are retried automatically (+1 min, +10 min), then left for "Resend".
//   * From = "<Customer name> via <Site name>" on YOUR authenticated address (so SPF / DKIM / DMARC pass); Reply-To = the customer's
//     address, so pressing Reply — for the owner or anybody on the team — writes straight to the customer.
import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import { all, get, run } from './db';
import { renderAutoReply, renderOwnerEmail, sampleAutoReply, sampleLead, type LeadField, type LeadView, type SiteView } from './email-template';
import { DEFAULT_AUTOREPLY_SUBJECT } from './forms-shared';
import { getFormBySlug, type StoredForm } from './forms';
import { cleanDisplayName, cleanHeader, mergeTags, parseEmailList, tidySubject, validEmail } from './mail-util';
import { getMailConfig, getTemplateSettings, type MailConfig } from './mail-settings';
import { getSiteSettings } from './settings';
import { NOT_READY_MESSAGE, dbReady, noteNotReady } from './schema-ready';
import { publicBase, rememberOrigin } from './site-origin';

export type MailKind = 'owner' | 'autoreply' | 'test';
export type MailLogRow = {
  id: number; submission_id: number | null; kind: MailKind; to_addr: string; subject: string;
  status: 'queued' | 'sent' | 'failed'; error: string; attempts: number; next_attempt_at: string | null; created_at: string; sent_at: string | null;
};
type SubRow = {
  id: number; type: string; name: string; email: string; phone: string; company: string; message: string; data: string;
  attachments: string; created_at: string; source_url: string; source_label: string; attribution: string;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [60_000, 10 * 60_000]; // after attempt 1, after attempt 2
const SEND_TIMEOUT = 30_000;

const g = globalThis as unknown as { __dassMail?: { timers: Map<number, ReturnType<typeof setTimeout>>; inFlight: Set<number>; resumed: boolean; origin: string } };
const state = () => (g.__dassMail ??= { timers: new Map(), inFlight: new Set(), resumed: false, origin: '' });

const utc = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const parseUtc = (s: string) => Date.parse(`${s.replace(' ', 'T')}Z`);
const json = <T,>(s: string, fallback: T): T => {
  try {
    return (JSON.parse(s) as T) ?? fallback;
  } catch {
    return fallback;
  }
};

// ------------------------------------------------------------------ the site, as the email shows it
export function buildSiteView(cfg: MailConfig, originHint?: string): SiteView {
  const base = publicBase(originHint);
  const tpl = getTemplateSettings();
  const s = getSiteSettings();
  const abs = (u: string) => (/^https?:\/\//i.test(u) ? u : base && u.startsWith('/') ? base + u : '');
  return {
    name: cfg.siteName,
    base,
    logoUrl: abs(tpl.logo) || abs('/images/logo-rebar-white.png'),
    accent: tpl.accent,
    footer: tpl.footer,
    address: s.contact_address,
    phone: s.contact_phone,
    email: s.contact_email,
    timezone: cfg.timezone,
  };
}

// ------------------------------------------------------------------ a submission as email content
const BUILT_IN: Record<string, string> = { contact: 'Contact', quote: 'Quote', calculator: 'Calculator', newsletter: 'Newsletter' };

function leadFields(row: SubRow, data: Record<string, any>): LeadField[] {
  const f: LeadField[] = [];
  const add = (label: string, value: unknown, long = false) => {
    const v = value === undefined || value === null ? '' : String(value).trim();
    if (v) f.push({ label, value: v, long: long || v.includes('\n') || v.length > 120 });
  };
  switch (row.type) {
    case 'contact':
      add('Name', row.name); add('Email', row.email); add('Phone', row.phone); add('Company', row.company);
      add('Message', row.message, true);
      if ('newsletter_consent' in data) add('Newsletter', data.newsletter_consent ? 'Yes — agreed to receive updates' : 'No');
      break;
    case 'quote': {
      add('Name', row.name); add('Email', row.email); add('Phone', row.phone); add('Company', row.company);
      add('Project location', data.project_location); add('Sector', data.sector); add('Need', data.need); add('Existing customer', data.existing_customer);
      if (Array.isArray(data.items) && data.items.length) add('Materials', data.items.map((i: any) => `• ${i.label} × ${i.qty}`).join('\n'), true);
      add('Other items', data.other_items, true);
      add('Notes', row.message, true);
      break;
    }
    case 'calculator':
      add('Name', row.name); add('Email', row.email); add('Phone', row.phone);
      add('Bar size', data.size); add('Length', data.length_m ? `${data.length_m} m` : ''); add('Number of bars', data.bars);
      add('Estimated weight', data.total_kg ? `${Number(data.total_kg).toLocaleString('en-CA')} kg` : '');
      break;
    case 'newsletter':
      add('Email', row.email);
      break;
    default:
      // custom forms: every answer, in the order of the form
      for (const [k, v] of Object.entries(data)) add(k, v, false);
  }
  return f;
}

type Loaded = { row: SubRow; def: StoredForm | undefined; view: LeadView; formName: string; kindLabel: string; values: Record<string, string> };

function loadLead(submissionId: number, cfg: MailConfig, site: SiteView): Loaded | null {
  const row = get<SubRow>('SELECT * FROM submissions WHERE id = ?', submissionId);
  if (!row) return null;
  const def = row.type.startsWith('form:') ? getFormBySlug(row.type.slice(5)) : undefined;
  const formName = BUILT_IN[row.type] ?? def?.name ?? row.type.replace(/^form:/, '');
  const kindLabel = BUILT_IN[row.type] ?? formName;
  const data = json<Record<string, any>>(row.data, {});
  const files = json<Array<{ name?: string }>>(row.attachments, []).map((a) => String(a?.name ?? '')).filter(Boolean);
  const path = /^\/(?!\/)/.test(row.source_url) ? row.source_url : '';
  const view: LeadView = {
    kindLabel,
    formName,
    submissionId: row.id,
    customer: { name: row.name, email: row.email, phone: row.phone, company: row.company },
    fields: leadFields(row, data),
    files,
    sourceUrl: path && site.base ? site.base + path : '',
    sourceLabel: row.source_label || path,
    when: new Date(parseUtc(row.created_at) || Date.now()),
    cmsUrl: site.base ? `${site.base}/admin/submissions/${row.id}` : '',
    campaign: (() => {
      const a = json<Record<string, string>>(row.attribution || '{}', {});
      return [a.utm_source, a.utm_medium, a.utm_campaign].filter(Boolean).join(' / ');
    })(),
  };
  const clean = (v: string) => cleanHeader(v, 120);
  const values = {
    form: clean(formName), name: clean(row.name) || clean(row.email), email: clean(row.email), phone: clean(row.phone), company: clean(row.company),
    type: clean(kindLabel), site: clean(cfg.siteName), id: String(row.id),
  };
  return { row, def, view, formName, kindLabel, values };
}

// ------------------------------------------------------------------ building the messages
const fromHeader = (cfg: MailConfig, customerName: string) => ({
  name: `${cleanDisplayName(customerName, 40) || 'A visitor'} via ${cleanDisplayName(cfg.siteName, 40) || 'your website'}`,
  address: cfg.fromEmail,
});

function ownerSubject(cfg: MailConfig, l: Loaded): string {
  const template = cleanHeader(l.def?.settings.notifySubject || cfg.subject, 200) || 'New lead — {form} — {name}';
  return tidySubject(mergeTags(template, l.values)) || `New lead — ${l.formName}`;
}

function ownerMessage(cfg: MailConfig, site: SiteView, l: Loaded, to: string[]): Mail.Options {
  const r = renderOwnerEmail(site, l.view);
  return {
    from: fromHeader(cfg, l.row.name),
    to,
    replyTo: validEmail(l.row.email) ? l.row.email : undefined, // the customer: Reply goes straight to them
    subject: ownerSubject(cfg, l),
    html: r.html,
    text: r.text,
    headers: { 'X-Lead-Id': String(l.row.id), 'X-Lead-Source': cleanHeader(l.kindLabel, 60) },
  };
}

function autoReplyMessage(cfg: MailConfig, site: SiteView, l: Loaded, owner: string | undefined): Mail.Options {
  const first = cleanHeader(l.row.name, 80).split(' ')[0] || '';
  const vals = { ...l.values, name: cleanHeader(l.row.name, 120) || 'there', first_name: first || 'there' };
  const subject = tidySubject(mergeTags(l.def?.settings.autoReplySubject || DEFAULT_AUTOREPLY_SUBJECT, vals, '{{}}')) || `We received your message — ${cfg.siteName}`;
  const message = mergeTags((l.def?.settings.autoReplyBody || getTemplateSettings().autoReplyIntro).replace(/\r\n?/g, '\n'), vals, '{{}}');
  const r = renderAutoReply(site, { customerName: l.row.name, formName: l.formName, message, recap: l.view.fields, when: l.view.when });
  return {
    from: { name: cleanDisplayName(cfg.siteName, 60) || 'Website', address: cfg.fromEmail },
    to: l.row.email,
    replyTo: owner && validEmail(owner) ? owner : undefined,
    subject,
    html: r.html,
    text: r.text,
    headers: { 'Auto-Submitted': 'auto-replied', 'X-Auto-Response-Suppress': 'All' },
  };
}

function testMessage(cfg: MailConfig, site: SiteView, to: string[], kind: 'owner' | 'autoreply'): Mail.Options {
  const lead = { ...sampleLead(site), notice: 'This is a TEST message sent from the Email page of your website — no customer wrote it. Reply-To is set to the sample customer, exactly as it will be for real leads.' };
  if (kind === 'autoreply') {
    const intro = getTemplateSettings().autoReplyIntro;
    const r = renderAutoReply(site, { ...sampleAutoReply(site, intro), notice: 'This is a TEST of the customer auto-reply — real customers do not see this line.' });
    return { from: { name: cleanDisplayName(cfg.siteName, 60) || 'Website', address: cfg.fromEmail }, to, replyTo: to[0], subject: `Test — We received your message — ${cleanHeader(cfg.siteName, 60)}`, html: r.html, text: r.text, headers: { 'Auto-Submitted': 'auto-generated' } };
  }
  const r = renderOwnerEmail(site, lead);
  return {
    from: fromHeader(cfg, lead.customer.name),
    to,
    replyTo: lead.customer.email,
    subject: `Test — New lead — ${lead.formName} — ${lead.customer.name}`,
    html: r.html,
    text: r.text,
    headers: { 'Auto-Submitted': 'auto-generated' },
  };
}

// ------------------------------------------------------------------ sending
function describeError(err: unknown, secret: string): string {
  const e = err as { message?: string; code?: string; response?: string };
  let m = String(e?.message || err || 'Unknown error');
  if (e?.response && !m.includes(String(e.response))) m += ` — ${e.response}`;
  if (e?.code && !m.includes(e.code)) m += ` (${e.code})`;
  if (secret && secret.length >= 3) m = m.split(secret).join('••••');
  return m.replace(/\s+/g, ' ').slice(0, 500);
}

async function smtpSend(cfg: MailConfig, msg: Mail.Options): Promise<{ ok: boolean; error?: string }> {
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.security === 'ssl',
    requireTLS: cfg.security === 'starttls',
    ignoreTLS: cfg.security === 'none',
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      transport.sendMail(msg),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timed out waiting for the mail server (30 s).')), SEND_TIMEOUT); }),
    ]);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: describeError(err, cfg.pass) };
  } finally {
    if (timer) clearTimeout(timer);
    transport.close();
  }
}

// ------------------------------------------------------------------ the log + delivery
function addLog(submissionId: number | null, kind: MailKind, to: string[], subject: string): number {
  return run('INSERT INTO mail_log (submission_id, kind, to_addr, subject) VALUES (?, ?, ?, ?)', submissionId, kind, to.join(', ').slice(0, 500), subject.slice(0, 300)).lastInsertRowid;
}

/** Where a customer's answer to the auto-reply should land: the form's own recipient, else the first site-wide owner address. */
const ownerAddress = (cfg: MailConfig, l: Loaded): string | undefined => parseEmailList(l.def?.settings.notifyEmails || '')[0] || cfg.to[0];

function build(row: MailLogRow, cfg: MailConfig): { msg: Mail.Options } | { error: string } {
  const site = buildSiteView(cfg);
  const to = parseEmailList(row.to_addr);
  if (!to.length) return { error: 'There is no valid recipient address.' };
  if (row.kind === 'test') return { msg: testMessage(cfg, site, to, row.subject.startsWith('Test — We received') ? 'autoreply' : 'owner') };
  const l = row.submission_id ? loadLead(row.submission_id, cfg, site) : null;
  if (!l) return { error: 'The submission no longer exists.' };
  if (row.kind === 'autoreply') return { msg: autoReplyMessage(cfg, site, l, ownerAddress(cfg, l)) };
  return { msg: ownerMessage(cfg, site, l, to) };
}

/** Send (or re-send) one log row. Never throws. */
export async function deliver(logId: number): Promise<{ ok: boolean; error?: string }> {
  const st = state();
  if (st.inFlight.has(logId)) return { ok: false, error: 'Already sending.' };
  const row = get<MailLogRow>('SELECT * FROM mail_log WHERE id = ?', logId);
  if (!row) return { ok: false, error: 'Not found.' };
  if (row.status === 'sent') return { ok: true };
  st.inFlight.add(logId);
  const t = st.timers.get(logId);
  if (t) { clearTimeout(t); st.timers.delete(logId); }
  try {
    const attempts = row.attempts + 1;
    run("UPDATE mail_log SET attempts = ?, status = 'queued', next_attempt_at = NULL WHERE id = ?", attempts, logId);
    const cfg = getMailConfig();
    let error = '';
    let final = false;
    if (!cfg.sendable) {
      error = `Email is not set up: ${cfg.problems.filter((p) => !/lead notifications/.test(p))[0] || 'no mail server is configured.'}`;
      final = true; // nothing to retry until the owner sets it up — "Resend" works afterwards
    } else {
      const built = build(row, cfg);
      if ('error' in built) { error = built.error; final = true; }
      else {
        const sent = await smtpSend(cfg, built.msg);
        if (sent.ok) {
          run("UPDATE mail_log SET status = 'sent', error = '', next_attempt_at = NULL, sent_at = ? WHERE id = ?", utc(), logId);
          return { ok: true };
        }
        error = sent.error || 'Unknown error';
        final = row.kind === 'test' || attempts >= MAX_ATTEMPTS;
      }
    }
    if (final) {
      run("UPDATE mail_log SET status = 'failed', error = ?, next_attempt_at = NULL WHERE id = ?", error, logId);
    } else {
      const delay = RETRY_DELAYS[Math.min(attempts - 1, RETRY_DELAYS.length - 1)];
      run("UPDATE mail_log SET status = 'failed', error = ?, next_attempt_at = ? WHERE id = ?", error, utc(Date.now() + delay), logId);
      scheduleRetry(logId, delay);
    }
    console.error(`[mail] ${row.kind} #${logId} attempt ${attempts} failed${final ? '' : ' (will retry)'}: ${error}`);
    return { ok: false, error };
  } catch (err) {
    const error = describeError(err, '');
    run("UPDATE mail_log SET status = 'failed', error = ? WHERE id = ?", error, logId);
    return { ok: false, error };
  } finally {
    st.inFlight.delete(logId);
  }
}

function scheduleRetry(logId: number, delay: number) {
  const st = state();
  const old = st.timers.get(logId);
  if (old) clearTimeout(old);
  const t = setTimeout(() => { st.timers.delete(logId); void deliver(logId); }, Math.max(0, delay));
  (t as unknown as { unref?: () => void }).unref?.();
  st.timers.set(logId, t);
}

/** After a restart, pick up emails that were waiting for a retry (called lazily: first lead / first visit to the Email page). */
export function resumeRetries() {
  const st = state();
  if (st.resumed || !dbReady()) return; // not migrated yet (or already done)
  st.resumed = true;
  try {
    const rows = all<MailLogRow>("SELECT * FROM mail_log WHERE (status = 'failed' AND next_attempt_at IS NOT NULL) OR (status = 'queued' AND created_at < ?)", utc(Date.now() - 120_000));
    for (const r of rows) scheduleRetry(r.id, r.next_attempt_at ? parseUtc(r.next_attempt_at) - Date.now() : 0);
  } catch {
    /* table missing on a half-migrated database: nothing to resume */
  }
}

// ------------------------------------------------------------------ public API
/** Called once per saved lead. Never throws; never blocks the visitor (the route runs it after the response). */
export async function notifyLead(submissionId: number, requestOrigin?: string): Promise<void> {
  try {
    if (!dbReady()) { noteNotReady('lead email'); return; } // the lead itself is already saved; the email log needs the new tables
    rememberOrigin(requestOrigin);
    resumeRetries();
    const cfg = getMailConfig();
    const site = buildSiteView(cfg);
    const l = loadLead(submissionId, cfg, site);
    if (!l) return;

    const ids: number[] = [];
    if (l.def?.settings.notify !== false) {
      const own = parseEmailList(l.def?.settings.notifyEmails || '');
      const to = own.length ? own : cfg.to;
      if (to.length) ids.push(addLog(submissionId, 'owner', to, ownerSubject(cfg, l)));
      else {
        // nothing to send to: keep a log row so the owner sees which leads were not emailed (and can Resend after setting it up)
        const id = addLog(submissionId, 'owner', [], ownerSubject(cfg, l));
        const why = cfg.sendable ? 'No address is set to receive lead notifications (Email page).' : `Email is not set up: ${cfg.problems[0] || 'no mail server is configured.'}`;
        run("UPDATE mail_log SET status = 'failed', error = ? WHERE id = ?", why, id);
      }
    }
    if (l.def?.settings.autoReply && validEmail(l.row.email)) {
      const msg = autoReplyMessage(cfg, site, l, ownerAddress(cfg, l));
      ids.push(addLog(submissionId, 'autoreply', [l.row.email], String(msg.subject || '')));
    }
    for (const id of ids) await deliver(id); // sequential: the owner's email first
  } catch (err) {
    console.error('[mail] notifyLead failed:', err instanceof Error ? err.message : err);
  }
}

/** A plain heads-up to the owner that is not a lead (e.g. a blog comment waiting for moderation). Silent when mail isn't set up. */
export async function sendSystemNotice(subject: string, text: string, replyTo?: string): Promise<void> {
  const cfg = getMailConfig();
  if (!cfg.sendable || !cfg.to.length) return;
  const r = await smtpSend(cfg, {
    from: { name: cleanDisplayName(cfg.siteName, 60) || 'Website', address: cfg.fromEmail },
    to: cfg.to,
    replyTo: replyTo && validEmail(replyTo) ? replyTo : undefined,
    subject: cleanHeader(subject, 200),
    text,
  });
  if (!r.ok) console.error('[mail] system notice failed:', r.error);
}

/** "Send test email": sends the designed template with sample data and reports the exact error. */
export async function sendTestEmail(to: string[], kind: 'owner' | 'autoreply' = 'owner', requestOrigin?: string): Promise<{ ok: boolean; error?: string; logId: number }> {
  if (!dbReady()) return { ok: false, error: NOT_READY_MESSAGE, logId: 0 };
  rememberOrigin(requestOrigin);
  const cfg = getMailConfig();
  const subject = kind === 'autoreply' ? `Test — We received your message — ${cfg.siteName}` : `Test — New lead — Quote request — Jordan Rivera`;
  const logId = addLog(null, 'test', to, subject);
  const r = await deliver(logId);
  return { ...r, logId };
}

export async function resendMail(logId: number, requestOrigin?: string): Promise<{ ok: boolean; error?: string }> {
  if (!dbReady()) return { ok: false, error: NOT_READY_MESSAGE };
  rememberOrigin(requestOrigin);
  const st = state();
  const t = st.timers.get(logId);
  if (t) { clearTimeout(t); st.timers.delete(logId); }
  run("UPDATE mail_log SET attempts = 0, status = 'queued', error = '', next_attempt_at = NULL WHERE id = ? AND status <> 'sent'", logId);
  return deliver(logId);
}

export function listMailLog(opts: { status?: string; limit?: number; offset?: number } = {}): { rows: MailLogRow[]; total: number } {
  if (!dbReady()) return { rows: [], total: 0 };
  const where = opts.status === 'sent' || opts.status === 'failed' || opts.status === 'queued' ? 'WHERE status = ?' : '';
  const params = where ? [opts.status as string] : [];
  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM mail_log ${where}`, ...params)?.c ?? 0;
  const rows = all<MailLogRow>(`SELECT * FROM mail_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, ...params, opts.limit ?? 50, opts.offset ?? 0);
  return { rows, total };
}

/** For the Email page + dashboard banners. Safe on a database that hasn't been migrated yet. */
export function mailStatus(): { configured: boolean; sendable: boolean; problems: string[]; source: string; failed: number; retrying: number; to: string[] } {
  const cfg = getMailConfig();
  let failed = 0, retrying = 0;
  try {
    failed = get<{ c: number }>("SELECT COUNT(*) AS c FROM mail_log WHERE status = 'failed' AND next_attempt_at IS NULL AND created_at > ?", utc(Date.now() - 7 * 86400_000))?.c ?? 0;
    retrying = get<{ c: number }>("SELECT COUNT(*) AS c FROM mail_log WHERE status = 'failed' AND next_attempt_at IS NOT NULL")?.c ?? 0;
  } catch { /* ignore */ }
  return { configured: cfg.configured, sendable: cfg.sendable, problems: cfg.problems, source: cfg.source, failed, retrying, to: cfg.to };
}
