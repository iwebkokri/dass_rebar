// Site export / import (Studio CMS → Import / Export). One JSON file; users and sessions are NEVER included.
//
// Import is strict: every row is re-validated column by column (unknown columns are ignored), builder documents go through
// sanitizeDoc, rich text through sanitizeRich, URLs through safeUrl / safeMediaUrl. The whole import — dry run or real — runs in ONE
// transaction; a dry run simply rolls it back, so the summary it shows is exactly what the real import would do.
import { all, get, run, transaction } from './db';
import { sanitizeDoc, sanitizeRich } from './builder/sanitize.mjs';
import { parseDoc } from './builder/tree.mjs';
import { safeMediaUrl, safeUrl } from './builder/url.mjs';
import { parsePalette } from './palette';
import { checkRedirect, normalizeFrom } from './redirects';
import { SECRET_KEY } from './settings';
import type { AdminUser } from './auth';

export const FORMAT = 'dassrebar-export';
export const VERSION = 1;
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
const MAX_ROWS = 20_000;

export const EXPORT_TYPES = ['pages', 'templates', 'menus', 'forms', 'posts', 'comments', 'projects', 'products', 'bar_data', 'redirects', 'settings', 'media'] as const;
export type ExportType = (typeof EXPORT_TYPES)[number];

export const TYPE_LABEL: Record<ExportType, string> = {
  pages: 'Pages',
  templates: 'Templates (header, footer, saved sections)',
  menus: 'Menus',
  forms: 'Forms (definitions, not submissions)',
  posts: 'Posts with categories, tags and their links',
  comments: 'Comments',
  projects: 'Projects',
  products: 'Products',
  bar_data: 'Bar data table',
  redirects: 'Redirects',
  settings: 'Site settings (email credentials are never exported)',
  media: 'Media records (the files themselves are copied manually)',
};

/** Summary rows shown after a (dry-run) import: posts also bring their terms. */
export const SUMMARY_TYPES = ['pages', 'templates', 'menus', 'forms', 'terms', 'posts', 'comments', 'projects', 'products', 'bar_data', 'redirects', 'settings', 'media'] as const;
export type SummaryType = (typeof SUMMARY_TYPES)[number];
export const SUMMARY_LABEL: Record<SummaryType, string> = { ...TYPE_LABEL, terms: 'Categories & tags', pages: 'Pages', templates: 'Templates', menus: 'Menus', forms: 'Forms', posts: 'Posts', settings: 'Settings', media: 'Media records', comments: 'Comments', projects: 'Projects', products: 'Products', bar_data: 'Bar data', redirects: 'Redirects' };

// ================================================================================================ column specs

type Kind = 'text' | 'long' | 'int' | 'real' | 'bool' | 'url' | 'media' | 'date' | { enum: string[] };
type Col = { k: Kind; max?: number; req?: boolean; def?: string | number | null };
type Spec = Record<string, Col>;

const str = (v: unknown, max: number, trim = true): string => {
  let s = typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '';
  s = s.replace(/\u0000/g, '');
  if (trim) s = s.trim();
  return s.slice(0, max);
};
const DATE = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}(?::\d{2})?)?/;

function cleanRow(spec: Spec, raw: any): { row?: Record<string, string | number | null>; error?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'not an object' };
  const row: Record<string, string | number | null> = {};
  for (const [name, col] of Object.entries(spec)) {
    const v = raw[name];
    let out: string | number | null;
    const k = col.k;
    if (typeof k === 'object') {
      const s = str(v, 40);
      out = k.enum.includes(s) ? s : ((col.def as string | undefined) ?? null);
      if (out === null) return { error: `“${name}” must be one of ${k.enum.join(', ')}` };
    } else if (k === 'text') out = str(v, col.max ?? 500);
    else if (k === 'long') out = str(v, col.max ?? 200_000, false);
    else if (k === 'int') {
      const n = Math.trunc(Number(v));
      out = Number.isFinite(n) && v !== null && v !== '' && v !== undefined ? n : (col.def as number) ?? 0;
    } else if (k === 'real') {
      const n = Number(v);
      if (!Number.isFinite(n) || v === null || v === '' || v === undefined || n < 0) return { error: `“${name}” must be a number` };
      out = n;
    } else if (k === 'bool') out = v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0;
    else if (k === 'url') out = safeUrl(str(v, 2000));
    else if (k === 'media') out = safeMediaUrl(str(v, 2000));
    else {
      const s = typeof v === 'string' ? v.trim() : '';
      out = DATE.test(s) ? s.replace('T', ' ').replace(/(?:\.\d+)?Z$/, '').slice(0, 19) : col.def === undefined ? null : col.def;
    }
    if (col.req && (out === '' || out === null)) return { error: `“${name}” is required` };
    row[name] = out;
  }
  return { row };
}

