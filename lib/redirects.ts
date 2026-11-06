// Redirects: lookup for the public site (findRedirect), creation for other areas (createRedirect) and the
// validation / queries behind /admin/redirects. Paths are stored without a trailing slash ('/' = home).
import { all, get, run, transaction } from './db';

export const REDIRECT_CODES = [301, 302, 307, 308] as const;
export type RedirectCode = (typeof REDIRECT_CODES)[number];

export type RedirectRow = { id: number; from_path: string; to_url: string; code: number; hits: number; enabled: number; created_at: string };

/** Never let a redirect shadow the CMS, the API or Next's own assets. */
const RESERVED = /^\/(admin|api|_next)(\/|$)/i;

/** Look up an enabled redirect for a request path ('' = home). Counts a hit when found. */
export function findRedirect(path: string): { to: string; code: number } | null {
  const clean = '/' + path.replace(/^\/+|\/+$/g, '');
  const row = get<{ id: number; to_url: string; code: number }>(
    'SELECT id, to_url, code FROM redirects WHERE enabled = 1 AND (from_path = ? COLLATE NOCASE OR from_path = ? COLLATE NOCASE)',
    clean,
    clean + '/'
  );
  if (!row) return null;
  run('UPDATE redirects SET hits = hits + 1 WHERE id = ?', row.id);
  return { to: row.to_url, code: row.code };
}

// ---------------------------------------------------------------------------------------------- normalising

