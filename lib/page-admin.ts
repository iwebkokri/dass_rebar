// Server-side helpers for the Pages / Templates / dashboard admin screens. Imports the database: never import this from a client component.
import { all, get } from './db';
import { SITE_DEFAULTS, getSiteSettings } from './settings';
import { slugify } from './slug.mjs';

// ------------------------------------------------------------------ paths
/** First segments that belong to the app itself and can never be page paths. */
export const RESERVED_ROOTS = ['admin', 'api', 'uploads', 'pv', 'builder-frame', '_next', 'images'];
/** Dynamic site routes: every path BELOW these is taken (the section's own path, e.g. 'insights', is a normal page). */
export const RESERVED_PARENTS = ['insights'];

const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Lower-case, no leading / trailing slashes, no duplicate slashes, spaces to dashes. '' is the home page. */
export function cleanPath(input: unknown): string {
  return String(input ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/\/{2,}/g, '/')
    .replace(/^\/+|\/+$/g, '');
}

/** An error message, or null when `path` may be used (the home page, '', is valid). Does not check uniqueness. */
export function pathProblem(path: string): string | null {
  if (path === '') return null;
  if (path.length > 160) return 'The path is too long (160 characters at most).';
  const segs = path.split('/');
  if (segs.some((s) => !SEGMENT.test(s))) return 'Use lowercase letters, digits and dashes only; nest sections with “/” (for example services/rebar-detailing).';
  if (RESERVED_ROOTS.includes(segs[0])) return `“${segs[0]}” is reserved by the system. Pick another path.`;
  if (RESERVED_PARENTS.includes(segs[0]) && segs.length > 1) return `Paths under “${segs[0]}/” are used by the site (articles). Pick another path.`;
  return null;
}

/** Uniqueness check (includes trashed pages: the column is UNIQUE). Returns a message or null. */
export function pathTaken(path: string, exceptId?: number): string | null {
  const hit = get<{ id: number; title: string; status: string }>('SELECT id, title, status FROM pages WHERE path = ?' + (exceptId ? ' AND id <> ?' : ''), ...(exceptId ? [path, exceptId] : [path]));
  if (!hit) return null;
  return hit.status === 'trash' ? `A page in the trash (“${hit.title}”) already uses that path. Delete it permanently or pick another path.` : `The path is already used by “${hit.title}”.`;
}

export function pageSlug(title: string): string {
  return slugify(title);
}

/** `base`, or `base-2`, `base-3` … for the first free path (parent segments are kept). */
export function uniquePath(base: string): string {
  let path = base || 'page';
  for (let n = 2; n < 500 && (get('SELECT 1 AS x FROM pages WHERE path = ?', path) || pathProblem(path)); n++) path = `${base || 'page'}-${n}`;
  return path;
}

// ------------------------------------------------------------------ time
/** 'YYYY-MM-DD HH:MM:SS' in UTC, the same shape as SQLite's datetime('now'). */
export function nowUtc(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// Schedule fields are edited in site time (Toronto): use stampToLocalInput / localInputToStamp from lib/post-time.ts.

// ------------------------------------------------------------------ list
export type PageTab = 'all' | 'published' | 'draft' | 'scheduled' | 'trash';
export const PAGE_TABS: PageTab[] = ['all', 'published', 'draft', 'scheduled', 'trash'];
export const TAB_LABEL: Record<PageTab, string> = { all: 'All', published: 'Published', draft: 'Draft', scheduled: 'Scheduled', trash: 'Trash' };

export type PageListRow = {
  id: number;
  path: string;
  title: string;
  status: 'draft' | 'published' | 'trash';
  layout: 'default' | 'canvas';
  noindex: number;
  published_at: string | null;
  updated_at: string;
  author: string | null;
  state: 'published' | 'draft' | 'scheduled' | 'trash';
};

/** published = status published AND (no date or date in the past); scheduled = status published AND date in the future. */
const WHERE: Record<PageTab, string> = {
  all: "p.status <> 'trash'",
  published: "p.status = 'published' AND (p.published_at IS NULL OR p.published_at <= ?)",
  draft: "p.status = 'draft'",
  scheduled: "p.status = 'published' AND p.published_at IS NOT NULL AND p.published_at > ?",
  trash: "p.status = 'trash'",
};

export function pageCounts(): Record<PageTab, number> {
  const now = nowUtc();
  const out = {} as Record<PageTab, number>;
  for (const t of PAGE_TABS) out[t] = get<{ c: number }>(`SELECT COUNT(*) AS c FROM pages p WHERE ${WHERE[t]}`, ...(WHERE[t].includes('?') ? [now] : []))?.c ?? 0;
  return out;
}

export function queryPages(tab: PageTab, q: string, page: number, perPage = 20): { rows: PageListRow[]; total: number } {
  const now = nowUtc();
  const where: string[] = [WHERE[tab]];
  const params: (string | number)[] = WHERE[tab].includes('?') ? [now] : [];
  if (q) {
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.path LIKE ? ESCAPE '\\')");
    const like = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
    params.push(like, like);
  }
  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM pages p WHERE ${where.join(' AND ')}`, ...params)?.c ?? 0;
  const rows = all<Omit<PageListRow, 'state'>>(
    `SELECT p.id, p.path, p.title, p.status, p.layout, p.noindex, p.published_at, p.updated_at, COALESCE(NULLIF(u.name, ''), u.email) AS author
       FROM pages p LEFT JOIN users u ON u.id = p.author_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.updated_at DESC, p.id DESC LIMIT ? OFFSET ?`,
    ...params,
    perPage,
    (Math.max(1, page) - 1) * perPage
  ).map((r) => ({ ...r, state: pageState(r) }));
  return { rows, total };
}

export function pageState(p: { status: string; published_at: string | null }): PageListRow['state'] {
  if (p.status === 'trash') return 'trash';
  if (p.status === 'published') return p.published_at && p.published_at > nowUtc() ? 'scheduled' : 'published';
  return 'draft';
}

/** Where "View" should point. Pages that still have an old hard-coded route are previewed at /pv/ (TEMPORARY — see docs/BUILDER.md section 3). */
const LEGACY_ROUTES = ['', 'about', 'services', 'products', 'projects', 'insights', 'contact', 'quote', 'calculator'];
export function viewUrl(path: string, state: PageListRow['state']): string {
  const live = state === 'published' && !LEGACY_ROUTES.includes(path);
  return live ? '/' + path : '/pv/' + path;
}

export function displayPath(path: string): string {
  return path === '' ? '/ (home)' : '/' + path;
}

// ------------------------------------------------------------------ site
/** Absolute site origin for sitemaps and previews (no trailing slash). */
export function siteUrl(): string {
  return (process.env.SITE_URL || 'https://dassrebar.com').replace(/\/+$/, '');
}

export function siteInfo(): { name: string; host: string } {
  let host = 'dassrebar.com';
  try {
    host = new URL(siteUrl()).host;
  } catch {
    /* keep the default */
  }
  return { name: getSiteSettings().site_title || SITE_DEFAULTS.title, host };
}