const today = () => new Date().toISOString().slice(0, 10);
const SLUG = /^[a-z0-9][a-z0-9\-_]{0,119}$/;
const slugOf = (v: unknown) => str(v, 120).toLowerCase();

const SPECS = {
  pages: {
    title: { k: 'text', max: 300, req: true }, status: { k: { enum: ['draft', 'published', 'trash'] }, def: 'draft' }, layout: { k: { enum: ['default', 'canvas'] }, def: 'default' },
    seo_title: { k: 'text', max: 300 }, seo_description: { k: 'text', max: 1000 }, og_image: { k: 'media' }, noindex: { k: 'bool' }, published_at: { k: 'date', def: null },
  },
  templates: { kind: { k: { enum: ['header', 'footer', 'section', 'page'] }, req: true }, name: { k: 'text', max: 200, req: true }, active: { k: 'bool' } },
  menus: { name: { k: 'text', max: 200, req: true } },
  forms: { name: { k: 'text', max: 200, req: true } },
  terms: { taxonomy: { k: { enum: ['category', 'tag'] }, req: true }, name: { k: 'text', max: 200, req: true }, description: { k: 'text', max: 1000 } },
  posts: {
    title: { k: 'text', max: 300, req: true }, category: { k: 'text', max: 100 }, excerpt: { k: 'long', max: 5000 }, body: { k: 'long', max: 1_000_000 }, cover_image: { k: 'media' },
    external_url: { k: 'url' }, published_at: { k: 'date', def: today() }, status: { k: { enum: ['draft', 'published', 'trash'] }, def: 'draft' }, featured: { k: 'bool' },
    comments_enabled: { k: 'bool' }, seo_title: { k: 'text', max: 300 }, seo_description: { k: 'text', max: 1000 }, og_image: { k: 'media' },
  },
  projects: {
    title: { k: 'text', max: 200, req: true }, category: { k: 'text', max: 60 }, location: { k: 'text', max: 160 }, address: { k: 'text', max: 200 },
    featured: { k: 'bool' }, roster: { k: 'bool' }, sort_order: { k: 'int', def: 100 }, published: { k: 'bool' },
  },
  products: {
    kind: { k: { enum: ['stocked', 'also'] }, def: 'stocked' }, name: { k: 'text', max: 200, req: true }, sizes: { k: 'text', max: 200 }, description: { k: 'long', max: 2000 },
    image: { k: 'media' }, sort_order: { k: 'int', def: 100 }, published: { k: 'bool' },
  },
  bar_data: {
    bar_size: { k: 'text', max: 12, req: true }, mass_kg_m: { k: 'real' }, nominal_diameter_mm: { k: 'real' }, area_mm2: { k: 'real' }, perimeter_mm: { k: 'real' },
    on_request: { k: 'bool' }, sort_order: { k: 'int', def: 0 },
  },
  media: {
    storage: { k: { enum: ['upload', 'public'] }, def: 'upload' }, filename: { k: 'text', max: 300, req: true }, original_name: { k: 'text', max: 300 }, mime: { k: 'text', max: 100 },
    kind: { k: { enum: ['image', 'video', 'audio', 'file'] }, def: 'file' }, size: { k: 'int', def: 0 }, alt: { k: 'text', max: 500 }, title: { k: 'text', max: 300 },
    caption: { k: 'text', max: 1000 }, folder: { k: 'text', max: 120 },
  },
} satisfies Record<string, Spec>;

