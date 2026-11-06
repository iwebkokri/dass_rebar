// Forwards every enquiry to the Lead Manager webhook, AFTER it has been saved. Independent of the owner email: one failing never
// affects the other, and neither can fail or slow the visitor's submission (the route runs both with after()).
//
//   * One POST per lead, server side, HTTPS only. `Authorization: Bearer <key>` only when a key is configured.
//   * externalId = "dassrebar-sub-<submissions.id>" on every attempt, and the log row is UNIQUE per submission, so retries / resends
//     can never create a second lead; an accepted lead is never sent again automatically.
//   * 5 s timeout. Network errors, timeouts, 5xx, 408 and 429 are retried (+1 min, +10 min, +1 h); any other 4xx / 3xx is "refused" —
//     not retried — and the vendor's response text is kept so the owner can fix the address or key.
//   * The webhook URL contains a secret token: it is redacted from everything stored, shown or logged.
import dns from 'node:dns/promises';
import { all, get, run } from './db';
import { getFormBySlug } from './forms';
import { buildLeadPayload, externalIdFor, formNameFor, type PayloadSub } from './lead-payload';
import { getLmConfig, allowInsecure, type LmConfig } from './leadmanager-settings';
import { isPrivateHost, redactSecrets } from './lm-url.mjs';
import { NOT_READY_MESSAGE, dbReady, noteNotReady } from './schema-ready';
import { publicBase, rememberOrigin } from './site-origin';

export type ForwardStatus = 'queued' | 'accepted' | 'failed' | 'skipped' | 'refused';
export type ForwardRow = {
  id: number; submission_id: number | null; kind: 'lead' | 'test'; external_id: string; form_name: string; status: ForwardStatus; reason: string;
  http_status: number | null; response: string; error: string; attempts: number; next_attempt_at: string | null; created_at: string; sent_at: string | null;
};

const TIMEOUT_MS = 5000;
const RETRY_DELAYS = [60_000, 10 * 60_000, 60 * 60_000]; // after attempt 1, 2, 3
const MAX_ATTEMPTS = RETRY_DELAYS.length + 1;

const g = globalThis as unknown as { __dassLm?: { timers: Map<number, ReturnType<typeof setTimeout>>; inFlight: Set<number>; resumed: boolean } };
const state = () => (g.__dassLm ??= { timers: new Map(), inFlight: new Set(), resumed: false });

const utc = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
const parseUtc = (s: string) => Date.parse(`${s.replace(' ', 'T')}Z`);

const redact = (text: string, cfg: Pick<LmConfig, 'url' | 'key'>) => redactSecrets(text, { url: cfg.url, key: cfg.key }).replace(/\s+/g, ' ').slice(0, 300);

// ------------------------------------------------------------------ one HTTP attempt
type Outcome = { status: 'accepted' | 'failed' | 'refused'; http?: number; response: string; error: string };

