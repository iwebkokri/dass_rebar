// Media library: records in the `media` table + files under data/uploads/YYYY/MM/. Server-only.
import { randomBytes } from 'node:crypto';
import { mkdir, unlink, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { all, get, run, transaction } from './db';
import { sniffUpload, type Sniffed } from './media-sniff';
import { MEDIA_TYPES, extOf, type MediaItem, type MediaKind, type MediaList } from './media-types';
import { can } from './roles';
import { UploadError, safeJoin, uploadsDir } from './uploads';

export { UploadError };
export type { MediaItem, MediaList } from './media-types';

type Actor = { id: number; role?: string };
type Row = Omit<MediaItem, 'editable' | 'deletable'>;

export const PER_PAGE = 40;
const URL_PREFIX = '/uploads/';

// ---- who may do what --------------------------------------------------------
const others = (u: Actor | null) => can(u, 'edit_others_media');
/** Authors only see their own uploads; editors / administrators see everything. */
export const canSee = (u: Actor, r: Pick<Row, 'user_id'>) => others(u) || r.user_id === u.id;
/** Alt / title / caption / folder. */
export const canEditMeta = (u: Actor, r: Pick<Row, 'user_id' | 'storage'>) => (r.storage === 'public' ? others(u) : canSee(u, r));
/** Delete or replace the file. Files shipped with the site (storage 'public') are read-only. */
export const canDelete = (u: Actor, r: Pick<Row, 'user_id' | 'storage'>) => r.storage === 'upload' && canSee(u, r);

function decorate(u: Actor, r: Row): MediaItem {
  return { ...r, editable: canEditMeta(u, r), deletable: canDelete(u, r) };
}

// ---- helpers ----------------------------------------------------------------
const clip = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

export function cleanFolder(v: unknown): string {
  return clip(v, 40).replace(/[\\/<>"'`]/g, '');
}

function safeBase(original: string): string {
  const base = path.basename(original.replace(/\\/g, '/'));
  const noExt = base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base;
  const slug = noExt
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return slug || 'file';
}

/** File path on disk for a stored upload URL ('/uploads/2026/11/x.jpg'); null for anything else / traversal attempts. */
export function filePathForUrl(url: string): string | null {
  if (!url.startsWith(URL_PREFIX)) return null;
  const parts = url.slice(URL_PREFIX.length).split('/');
  if (parts.some((p) => !p || p === '.' || p === '..' || /[\\:\u0000]/.test(p))) return null;
  return safeJoin(uploadsDir(), ...parts);
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// ---- queries ----------------------------------------------------------------
export type ListOpts = { kind?: string; q?: string; folder?: string; date?: string; page?: number; per?: number };

export function listMedia(user: Actor, o: ListOpts = {}): MediaList {
  const where: string[] = [];
  const args: (string | number)[] = [];

  if (!others(user)) {
    where.push('m.user_id = ?');
    args.push(user.id);
  }
  const kinds = String(o.kind ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k): k is MediaKind => ['image', 'video', 'audio', 'file'].includes(k));
  if (kinds.length) {
    where.push(`m.kind IN (${kinds.map(() => '?').join(',')})`);
    args.push(...kinds);
  }
  const q = clip(o.q, 100);
  if (q) {
    const like = `%${escapeLike(q)}%`;
    where.push(`(m.original_name LIKE ? ESCAPE '\\' OR m.filename LIKE ? ESCAPE '\\' OR m.title LIKE ? ESCAPE '\\' OR m.alt LIKE ? ESCAPE '\\' OR m.caption LIKE ? ESCAPE '\\')`);
    args.push(like, like, like, like, like);
  }
  const folder = cleanFolder(o.folder);
  if (folder) {
    where.push('m.folder = ?');
    args.push(folder);
  }
  if (o.date && /^\d{4}-\d{2}$/.test(o.date)) {
    where.push('substr(m.created_at, 1, 7) = ?');
    args.push(o.date);
  }

  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const per = Math.min(100, Math.max(1, Math.trunc(Number(o.per)) || PER_PAGE));
  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM media m ${w}`, ...args)?.c ?? 0;
  const pages = Math.max(1, Math.ceil(total / per));
  const page = Math.min(pages, Math.max(1, Math.trunc(Number(o.page)) || 1));
  const rows = all<Row>(
    `SELECT m.*, u.name AS author FROM media m LEFT JOIN users u ON u.id = m.user_id ${w} ORDER BY m.id DESC LIMIT ? OFFSET ?`,
    ...args,
    per,
    (page - 1) * per
  );
  return { items: rows.map((r) => decorate(user, r)), total, page, pages, folders: listFolders(user) };
}

export function listFolders(user: Actor): string[] {
  const own = others(user) ? '' : 'AND user_id = ?';
  return all<{ folder: string }>(`SELECT DISTINCT folder FROM media WHERE folder <> '' ${own} ORDER BY folder COLLATE NOCASE`, ...(others(user) ? [] : [user.id])).map((r) => r.folder);
}

/** Months that have media, newest first: ['2026-11', '2026-10', …] */
export function listMonths(user: Actor): string[] {
  const own = others(user) ? '' : 'WHERE user_id = ?';
  return all<{ m: string }>(`SELECT DISTINCT substr(created_at, 1, 7) AS m FROM media ${own} ORDER BY m DESC`, ...(others(user) ? [] : [user.id])).map((r) => r.m);
}

/** One record as the user sees it, or null when it doesn't exist / the user may not see it. */
export function getMedia(user: Actor, id: number): MediaItem | null {
  const r = get<Row>('SELECT m.*, u.name AS author FROM media m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = ?', id);
  return r && canSee(user, r) ? decorate(user, r) : null;
}

/** Is this URL a registered media file (optionally of a given kind)? Use it to validate URLs that arrive from a form. */
export function isKnownMediaUrl(url: string, kind?: MediaKind): boolean {
  if (!url) return false;
  const r = get<{ kind: string }>('SELECT kind FROM media WHERE url = ?', url);
  return !!r && (!kind || r.kind === kind);
}

// ---- create / replace --------------------------------------------------------
function monthDir(d = new Date()) {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function need(file: { name: string }, sn: Sniffed | null): Sniffed {
  if (!sn) throw new UploadError(`"${file.name}" isn't an allowed file type (images JPG/PNG/GIF/WebP/AVIF, MP4/WebM video, PDF, Word, Excel, PowerPoint, CSV, TXT, ZIP) or its contents don't match its name.`);
  return sn;
}

/** Cheap size check before the file is read into memory: by the limit of its extension (any limit if the extension is unknown). */
function preCheckSize(file: { name: string; size: number }) {
  const max = MEDIA_TYPES[extOf(file.name)]?.max ?? Math.max(...Object.values(MEDIA_TYPES).map((r) => r.max));
  if (file.size > max) throw new UploadError(`"${file.name}" is larger than ${Math.round(max / 1024 / 1024)} MB.`);
  if (file.size <= 0) throw new UploadError(`"${file.name}" is empty.`);
}

function checkSize(name: string, size: number, ext: string) {
  const max = MEDIA_TYPES[ext].max;
  if (size > max) throw new UploadError(`"${name}" is larger than ${Math.round(max / 1024 / 1024)} MB.`);
  if (size <= 0) throw new UploadError(`"${name}" is empty.`);
}

/** Validate, store and register an uploaded file. Throws UploadError with a user-readable message. */
export async function createMediaFromFile(file: File, user: Actor | null, opts: { folder?: string; alt?: string; imagesOnly?: boolean } = {}): Promise<Row> {
  preCheckSize(file);
  const buf = Buffer.from(await file.arrayBuffer());
  const sn = need(file, sniffUpload(buf, file.name));
  if (opts.imagesOnly && sn.kind !== 'image') throw new UploadError(`"${file.name}" is not a JPG, PNG, GIF, WebP or AVIF image.`);
  checkSize(file.name, buf.length, sn.ext);

  const rel = monthDir();
  const name = `${safeBase(file.name)}-${randomBytes(3).toString('hex')}.${sn.ext}`;
  const dir = path.join(uploadsDir(), ...rel.split('/'));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf, { flag: 'wx' });

  const original = clip(path.basename(file.name.replace(/\\/g, '/')), 200);
  const title = clip(original.replace(/\.[^.]*$/, '').replace(/[-_]+/g, ' '), 200);
  const url = `${URL_PREFIX}${rel}/${name}`;
  try {
    const r = run(
      `INSERT INTO media (url, storage, filename, original_name, mime, kind, size, width, height, alt, title, folder, user_id)
       VALUES (?, 'upload', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      url, name, original, sn.mime, sn.kind, buf.length, sn.width, sn.height, clip(opts.alt, 300), title, cleanFolder(opts.folder), user?.id ?? null
    );
    return get<Row>('SELECT m.*, u.name AS author FROM media m LEFT JOIN users u ON u.id = m.user_id WHERE m.id = ?', r.lastInsertRowid)!;
  } catch (err) {
    await unlink(path.join(dir, name)).catch(() => {});
    throw err;
  }
}

/** Replace the file behind a record: same URL, same record, new bytes (must be the same file type). */
export async function replaceMediaFile(user: Actor, id: number, file: File): Promise<MediaItem> {
  const rec = get<Row>('SELECT * FROM media WHERE id = ?', id);
  if (!rec || !canSee(user, rec)) throw new UploadError('That file no longer exists.');
  if (!canDelete(user, rec)) throw new UploadError("This file belongs to the site and can't be replaced here.");
  const target = filePathForUrl(rec.url);
  if (!target) throw new UploadError('This file cannot be replaced.');

  preCheckSize(file);
  const buf = Buffer.from(await file.arrayBuffer());
  const sn = need(file, sniffUpload(buf, file.name));
  checkSize(file.name, buf.length, sn.ext);
  if (sn.ext !== extOf(rec.url)) throw new UploadError(`The replacement must be the same type as the original (.${extOf(rec.url)}), not .${sn.ext}.`);

  await writeFile(target, buf); // in place: the record and the URL stay the same
  const now = new Date();
  await utimes(target, now, now).catch(() => {}); // the /uploads route notices "modified after creation" and stops using immutable caching
  run('UPDATE media SET size = ?, width = ?, height = ?, mime = ?, original_name = ? WHERE id = ?', buf.length, sn.width, sn.height, sn.mime, clip(path.basename(file.name.replace(/\\/g, '/')), 200), id);
  return getMedia(user, id)!;
}

// ---- update / delete ----------------------------------------------------------
export function updateMedia(user: Actor, id: number, data: { alt?: string; title?: string; caption?: string; folder?: string }): MediaItem {
  const rec = get<Row>('SELECT * FROM media WHERE id = ?', id);
  if (!rec || !canSee(user, rec)) throw new UploadError('That file no longer exists.');
  if (!canEditMeta(user, rec)) throw new UploadError("You can't edit this file.");
  run(
    'UPDATE media SET alt = ?, title = ?, caption = ?, folder = ? WHERE id = ?',
    data.alt === undefined ? rec.alt : clip(data.alt, 300),
    data.title === undefined ? rec.title : clip(data.title, 200),
    data.caption === undefined ? rec.caption : clip(data.caption, 500),
    data.folder === undefined ? rec.folder : cleanFolder(data.folder),
    id
  );
  return getMedia(user, id)!;
}

export function moveMedia(user: Actor, ids: number[], folder: string): number {
  const f = cleanFolder(folder);
  let n = 0;
  transaction(() => {
    for (const id of ids) {
      const rec = get<Row>('SELECT * FROM media WHERE id = ?', id);
      if (rec && canEditMeta(user, rec)) {
        run('UPDATE media SET folder = ? WHERE id = ?', f, id);
        n++;
      }
    }
  });
  return n;
}

/** Delete record + file. Returns false when the user may not (public files, other people's uploads). */
export async function deleteMedia(user: Actor, id: number): Promise<{ ok: boolean; name: string }> {
  const rec = get<Row>('SELECT * FROM media WHERE id = ?', id);
  if (!rec || !canDelete(user, rec)) return { ok: false, name: rec?.original_name || rec?.filename || '' };
  run('DELETE FROM media WHERE id = ?', id);
  const file = filePathForUrl(rec.url);
  if (file) await unlink(file).catch(() => {});
  return { ok: true, name: rec.original_name || rec.filename };
}

// ---- usage ------------------------------------------------------------------
export type Usage = { type: string; label: string; href: string };

/** Everywhere the site stores this URL: pages, templates, posts, projects, products, menus, settings. */
export function findUsage(url: string): Usage[] {
  if (!url) return [];
  const out: Usage[] = [];
  const add = (type: string, label: string, href: string) => out.push({ type, label: label || '(untitled)', href });
  for (const p of all<{ id: number; title: string }>('SELECT id, title FROM pages WHERE instr(content, ?) > 0 OR og_image = ?', url, url)) add('Page', p.title, `/admin/pages/${p.id}`);
  for (const t of all<{ id: number; name: string; kind: string }>('SELECT id, name, kind FROM templates WHERE instr(content, ?) > 0', url)) add(`Template (${t.kind})`, t.name, '/admin/templates');
  for (const p of all<{ id: number; title: string }>('SELECT id, title FROM posts WHERE cover_image = ? OR og_image = ? OR instr(body, ?) > 0', url, url, url)) add('Post', p.title, `/admin/posts/${p.id}`);
  for (const p of all<{ id: number; title: string }>('SELECT id, title FROM projects WHERE instr(images, ?) > 0', url)) add('Project', p.title, `/admin/projects/${p.id}`);
  for (const p of all<{ id: number; name: string }>('SELECT id, name FROM products WHERE image = ?', url)) add('Product', p.name, `/admin/products/${p.id}`);
  for (const m of all<{ id: number; name: string }>('SELECT id, name FROM menus WHERE instr(items, ?) > 0', url)) add('Menu', m.name, '/admin/menus');
  for (const s of all<{ key: string }>('SELECT key FROM settings WHERE instr(value, ?) > 0', url)) add('Setting', s.key, '/admin/settings');
  return out;
}