/** Strip anything that isn't plain data (forms / menus carry JSON the CMS defines); URL-ish keys are validated. */
function cleanJson(v: unknown, depth = 0, key = ''): unknown {
  if (depth > 8) return undefined;
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const s = v.replace(/\u0000/g, '').slice(0, 5000);
    return /(^|_)(url|href|link|redirect|src)$/i.test(key) || /^(url|href|link|redirect|src)/i.test(key) ? safeUrl(s) : s;
  }
  if (Array.isArray(v)) return v.slice(0, 500).map((x) => cleanJson(x, depth + 1, key)).filter((x) => x !== undefined);
  if (typeof v === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as object).slice(0, 100)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype' || k.length > 80) continue;
      const c = cleanJson(val, depth + 1, k);
      if (c !== undefined) out[k] = c;
    }
    return out;
  }
  return undefined;
}

const jsonOf = (v: unknown) => {
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return undefined; }
};

// ================================================================================================ export

export type ExportFile = { format: typeof FORMAT; version: number; exported_at: string; site: string; data: Record<string, unknown> };

const parseJson = (s: string, fallback: unknown) => {
  try { return JSON.parse(s); } catch { return fallback; }
};

export function buildExport(types: ExportType[]): ExportFile {
  const want = new Set(types);
  const data: Record<string, unknown> = {};

  if (want.has('pages')) {
    data.pages = all<any>('SELECT path, title, status, layout, content, seo_title, seo_description, og_image, noindex, published_at FROM pages ORDER BY path').map((r) => ({ ...r, content: parseJson(r.content, { v: 1, nodes: [] }) }));
  }
  if (want.has('templates')) {
    data.templates = all<any>('SELECT kind, name, content, active FROM templates ORDER BY kind, name').map((r) => ({ ...r, content: parseJson(r.content, { v: 1, nodes: [] }) }));
  }
  if (want.has('menus')) {
    data.menus = all<any>('SELECT slug, name, items FROM menus ORDER BY slug').map((r) => ({ ...r, items: parseJson(r.items, []) }));
  }
  if (want.has('forms')) {
    data.forms = all<any>('SELECT slug, name, fields, settings FROM forms ORDER BY slug').map((r) => ({ ...r, fields: parseJson(r.fields, []), settings: parseJson(r.settings, {}) }));
  }
  if (want.has('posts')) {
    data.terms = all<any>('SELECT taxonomy, name, slug, description FROM terms ORDER BY taxonomy, slug');
    const links = all<{ post_id: number; taxonomy: string; slug: string }>('SELECT pt.post_id, t.taxonomy, t.slug FROM post_terms pt JOIN terms t ON t.id = pt.term_id');
    const byPost = new Map<number, Array<{ taxonomy: string; slug: string }>>();
    for (const l of links) byPost.set(l.post_id, [...(byPost.get(l.post_id) ?? []), { taxonomy: l.taxonomy, slug: l.slug }]);
    data.posts = all<any>(
      `SELECT id, slug, title, category, excerpt, body, cover_image, external_url, published_at, status, featured, comments_enabled, seo_title, seo_description, og_image FROM posts ORDER BY id`
    ).map(({ id, ...r }) => ({ ...r, terms: byPost.get(id) ?? [] }));
  }
  if (want.has('comments')) {
    data.comments = all<any>(
      `SELECT c.id, c.parent_id, p.slug AS post_slug, c.author_name, c.author_email, c.body, c.status, c.created_at FROM comments c JOIN posts p ON p.id = c.post_id ORDER BY c.id`
    );
  }
  if (want.has('projects')) {
    data.projects = all<any>('SELECT slug, title, category, location, address, images, featured, roster, sort_order, published FROM projects ORDER BY id').map((r) => ({ ...r, images: parseJson(r.images, []) }));
  }
  if (want.has('products')) data.products = all<any>('SELECT kind, name, sizes, description, image, sort_order, published FROM products ORDER BY id');
  if (want.has('bar_data')) data.bar_data = all<any>('SELECT bar_size, mass_kg_m, nominal_diameter_mm, area_mm2, perimeter_mm, on_request, sort_order FROM bar_data ORDER BY sort_order, id');
  if (want.has('redirects')) data.redirects = all<any>('SELECT from_path, to_url, code, enabled FROM redirects ORDER BY id');
  if (want.has('settings')) {
    const s: Record<string, string> = {};
    for (const r of all<{ key: string; value: string }>('SELECT key, value FROM settings ORDER BY key')) if (!SECRET_KEY.test(r.key)) s[r.key] = r.value;
    data.settings = s;
  }
  if (want.has('media')) {
    data.media = all<any>('SELECT url, storage, filename, original_name, mime, kind, size, width, height, alt, title, caption, folder FROM media ORDER BY id');
  }
  return { format: FORMAT, version: VERSION, exported_at: new Date().toISOString(), site: process.env.SITE_URL || 'https://dassrebar.com', data };
}