/** "about/" / " /About " -> "/About". Returns '' when the path can't be used as a redirect source. */
export function normalizeFrom(input: string): string {
  let p = String(input ?? '').trim();
  if (!p || p.length > 300) return '';
  if (/[\s?#\\<>"'\u0000-\u001f\u007f]/.test(p)) return '';
  p = '/' + p.replace(/^\/+/, '');
  p = p.replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p;
}

/** Destination: an internal path ("/about", "/a?x=1#y") or an https:// URL. Returns '' when not acceptable. */
export function normalizeTo(input: string): string {
  const u = String(input ?? '').trim();
  if (!u || u.length > 2000 || /[\s\u0000-\u001f\u007f<>"'\\]/.test(u)) return '';
  if (/^\/(?!\/)/.test(u)) return u;
  if (/^https:\/\/[^/?#]+/i.test(u)) return u;
  return '';
}

function siteHosts(): string[] {
  const hosts = new Set<string>();
  try {
    const h = new URL(process.env.SITE_URL || 'https://dassrebar.com').hostname.toLowerCase();
    hosts.add(h);
    hosts.add(h.startsWith('www.') ? h.slice(4) : 'www.' + h);
  } catch {
    /* ignore */
  }
  return [...hosts];
}

/** The path a destination points at on THIS site (for loop detection), or null when it leaves the site. */
function internalPath(to: string): string | null {
  let p: string | null = null;
  if (to.startsWith('/')) p = to;
  else {
    try {
      const u = new URL(to);
      if (siteHosts().includes(u.hostname.toLowerCase())) p = u.pathname || '/';
    } catch {
      return null;
    }
  }
  if (p === null) return null;
  p = p.split(/[?#]/)[0].replace(/\/{2,}/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p || '/';
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** Would adding from -> toPath create a loop (A -> B -> A, or a very long chain)? Looks at enabled redirects only. */
function wouldLoop(from: string, toPath: string | null, selfId?: number): boolean {
  const seen = new Set([from.toLowerCase()]);
  let cur = toPath;
  for (let i = 0; i < 25; i++) {
    if (cur === null) return false;
    const key = cur.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
    const next = get<{ to_url: string }>('SELECT to_url FROM redirects WHERE enabled = 1 AND id != ? AND from_path = ? COLLATE NOCASE', selfId ?? -1, cur);
    if (!next) return false;
    cur = internalPath(next.to_url);
  }
  return true;
}

/** Is there a published page at this path? (A redirect from it would hide the page.) */
export function publishedPageAt(from: string): { title: string } | undefined {
  const path = from.replace(/^\/+|\/+$/g, '').toLowerCase();
  return get<{ title: string }>("SELECT title FROM pages WHERE path = ? AND status = 'published'", path);
}

// ---------------------------------------------------------------------------------------------- validation

export type RedirectInput = { from: string; to: string; code?: number | string; enabled?: boolean };
// (a plain interface rather than a union: the project compiles without strictNullChecks, where unions on `ok` do not narrow)
export type Checked = { ok: boolean; error?: string; needsConfirm?: boolean; from?: string; to?: string; code?: RedirectCode; existingId?: number };

/**
 * Validate one redirect. `selfId` = the row being edited. `allowPage` = the user confirmed a redirect away from an
 * existing published page. Loop detection considers the redirects currently stored.
 */
export function checkRedirect(input: RedirectInput, opts: { selfId?: number; allowPage?: boolean } = {}): Checked {
  const from = normalizeFrom(input.from);
  if (!from) return { ok: false, error: 'The old address must be a path like /old-page (no spaces, “?” or “#”).' };
  if (RESERVED.test(from)) return { ok: false, error: 'Redirects from /admin, /api or /_next are not allowed.' };
  const to = normalizeTo(input.to);
  if (!to) return { ok: false, error: 'The destination must be an internal path starting with “/” or a full https:// address.' };
  const code = Number(input.code ?? 301);
  if (!(REDIRECT_CODES as readonly number[]).includes(code)) return { ok: false, error: 'The redirect type must be 301, 302, 307 or 308.' };

  const toPath = internalPath(to);
  if (toPath !== null && same(toPath, from)) return { ok: false, error: 'A page can’t redirect to itself (the old and new address are the same).' };
  if (wouldLoop(from, toPath, opts.selfId)) return { ok: false, error: `This would create a redirect loop (${from} → … → ${from}).` };

  const existing = get<{ id: number }>('SELECT id FROM redirects WHERE from_path = ? COLLATE NOCASE', from);
  if (existing && existing.id !== opts.selfId) return { ok: false, error: `There is already a redirect from ${from}.` };

  if (!opts.allowPage) {
    const page = publishedPageAt(from);
    if (page) return { ok: false, needsConfirm: true, error: `${from} is a published page (“${page.title}”). The redirect would hide it — tick “Redirect anyway” to confirm.` };
  }
  return { ok: true, from, to, code: code as RedirectCode, existingId: existing?.id };
}

// ---------------------------------------------------------------------------------------------- writes

/**
 * Create or update a redirect (used by the pages admin when a page's path changes). Never throws; returns false when the
 * redirect isn't possible (invalid, points at itself, or would loop). A redirect pointing away from the destination
 * (/b -> /a already stored, page now moved /a -> /b) is removed, since a live page occupies that path again.
 */
export function createRedirect(fromPath: string, toUrl: string, code: number = 301): boolean {
  try {
    const from = normalizeFrom(fromPath);
    const to = normalizeTo(toUrl);
    if (!from || !to || RESERVED.test(from)) return false;
    const c = (REDIRECT_CODES as readonly number[]).includes(code) ? code : 301;
    const toPath = internalPath(to);
    if (toPath !== null && same(toPath, from)) return false;

    // (no transaction here on purpose: callers may already be inside one, and node:sqlite is synchronous)
    if (toPath !== null && wouldLoop(from, toPath)) {
      run('DELETE FROM redirects WHERE from_path = ? COLLATE NOCASE', toPath);
      if (wouldLoop(from, toPath)) return false;
    }
    const existing = get<{ id: number }>('SELECT id FROM redirects WHERE from_path = ? COLLATE NOCASE', from);
    if (existing) run('UPDATE redirects SET to_url = ?, code = ?, enabled = 1 WHERE id = ?', to, c, existing.id);
    else run('INSERT INTO redirects (from_path, to_url, code, enabled) VALUES (?, ?, ?, 1)', from, to, c);
    return true;
  } catch {
    return false;
  }
}

export function saveRedirect(c: Checked, enabled: boolean, id?: number): number {
  if (id) {
    run('UPDATE redirects SET from_path = ?, to_url = ?, code = ?, enabled = ? WHERE id = ?', c.from, c.to, c.code, enabled ? 1 : 0, id);
    return id;
  }
  return run('INSERT INTO redirects (from_path, to_url, code, enabled) VALUES (?, ?, ?, ?)', c.from, c.to, c.code, enabled ? 1 : 0).lastInsertRowid;
}

const idList = (ids: number[]) => ids.filter((n) => Number.isInteger(n) && n > 0);

export function deleteRedirects(ids: number[]): number {
  const list = idList(ids);
  if (!list.length) return 0;
  return run(`DELETE FROM redirects WHERE id IN (${list.map(() => '?').join(',')})`, ...list).changes;
}

export function setRedirectsEnabled(ids: number[], enabled: boolean): number {
  const list = idList(ids);
  if (!list.length) return 0;
  // Re-enabling must not bring back a loop: skip rows that would loop now.
  let n = 0;
  transaction(() => {
    for (const id of list) {
      const row = get<RedirectRow>('SELECT * FROM redirects WHERE id = ?', id);
      if (!row) continue;
      if (enabled && wouldLoop(row.from_path, internalPath(row.to_url), id)) continue;
      n += run('UPDATE redirects SET enabled = ? WHERE id = ?', enabled ? 1 : 0, id).changes;
    }
  });
  return n;
}

// ---------------------------------------------------------------------------------------------- admin queries

export function getRedirect(id: number): RedirectRow | undefined {
  return get<RedirectRow>('SELECT * FROM redirects WHERE id = ?', id);
}

export function listRedirects(opts: { q?: string; page?: number; pageSize?: number } = {}): { rows: RedirectRow[]; total: number; pages: number; page: number } {
  const pageSize = opts.pageSize ?? 40;
  const where: string[] = [];
  const args: string[] = [];
  const q = (opts.q ?? '').trim();
  if (q) {
    where.push("(from_path LIKE ? ESCAPE '\\' OR to_url LIKE ? ESCAPE '\\')");
    const like = `%${q.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
    args.push(like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM redirects ${clause}`, ...args)?.c ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(1, Math.trunc(opts.page ?? 1) || 1), pages);
  const rows = all<RedirectRow>(`SELECT * FROM redirects ${clause} ORDER BY id DESC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, ...args);
  return { rows, total, pages, page };
}

// ---------------------------------------------------------------------------------------------- CSV (from,to,code)

export type CsvRedirect = { line: number; from: string; to: string; code: string };

/** Parse "from,to,code" rows (comma, semicolon or tab separated; quotes allowed; header row optional). */
export function parseRedirectsCsv(text: string, maxRows = 5000): { rows: CsvRedirect[]; error?: string } {
  const src = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const firstLine = src.split('\n', 1)[0] ?? '';
  const delim = firstLine.includes('\t') ? '\t' : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const records: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQ = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"' && field === '') inQ = true;
    else if (ch === delim) { cur.push(field); field = ''; }
    else if (ch === '\n') { cur.push(field); records.push(cur); cur = []; field = ''; }
    else field += ch;
  }
  if (field !== '' || cur.length) { cur.push(field); records.push(cur); }

  const rows: CsvRedirect[] = [];
  records.forEach((rec, idx) => {
    const cells = rec.map((c) => c.trim());
    if (cells.every((c) => !c)) return;
    if (idx === 0 && /^(from|from_path|old|source)$/i.test(cells[0] ?? '')) return;
    rows.push({ line: idx + 1, from: cells[0] ?? '', to: cells[1] ?? '', code: cells[2] ?? '' });
  });
  if (rows.length > maxRows) return { rows: [], error: `Too many rows (maximum ${maxRows}).` };
  return { rows };
}

// ---------------------------------------------------------------------------------------------- CSV import

export type CsvResult = { line: number; from: string; to: string; code: string; status: 'new' | 'update' | 'error'; message?: string };

class Rollback extends Error {}

/**
 * Validate (and, with `commit`, store) CSV rows. Everything runs in ONE transaction: for a preview it is rolled back,
 * so loop / duplicate detection between rows of the same file is exact and nothing is written.
 */
export function importRedirects(rows: CsvRedirect[], opts: { allowPages: boolean; commit: boolean }): CsvResult[] {
  const results: CsvResult[] = [];
  try {
    transaction(() => {
      const seen = new Set<string>();
      for (const r of rows) {
        const base = { line: r.line, from: r.from, to: r.to, code: r.code };
        const from = normalizeFrom(r.from);
        const key = from.toLowerCase();
        if (from && seen.has(key)) { results.push({ ...base, status: 'error', message: `${from} appears twice in the file.` }); continue; }
        const existing = from ? get<{ id: number }>('SELECT id FROM redirects WHERE from_path = ? COLLATE NOCASE', from) : undefined;
        const checked = checkRedirect({ from: r.from, to: r.to, code: r.code === '' ? 301 : r.code }, { selfId: existing?.id, allowPage: opts.allowPages });
        if (!checked.ok) { results.push({ ...base, status: 'error', message: checked.error }); continue; }
        seen.add(key);
        if (existing) run('UPDATE redirects SET from_path = ?, to_url = ?, code = ?, enabled = 1 WHERE id = ?', checked.from, checked.to, checked.code, existing.id);
        else run('INSERT INTO redirects (from_path, to_url, code, enabled) VALUES (?, ?, ?, 1)', checked.from, checked.to, checked.code);
        results.push({ ...base, from: checked.from, to: checked.to, code: String(checked.code), status: existing ? 'update' : 'new' });
      }
      if (!opts.commit) throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
  return results;
}