async function post(cfg: LmConfig, payload: Record<string, unknown>): Promise<Outcome> {
  const target = new URL(cfg.url);
  // DNS check: a public-looking name that resolves to a private address is refused too (unless the local-testing switch is on)
  if (!allowInsecure() && !/^[\d.]+$|^\[/.test(target.hostname)) {
    try {
      const addrs = await dns.lookup(target.hostname, { all: true });
      if (addrs.some((a) => isPrivateHost(a.address))) return { status: 'refused', response: '', error: 'The webhook address resolves to a private network address, which is not allowed.' };
    } catch {
      return { status: 'failed', response: '', error: 'The webhook host name could not be looked up (DNS).' };
    }
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (cfg.key) headers.Authorization = `Bearer ${cfg.key}`;
  let res: Response;
  try {
    res = await fetch(cfg.url, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual', cache: 'no-store' });
  } catch (err) {
    const e = err as { name?: string; message?: string; cause?: { code?: string; message?: string } };
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return { status: 'failed', response: '', error: `Timed out after ${TIMEOUT_MS / 1000} s — Lead Manager did not answer in time.` };
    const code = e?.cause?.code || e?.cause?.message || e?.message || 'network error';
    return { status: 'failed', response: '', error: `Could not reach Lead Manager (${String(code).slice(0, 120)}).` };
  }
  let text = '';
  try {
    text = (await res.text()).slice(0, 2000);
  } catch {
    /* body unreadable: the status code is what matters */
  }
  const http = res.status;
  if (http >= 200 && http < 300) {
    let ok = true;
    try {
      if (JSON.parse(text)?.ok === false) ok = false;
    } catch {
      /* not JSON: a 2xx is still a success */
    }
    return ok ? { status: 'accepted', http, response: text, error: '' } : { status: 'refused', http, response: text, error: 'Lead Manager answered but did not accept the lead.' };
  }
  if (http === 408 || http === 429 || http >= 500) return { status: 'failed', http, response: text, error: `Lead Manager answered HTTP ${http}.` };
  return { status: 'refused', http, response: text, error: http >= 300 && http < 400 ? `Lead Manager redirected the request (HTTP ${http}) — check the webhook address.` : `Lead Manager refused the lead (HTTP ${http}) — check the webhook address and API key.` };
}

// ------------------------------------------------------------------ delivery of one log row
function loadPayload(row: ForwardRow, cfg: LmConfig): Record<string, unknown> | null {
  if (row.kind === 'test') {
    const base = publicBase();
    return {
      name: 'Test Person (website test)',
      email: 'test.person@example.com',
      phone: '',
      company: '',
      message: 'This is a test lead sent from the website admin (Lead Manager → Send test lead). It can be deleted.',
      formName: 'Admin test',
      ...(base ? { pageUrl: base } : {}),
      externalId: row.external_id,
      fields: { 'Sent from': 'Studio CMS → Lead Manager → Send test lead' },
    };
  }
  const sub = row.submission_id ? get<PayloadSub>('SELECT * FROM submissions WHERE id = ?', row.submission_id) : undefined;
  if (!sub) return null;
  const def = sub.type.startsWith('form:') ? getFormBySlug(sub.type.slice(5)) : undefined;
  return buildLeadPayload(sub, def, publicBase());
}

/** Send (or re-send) one log row. Never throws. `force` = an explicit "Resend" click: also re-sends an accepted lead (safe: same externalId). */
export async function deliverForward(rowId: number, force = false): Promise<{ status: ForwardStatus; http?: number; response?: string; error?: string }> {
  const st = state();
  if (st.inFlight.has(rowId)) return { status: 'queued', error: 'Already sending.' };
  const row = get<ForwardRow>('SELECT * FROM lead_forwards WHERE id = ?', rowId);
  if (!row) return { status: 'failed', error: 'Not found.' };
  if (row.status === 'accepted' && !force) return { status: 'accepted', http: row.http_status ?? undefined, response: row.response }; // never double-send
  st.inFlight.add(rowId);
  const timer = st.timers.get(rowId);
  if (timer) { clearTimeout(timer); st.timers.delete(rowId); }
  const cfg = getLmConfig();
  try {
    if (!cfg.configured) {
      const error = cfg.problems[0] || 'Lead Manager is not set up.';
      run("UPDATE lead_forwards SET status = 'failed', error = ?, next_attempt_at = NULL WHERE id = ?", error, rowId);
      return { status: 'failed', error };
    }
    const attempts = row.attempts + 1;
    run("UPDATE lead_forwards SET status = 'queued', attempts = ?, next_attempt_at = NULL WHERE id = ?", attempts, rowId);
    const payload = loadPayload(row, cfg);
    if (!payload) {
      const error = 'The submission no longer exists.';
      run("UPDATE lead_forwards SET status = 'refused', error = ? WHERE id = ?", error, rowId);
      return { status: 'refused', error };
    }
    const out = await post(cfg, payload);
    const response = redact(out.response, cfg);
    const error = redact(out.error, cfg);
    if (out.status === 'accepted') {
      run("UPDATE lead_forwards SET status = 'accepted', http_status = ?, response = ?, error = '', reason = '', sent_at = ?, next_attempt_at = NULL WHERE id = ?", out.http ?? null, response, utc(), rowId);
    } else if (out.status === 'refused' || row.kind === 'test' || attempts >= MAX_ATTEMPTS) {
      run("UPDATE lead_forwards SET status = ?, http_status = ?, response = ?, error = ?, next_attempt_at = NULL WHERE id = ?", out.status === 'refused' ? 'refused' : 'failed', out.http ?? null, response, error, rowId);
    } else {
      const delay = RETRY_DELAYS[attempts - 1];
      run("UPDATE lead_forwards SET status = 'failed', http_status = ?, response = ?, error = ?, next_attempt_at = ? WHERE id = ?", out.http ?? null, response, error, utc(Date.now() + delay), rowId);
      scheduleRetry(rowId, delay);
    }
    if (out.status !== 'accepted') console.error(`[lead-manager] forward #${rowId} attempt ${attempts}: ${out.status}${out.http ? ` (HTTP ${out.http})` : ''}`);
    return { status: out.status, http: out.http, response, error };
  } catch (err) {
    const error = redact(err instanceof Error ? err.message : String(err), cfg);
    run("UPDATE lead_forwards SET status = 'failed', error = ? WHERE id = ?", error, rowId);
    return { status: 'failed', error };
  } finally {
    st.inFlight.delete(rowId);
  }
}

function scheduleRetry(rowId: number, delay: number) {
  const st = state();
  const old = st.timers.get(rowId);
  if (old) clearTimeout(old);
  const t = setTimeout(() => { st.timers.delete(rowId); void deliverForward(rowId); }, Math.max(0, delay));
  (t as unknown as { unref?: () => void }).unref?.();
  st.timers.set(rowId, t);
}

/** After a restart: re-arm retries that were waiting (a restart loses the timers; the log rows remember). Called at boot (instrumentation.ts) and lazily. */
export function resumeForwardRetries() {
  const st = state();
  if (st.resumed || !dbReady()) return; // not migrated yet (or already done)
  st.resumed = true;
  try {
    const rows = all<ForwardRow>("SELECT * FROM lead_forwards WHERE (status = 'failed' AND next_attempt_at IS NOT NULL) OR (status = 'queued' AND attempts > 0 AND created_at < ?)", utc(Date.now() - 120_000));
    for (const r of rows) scheduleRetry(r.id, r.next_attempt_at ? parseUtc(r.next_attempt_at) - Date.now() : 0);
  } catch {
    /* table missing on a half-migrated database */
  }
}

// ------------------------------------------------------------------ public API
function shouldForward(cfg: LmConfig, type: string, def: ReturnType<typeof getFormBySlug>): string {
  if (!cfg.url) return 'Lead Manager is not set up yet.';
  if (!cfg.configured) return cfg.problems[0] || 'Lead Manager is not set up.';
  if (type in cfg.types) return cfg.types[type as keyof typeof cfg.types] ? '' : 'Forwarding is switched off for this kind of form (Lead Manager settings).';
  if (type.startsWith('form:') && def?.settings.leadManager === false) return 'Forwarding is switched off for this form (form settings).';
  return '';
}

/** Called once per saved lead (from POST /api/forms, via after()). Never throws, never blocks the visitor. */
export async function forwardLead(submissionId: number, opts: { origin?: string; staff?: boolean } = {}): Promise<void> {
  try {
    if (!dbReady()) { noteNotReady('Lead Manager forward'); return; } // the lead is already saved; the forward log needs the new tables
    rememberOrigin(opts.origin);
    resumeForwardRetries();
    const sub = get<PayloadSub>('SELECT * FROM submissions WHERE id = ?', submissionId);
    if (!sub) return;
    const def = sub.type.startsWith('form:') ? getFormBySlug(sub.type.slice(5)) : undefined;
    const cfg = getLmConfig();

    run('INSERT OR IGNORE INTO lead_forwards (submission_id, kind, external_id, form_name) VALUES (?, ?, ?, ?)', submissionId, 'lead', externalIdFor(submissionId), formNameFor(sub, def));
    const row = get<ForwardRow>('SELECT * FROM lead_forwards WHERE submission_id = ?', submissionId);
    if (!row || row.status !== 'queued' || row.attempts > 0) return; // already handled: never double-send

    let reason = shouldForward(cfg, sub.type, def);
    if (!reason && opts.staff && cfg.skipStaff) reason = 'Submitted by a signed-in staff member — skipped so tests do not reach Lead Manager (Lead Manager settings).';
    if (reason) {
      run("UPDATE lead_forwards SET status = 'skipped', reason = ? WHERE id = ?", reason, row.id);
      return;
    }
    await deliverForward(row.id);
  } catch (err) {
    console.error('[lead-manager] forwardLead failed:', err instanceof Error ? err.message.replace(/https?:\/\/\S+/g, '<url>') : 'error');
  }
}

/** "Resend" from the log: same externalId, so the vendor de-duplicates. A skipped row is sent only if Lead Manager is set up. */
export async function resendForward(rowId: number, origin?: string) {
  if (!dbReady()) return { status: 'failed' as ForwardStatus, error: NOT_READY_MESSAGE };
  rememberOrigin(origin);
  const row = get<ForwardRow>('SELECT * FROM lead_forwards WHERE id = ?', rowId);
  if (!row) return { status: 'failed' as ForwardStatus, error: 'Not found.' };
  const t = state().timers.get(rowId);
  if (t) { clearTimeout(t); state().timers.delete(rowId); }
  run("UPDATE lead_forwards SET attempts = 0, status = 'queued', reason = '', error = '', next_attempt_at = NULL WHERE id = ?", rowId);
  return deliverForward(rowId, true);
}

/** "Send test lead": a real lead named "Test Person (website test)" / formName "Admin test"; shows the vendor's status + response. */
export async function sendTestLead(origin?: string) {
  // (log row first, then the POST — so a crash can never send a real lead without a record; and on a database that has not been
  // migrated yet there is no log table, so nothing is sent at all)
  if (!dbReady()) return { status: 'failed' as ForwardStatus, error: NOT_READY_MESSAGE, id: 0 };
  rememberOrigin(origin);
  const cfg = getLmConfig();
  if (!cfg.configured) return { status: 'failed' as ForwardStatus, error: cfg.problems[0] || 'Lead Manager is not set up.', id: 0 };
  const id = run("INSERT INTO lead_forwards (submission_id, kind, external_id, form_name) VALUES (NULL, 'test', ?, 'Admin test')", `dassrebar-test-${Date.now().toString(36)}`).lastInsertRowid;
  const r = await deliverForward(id, true);
  return { ...r, id };
}

export function listForwards(opts: { status?: string; limit?: number; offset?: number } = {}): { rows: Array<ForwardRow & { name: string }>; total: number } {
  if (!dbReady()) return { rows: [], total: 0 };
  const ok = ['accepted', 'failed', 'skipped', 'refused', 'queued'].includes(opts.status || '');
  const where = ok ? 'WHERE f.status = ?' : '';
  const params = ok ? [opts.status as string] : [];
  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM lead_forwards f ${where}`, ...params)?.c ?? 0;
  const rows = all<ForwardRow & { name: string }>(
    `SELECT f.*, COALESCE(NULLIF(s.name, ''), s.email, '') AS name FROM lead_forwards f LEFT JOIN submissions s ON s.id = f.submission_id ${where} ORDER BY f.id DESC LIMIT ? OFFSET ?`,
    ...params, opts.limit ?? 40, opts.offset ?? 0
  );
  return { rows, total };
}

/** For the Lead Manager page + dashboard. Safe on a database that hasn't been migrated yet. */
export function forwardStatus(): { configured: boolean; problems: string[]; host: string; source: string; failing: number; retrying: number } {
  const cfg = getLmConfig();
  let failing = 0, retrying = 0;
  try {
    failing = get<{ c: number }>("SELECT COUNT(*) AS c FROM lead_forwards WHERE kind = 'lead' AND status IN ('failed','refused') AND next_attempt_at IS NULL AND created_at > ?", utc(Date.now() - 7 * 86400_000))?.c ?? 0;
    retrying = get<{ c: number }>("SELECT COUNT(*) AS c FROM lead_forwards WHERE status = 'failed' AND next_attempt_at IS NOT NULL")?.c ?? 0;
  } catch { /* ignore */ }
  return { configured: cfg.configured, problems: cfg.problems, host: cfg.host, source: cfg.source, failing, retrying };
}