export function countsForExport(): Record<ExportType, number> {
  const n = (sql: string) => get<{ c: number }>(sql)?.c ?? 0;
  return {
    pages: n('SELECT COUNT(*) AS c FROM pages'), templates: n('SELECT COUNT(*) AS c FROM templates'), menus: n('SELECT COUNT(*) AS c FROM menus'), forms: n('SELECT COUNT(*) AS c FROM forms'),
    posts: n('SELECT COUNT(*) AS c FROM posts'), comments: n('SELECT COUNT(*) AS c FROM comments'), projects: n('SELECT COUNT(*) AS c FROM projects'), products: n('SELECT COUNT(*) AS c FROM products'),
    bar_data: n('SELECT COUNT(*) AS c FROM bar_data'), redirects: n('SELECT COUNT(*) AS c FROM redirects'), settings: n('SELECT COUNT(*) AS c FROM settings'), media: n('SELECT COUNT(*) AS c FROM media'),
  };
}

// ================================================================================================ parse + validate the file

export type Parsed = { ok: boolean; error?: string; data?: Record<string, any>; exportedAt?: string; ignored?: string[] };

export function parseImportFile(text: string): Parsed {
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This is not a valid JSON file.' };
  }
  if (!json || typeof json !== 'object' || Array.isArray(json) || json.format !== FORMAT) return { ok: false, error: 'This file was not created by Export in this CMS (wrong format).' };
  if (!Number.isInteger(json.version) || json.version < 1) return { ok: false, error: 'The export version is missing or invalid.' };
  if (json.version > VERSION) return { ok: false, error: `This export is version ${json.version}; this CMS understands version ${VERSION}. Update the site first.` };
  const data = json.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'The file has no “data” section.' };

  const known = new Set<string>(SUMMARY_TYPES);
  const ignored = Object.keys(data).filter((k) => !known.has(k));
  const out: Record<string, any> = {};
  for (const k of SUMMARY_TYPES) {
    if (data[k] === undefined) continue;
    if (k === 'settings') {
      if (!data[k] || typeof data[k] !== 'object' || Array.isArray(data[k])) return { ok: false, error: '“settings” must be an object.' };
    } else if (!Array.isArray(data[k])) return { ok: false, error: `“${k}” must be a list.` };
    else if (data[k].length > MAX_ROWS) return { ok: false, error: `“${k}” has too many entries (${MAX_ROWS} at most).` };
    out[k] = data[k];
  }
  if (!Object.keys(out).length) return { ok: false, error: 'The file contains nothing this CMS can import.' };
  return { ok: true, data: out, exportedAt: typeof json.exported_at === 'string' ? json.exported_at.slice(0, 40) : '', ignored: ignored.slice(0, 20) };
}

// ================================================================================================ import

export type Counts = { created: number; updated: number; skipped: number; deleted: number; notes: string[] };
export type ImportSummary = Partial<Record<SummaryType, Counts>>;
export type ImportOptions = { mode: 'merge' | 'replace'; types: SummaryType[]; dryRun: boolean; user: Pick<AdminUser, 'id' | 'email' | 'role'> };

class Rollback extends Error {}

const blank = (): Counts => ({ created: 0, updated: 0, skipped: 0, deleted: 0, notes: [] });
const skip = (c: Counts, i: number, why: string) => {
  c.skipped++;
  if (c.notes.length < 5) c.notes.push(`#${i + 1}: ${why}`);
};

function insertRow(table: string, row: Record<string, unknown>): number {
  const cols = Object.keys(row);
  return run(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...(cols.map((c) => row[c]) as any[])).lastInsertRowid;
}
function updateRow(table: string, id: number, row: Record<string, unknown>, touch: boolean) {
  const cols = Object.keys(row);
  run(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')}${touch ? ", updated_at = datetime('now')" : ''} WHERE id = ?`, ...(cols.map((c) => row[c]) as any[]), id);
}

type Prepared = { row: Record<string, any>; raw: any; i: number; doc?: any; extra?: any };
type Handler = {
  table: string;
  key: string[];
  spec: Spec;
  touch: boolean; // table has updated_at
  author?: boolean; // table has author_id (new rows belong to the importer)
  /** natural-key columns derived from the raw row (the key is never taken from the spec cleaner alone) */
  keys: (raw: any) => Record<string, any> | string;
  prep?: (row: Record<string, any>, raw: any) => { error?: string; doc?: any; extra?: any } | void;
  after?: (id: number, p: Prepared, existed: boolean) => void;
  onReplace?: () => void;
};

function runHandler(h: Handler, rows: any[], ctx: ImportOptions): Counts {
  const c = blank();
  const isAdmin = ctx.user.role === 'administrator';
  const prepared: Prepared[] = [];
  rows.forEach((raw, i) => {
    const keys = h.keys(raw);
    if (typeof keys === 'string') return skip(c, i, keys);
    const cleaned = cleanRow(h.spec, raw);
    if (!cleaned.row) return skip(c, i, cleaned.error ?? 'invalid');
    const row = { ...cleaned.row, ...keys };
    const extra = h.prep?.(row, raw) as { error?: string; doc?: any; extra?: any } | undefined;
    if (extra?.error) return skip(c, i, extra.error);
    prepared.push({ row, raw, i, doc: extra?.doc, extra: extra?.extra });
  });

  if (ctx.mode === 'replace' && prepared.length) {
    c.deleted = run(`DELETE FROM ${h.table}`).changes;
    h.onReplace?.();
  }

  let dropped = 0;
  for (const p of prepared) {
    const where = h.key.map((k) => `${k} = ?`).join(' AND ');
    const existing = get<any>(`SELECT id${p.doc !== undefined ? ', content' : ''} FROM ${h.table} WHERE ${where}`, ...h.key.map((k) => p.row[k]));
    const row: Record<string, any> = { ...p.row };
    if (p.doc !== undefined) {
      try {
        const { doc, dropped: d } = sanitizeDoc(p.doc, { isAdmin, prev: existing ? parseDoc(existing.content) : null });
        row.content = JSON.stringify(doc);
        dropped += d;
      } catch (err) {
        skip(c, p.i, err instanceof Error ? err.message : 'invalid document');
        continue;
      }
    }
    let id: number;
    if (existing) {
      updateRow(h.table, existing.id, row, h.touch);
      id = existing.id;
      c.updated++;
    } else {
      if (h.author) row.author_id = ctx.user.id;
      id = insertRow(h.table, row);
      c.created++;
    }
    h.after?.(id, p, !!existing);
  }
  if (dropped) c.notes.push(`${dropped} invalid or disallowed element${dropped === 1 ? '' : 's'} were removed from page content`);
  return c;
}

const pathKeys = (raw: any): Record<string, any> | string => {
  const p = str(raw?.path, 300).replace(/^\/+|\/+$/g, '').toLowerCase();
  if (p && !/^[a-z0-9][a-z0-9\-_.]*(\/[a-z0-9][a-z0-9\-_.]*)*$/.test(p)) return 'invalid page path';
  if (/^(admin|api|_next|uploads)(\/|$)/.test(p)) return 'reserved page path';
  return { path: p };
};
const docOf = (raw: any) => {
  const d = jsonOf(raw?.content);
  return d && typeof d === 'object' && Array.isArray(d.nodes) ? d : undefined;
};
const slugKeys = (raw: any): Record<string, any> | string => {
  const slug = slugOf(raw?.slug);
  return SLUG.test(slug) ? { slug } : 'missing or invalid slug';
};

const HANDLERS: Record<string, Handler> = {
  pages: {
    table: 'pages', key: ['path'], spec: SPECS.pages, touch: true, author: true,
    keys: pathKeys,
    prep: (_row, raw) => { const doc = docOf(raw); return doc ? { doc } : { error: 'missing or invalid page content' }; },
  },
  templates: {
    table: 'templates', key: ['kind', 'name'], spec: SPECS.templates, touch: true, author: true,
    keys: (raw) => ({ kind: str(raw?.kind, 20), name: str(raw?.name, 200) }),
    prep: (_row, raw) => { const doc = docOf(raw); return doc ? { doc } : { error: 'missing or invalid template content' }; },
    after: (id, p) => {
      // only one active header / footer: an imported "active" one takes over
      if (p.row.active && (p.row.kind === 'header' || p.row.kind === 'footer')) run('UPDATE templates SET active = 0 WHERE kind = ? AND id != ?', p.row.kind, id);
    },
  },
  menus: {
    table: 'menus', key: ['slug'], spec: SPECS.menus, touch: true,
    keys: slugKeys,
    prep: (row, raw) => {
      const items = cleanJson(jsonOf(raw?.items), 0, 'items');
      if (!Array.isArray(items)) return { error: 'items must be a list' };
      row.items = JSON.stringify(items);
    },
  },
  forms: {
    table: 'forms', key: ['slug'], spec: SPECS.forms, touch: true,
    keys: slugKeys,
    prep: (row, raw) => {
      const fields = cleanJson(jsonOf(raw?.fields), 0, 'fields');
      const settings = cleanJson(jsonOf(raw?.settings) ?? {}, 0, 'settings');
      if (!Array.isArray(fields) || !settings || typeof settings !== 'object' || Array.isArray(settings)) return { error: 'fields must be a list and settings an object' };
      row.fields = JSON.stringify(fields);
      row.settings = JSON.stringify(settings);
    },
  },
  terms: {
    table: 'terms', key: ['taxonomy', 'slug'], spec: SPECS.terms, touch: false,
    keys: (raw) => {
      const k = slugKeys(raw);
      return typeof k === 'string' ? k : { ...k, taxonomy: str(raw?.taxonomy, 20) };
    },
  },
  posts: {
    table: 'posts', key: ['slug'], spec: SPECS.posts, touch: true, author: true,
    keys: slugKeys,
    prep: (row) => {
      // Rich HTML bodies are sanitised; plain text / markdown-lite bodies pass through untouched.
      if (/<\s*[a-z!/]/i.test(String(row.body))) row.body = sanitizeRich(String(row.body));
    },
    after: (id, p) => {
      if (!Array.isArray(p.raw?.terms)) return;
      run('DELETE FROM post_terms WHERE post_id = ?', id);
      for (const t of p.raw.terms.slice(0, 100)) {
        const term = get<{ id: number }>('SELECT id FROM terms WHERE taxonomy = ? AND slug = ?', str(t?.taxonomy, 20), slugOf(t?.slug));
        if (term) run('INSERT OR IGNORE INTO post_terms (post_id, term_id) VALUES (?, ?)', id, term.id);
      }
    },
  },
  projects: {
    table: 'projects', key: ['slug'], spec: SPECS.projects, touch: true,
    keys: slugKeys,
    prep: (row, raw) => {
      const list = jsonOf(raw?.images);
      row.images = JSON.stringify((Array.isArray(list) ? list : []).slice(0, 60).map((u: unknown) => safeMediaUrl(str(u, 2000))).filter(Boolean));
    },
  },
  products: {
    table: 'products', key: ['kind', 'name'], spec: SPECS.products, touch: true,
    keys: (raw) => ({ kind: str(raw?.kind, 10) === 'also' ? 'also' : 'stocked', name: str(raw?.name, 200) }),
  },
  bar_data: {
    table: 'bar_data', key: ['bar_size'], spec: SPECS.bar_data, touch: false,
    keys: (raw) => ({ bar_size: str(raw?.bar_size, 12) }),
  },
  media: {
    table: 'media', key: ['url'], spec: SPECS.media, touch: false,
    keys: (raw) => {
      const url = safeMediaUrl(str(raw?.url, 2000));
      return url.startsWith('/') ? { url } : 'url must be a site path like /uploads/…';
    },
    prep: (row, raw) => {
      for (const k of ['width', 'height']) {
        const n = Math.trunc(Number(raw?.[k]));
        row[k] = Number.isFinite(n) && n > 0 && n < 100_000 ? n : null;
      }
    },
  },
};

const IMAGE_SETTING = /(logo|favicon|og_image|image|diagram)/i;

function importSettings(data: Record<string, unknown>, ctx: ImportOptions): Counts {
  const c = blank();
  const prepared: Array<[string, string]> = [];
  let secrets = 0;
  for (const [key, val] of Object.entries(data)) {
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key)) { skip(c, prepared.length, `invalid key “${key.slice(0, 30)}”`); continue; }
    if (SECRET_KEY.test(key)) { secrets++; continue; }
    if (typeof val !== 'string' || val.length > 100_000) { skip(c, prepared.length, `“${key}” must be text`); continue; }
    let value = val.replace(/\u0000/g, '');
    if (key === 'design_palette') {
      const p = parsePalette(value);
      if (!p) { skip(c, prepared.length, 'design_palette is not a valid colour list'); continue; }
      value = JSON.stringify(p);
    } else if (IMAGE_SETTING.test(key)) value = safeMediaUrl(value.trim());
    prepared.push([key, value]);
  }
  if (secrets) c.notes.push(`${secrets} credential-like setting${secrets === 1 ? '' : 's'} ignored`);
  if (ctx.mode === 'replace' && prepared.length) {
    for (const r of all<{ key: string }>('SELECT key FROM settings')) {
      if (!SECRET_KEY.test(r.key)) { run('DELETE FROM settings WHERE key = ?', r.key); c.deleted++; }
    }
  }
  for (const [key, value] of prepared) {
    const had = get('SELECT 1 AS x FROM settings WHERE key = ?', key);
    run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
    if (had) c.updated++;
    else c.created++;
  }
  return c;
}

function importRedirects(rows: any[], ctx: ImportOptions): Counts {
  const c = blank();
  if (ctx.mode === 'replace' && rows.length) c.deleted = run('DELETE FROM redirects').changes;
  rows.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return skip(c, i, 'not an object');
    const existing = get<{ id: number }>('SELECT id FROM redirects WHERE from_path = ? COLLATE NOCASE', normalizeFrom(str(raw.from_path, 300)));
    const chk = checkRedirect({ from: str(raw.from_path, 300), to: str(raw.to_url, 2000), code: raw.code ?? 301 }, { selfId: existing?.id, allowPage: true });
    if (!chk.ok) return skip(c, i, chk.error);
    const enabled = raw.enabled === 0 || raw.enabled === false ? 0 : 1;
    if (existing) { run('UPDATE redirects SET from_path = ?, to_url = ?, code = ?, enabled = ? WHERE id = ?', chk.from, chk.to, chk.code, enabled, existing.id); c.updated++; }
    else { run('INSERT INTO redirects (from_path, to_url, code, enabled) VALUES (?, ?, ?, ?)', chk.from, chk.to, chk.code, enabled); c.created++; }
  });
  return c;
}

function importComments(rows: any[], ctx: ImportOptions): Counts {
  const c = blank();
  if (ctx.mode === 'replace' && rows.length) c.deleted = run('DELETE FROM comments').changes;
  const idMap = new Map<number, number>(); // id in the file -> id here (so replies keep their parent)
  const sorted = rows.map((raw, i) => ({ raw, i })).sort((a, b) => Number(a.raw?.id ?? 0) - Number(b.raw?.id ?? 0));
  for (const { raw, i } of sorted) {
    if (!raw || typeof raw !== 'object') { skip(c, i, 'not an object'); continue; }
    const cleaned = cleanRow(
      { author_name: { k: 'text', max: 200, req: true }, author_email: { k: 'text', max: 200 }, body: { k: 'long', max: 20_000, req: true }, status: { k: { enum: ['pending', 'approved', 'spam', 'trash'] }, def: 'pending' }, created_at: { k: 'date', def: null } },
      raw
    );
    if (!cleaned.row) { skip(c, i, cleaned.error ?? 'invalid'); continue; }
    const post = get<{ id: number }>('SELECT id FROM posts WHERE slug = ?', slugOf(raw.post_slug));
    if (!post) { skip(c, i, `post “${str(raw.post_slug, 60)}” does not exist here`); continue; }
    const row = cleaned.row;
    const parent = idMap.get(Math.trunc(Number(raw.parent_id))) ?? null;
    const existing = get<{ id: number }>('SELECT id FROM comments WHERE post_id = ? AND author_name = ? AND body = ? AND COALESCE(created_at, \'\') = COALESCE(?, \'\')', post.id, row.author_name, row.body, row.created_at);
    let id: number;
    if (existing) {
      run('UPDATE comments SET status = ? WHERE id = ?', row.status, existing.id);
      id = existing.id;
      c.updated++;
    } else {
      const ins: Record<string, unknown> = { post_id: post.id, parent_id: parent, author_name: row.author_name, author_email: row.author_email, body: row.body, status: row.status };
      if (row.created_at) ins.created_at = row.created_at;
      id = insertRow('comments', ins);
      c.created++;
    }
    const oldId = Math.trunc(Number(raw.id));
    if (Number.isInteger(oldId)) idMap.set(oldId, id);
  }
  return c;
}

/**
 * Apply an import. Everything happens in one transaction; with `dryRun` it is rolled back at the end (the summary is still exact).
 * Types are processed in dependency order (terms before posts, posts before comments).
 */
export function runImport(data: Record<string, any>, ctx: ImportOptions): ImportSummary {
  const summary: ImportSummary = {};
  const want = new Set(ctx.types);
  const has = (t: SummaryType) => want.has(t) && data[t] !== undefined;
  try {
    transaction(() => {
      if (has('media')) summary.media = runHandler(HANDLERS.media, data.media, ctx);
      if (has('settings')) summary.settings = importSettings(data.settings, ctx);
      if (has('terms')) summary.terms = runHandler(HANDLERS.terms, data.terms, ctx);
      if (has('posts')) summary.posts = runHandler(HANDLERS.posts, data.posts, ctx);
      if (has('comments')) summary.comments = importComments(data.comments, ctx);
      if (has('projects')) summary.projects = runHandler(HANDLERS.projects, data.projects, ctx);
      if (has('products')) summary.products = runHandler(HANDLERS.products, data.products, ctx);
      if (has('bar_data')) summary.bar_data = runHandler(HANDLERS.bar_data, data.bar_data, ctx);
      if (has('forms')) summary.forms = runHandler(HANDLERS.forms, data.forms, ctx);
      if (has('menus')) summary.menus = runHandler(HANDLERS.menus, data.menus, ctx);
      if (has('templates')) summary.templates = runHandler(HANDLERS.templates, data.templates, ctx);
      if (has('pages')) summary.pages = runHandler(HANDLERS.pages, data.pages, ctx);
      if (has('redirects')) summary.redirects = importRedirects(data.redirects, ctx);
      if (ctx.dryRun) throw new Rollback();
    });
  } catch (err) {
    if (!(err instanceof Rollback)) throw err;
  }
  return summary;
}
