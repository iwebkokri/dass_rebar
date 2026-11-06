// Admin-side helpers for posts: permissions, lists, taxonomy sync, revisions. (Public reads live in lib/content.ts.)
import { all, get, run } from './db';
import { nowStamp } from './post-time';
import { slugify } from './slug.mjs';
import { can } from './roles';

export type PostRow = {
  id: number;
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  cover_image: string;
  external_url: string;
  published_at: string;
  status: 'draft' | 'published' | 'trash';
  featured: number;
  author_id: number | null;
  comments_enabled: number;
  seo_title: string;
  seo_description: string;
  og_image: string;
  created_at: string;
  updated_at: string;
};

export type Term = { id: number; slug: string; name: string; description: string; taxonomy: 'category' | 'tag' };
type User = { id: number; role?: string };

/** Authors may only touch their own posts; everyone with edit_others_posts may touch all of them. */
export function canEditPost(user: User, post: Pick<PostRow, 'author_id'>): boolean {
  return can(user, 'edit_posts') && (post.author_id === user.id || can(user, 'edit_others_posts'));
}

export const PUBLIC_STATES = ['published', 'draft', 'scheduled', 'trash'] as const;
export type Tab = 'all' | 'published' | 'draft' | 'scheduled' | 'trash';
export const TABS: Tab[] = ['all', 'published', 'draft', 'scheduled', 'trash'];

/** Display state of a row: trash | draft | scheduled | published. */
export function postState(p: Pick<PostRow, 'status' | 'published_at'>): 'trash' | 'draft' | 'scheduled' | 'published' {
  if (p.status === 'trash') return 'trash';
  if (p.status === 'draft') return 'draft';
  return p.published_at > nowStamp() ? 'scheduled' : 'published';
}

// ------------------------------------------------------------------ taxonomy
export function allTerms(taxonomy: 'category' | 'tag'): Term[] {
  return all<Term>('SELECT id, slug, name, description, taxonomy FROM terms WHERE taxonomy = ? ORDER BY name COLLATE NOCASE', taxonomy);
}

export function uniqueTermSlug(taxonomy: string, base: string, excludeId = 0): string {
  let slug = base;
  for (let n = 2; get('SELECT 1 AS x FROM terms WHERE taxonomy = ? AND slug = ? AND id != ?', taxonomy, slug, excludeId); n++) slug = `${base}-${n}`;
  return slug;
}

/** Find a term by name (via its slug) or create it. Returns its id. */
export function ensureTerm(taxonomy: 'category' | 'tag', rawName: string): number | null {
  const name = rawName.replace(/\s+/g, ' ').trim().slice(0, 60);
  if (!name) return null;
  const slug = slugify(name);
  const have = get<{ id: number }>('SELECT id FROM terms WHERE taxonomy = ? AND slug = ?', taxonomy, slug);
  if (have) return have.id;
  return run('INSERT INTO terms (taxonomy, name, slug) VALUES (?, ?, ?)', taxonomy, name, slug).lastInsertRowid;
}

/** Categories and tags currently attached to a post. primaryId = the category named by posts.category (else the first one). */
export function termsOfPost(postId: number, primaryName: string) {
  const rows = all<{ id: number; name: string; taxonomy: string }>(
    'SELECT t.id, t.name, t.taxonomy FROM post_terms pt JOIN terms t ON t.id = pt.term_id WHERE pt.post_id = ? ORDER BY t.name COLLATE NOCASE',
    postId
  );
  const cats = rows.filter((r) => r.taxonomy === 'category');
  const primary = cats.find((c) => c.name === primaryName) ?? cats[0];
  return { categoryIds: cats.map((c) => c.id), primaryId: primary?.id ?? 0, tags: rows.filter((r) => r.taxonomy === 'tag').map((r) => r.name) };
}

/** Replace a post's categories (primary first) and tags, and keep posts.category = the primary category's name. */
export function syncPostTerms(postId: number, categoryIds: number[], tagIds: number[]) {
  run('DELETE FROM post_terms WHERE post_id = ?', postId);
  for (const id of new Set([...categoryIds, ...tagIds])) run('INSERT OR IGNORE INTO post_terms (post_id, term_id) VALUES (?, ?)', postId, id);
  const first = categoryIds[0];
  const name = first ? get<{ name: string }>('SELECT name FROM terms WHERE id = ?', first)?.name ?? '' : '';
  run('UPDATE posts SET category = ? WHERE id = ?', name, postId);
}

/** After a category was renamed / deleted: re-derive posts.category for the posts that used it. */
export function refreshPrimaryCategory(postIds: number[]) {
  for (const id of postIds) {
    const post = get<{ category: string }>('SELECT category FROM posts WHERE id = ?', id);
    const t = termsOfPost(id, post?.category ?? '');
    const name = t.primaryId ? get<{ name: string }>('SELECT name FROM terms WHERE id = ?', t.primaryId)?.name ?? '' : '';
    run('UPDATE posts SET category = ? WHERE id = ?', name, id);
  }
}

// ------------------------------------------------------------------ slugs, revisions
export function uniquePostSlug(base: string, excludeId = 0): string {
  let slug = base;
  for (let n = 2; get('SELECT 1 AS x FROM posts WHERE slug = ? AND id != ?', slug, excludeId); n++) slug = `${base}-${n}`;
  return slug;
}

const MAX_REVISIONS = 50;

/** Keep the previous title/body so an edit can be undone (skipped when it would duplicate the latest revision). */
export function saveRevision(postId: number, userId: number | null, title: string, body: string, note: string) {
  const last = get<{ title: string; content: string }>(
    "SELECT title, content FROM revisions WHERE entity = 'post' AND entity_id = ? ORDER BY id DESC LIMIT 1",
    postId
  );
  if (last && last.title === title && last.content === body) return;
  run("INSERT INTO revisions (entity, entity_id, title, content, user_id, note) VALUES ('post', ?, ?, ?, ?, ?)", postId, title, body, userId, note.slice(0, 200));
  run(
    `DELETE FROM revisions WHERE entity = 'post' AND entity_id = ? AND id NOT IN
     (SELECT id FROM revisions WHERE entity = 'post' AND entity_id = ? ORDER BY id DESC LIMIT ${MAX_REVISIONS})`,
    postId, postId
  );
}

export type Revision = { id: number; title: string; content: string; note: string; created_at: string; user_name: string | null };

export function listRevisions(postId: number): Revision[] {
  return all<Revision>(
    `SELECT r.id, r.title, r.content, r.note, r.created_at, COALESCE(NULLIF(u.name, ''), u.email) AS user_name
     FROM revisions r LEFT JOIN users u ON u.id = r.user_id WHERE r.entity = 'post' AND r.entity_id = ? ORDER BY r.id DESC LIMIT 20`,
    postId
  );
}

// ------------------------------------------------------------------ list
export type ListFilters = { tab: Tab; q: string; cat: string; author: number; page: number };
export const PAGE_SIZE = 20;

const likeEsc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function tabClause(tab: Tab, now: string): { sql: string; args: string[] } {
  switch (tab) {
    case 'published': return { sql: "p.status = 'published' AND p.published_at <= ?", args: [now] };
    case 'scheduled': return { sql: "p.status = 'published' AND p.published_at > ?", args: [now] };
    case 'draft': return { sql: "p.status = 'draft'", args: [] };
    case 'trash': return { sql: "p.status = 'trash'", args: [] };
    default: return { sql: "p.status != 'trash'", args: [] };
  }
}

export function listPosts(user: User, f: ListFilters) {
  const now = nowStamp();
  const scope = can(user, 'edit_others_posts') ? { sql: '1 = 1', args: [] as (string | number)[] } : { sql: 'p.author_id = ?', args: [user.id] };

  const where = [scope.sql];
  const args: (string | number)[] = [...scope.args];
  const t = tabClause(f.tab, now);
  where.push(t.sql);
  args.push(...t.args);
  if (f.q) {
    where.push("(p.title LIKE ? ESCAPE '\\' OR p.slug LIKE ? ESCAPE '\\' OR p.excerpt LIKE ? ESCAPE '\\')");
    const like = `%${likeEsc(f.q)}%`;
    args.push(like, like, like);
  }
  if (f.cat) {
    where.push("EXISTS (SELECT 1 FROM post_terms pt JOIN terms t ON t.id = pt.term_id WHERE pt.post_id = p.id AND t.taxonomy = 'category' AND t.slug = ?)");
    args.push(f.cat);
  }
  if (f.author) {
    where.push('p.author_id = ?');
    args.push(f.author);
  }
  const clause = where.join(' AND ');
  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM posts p WHERE ${clause}`, ...args)?.c ?? 0;
  const orderBy = f.tab === 'trash' ? 'p.updated_at DESC' : 'p.published_at DESC';
  const rows = all<PostRow & { author_name: string | null }>(
    `SELECT p.id, p.slug, p.title, p.category, p.status, p.published_at, p.updated_at, p.external_url, p.author_id, p.featured, p.comments_enabled,
            COALESCE(NULLIF(u.name, ''), u.email) AS author_name
     FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE ${clause} ORDER BY ${orderBy}, p.id DESC LIMIT ${PAGE_SIZE} OFFSET ${(Math.max(1, f.page) - 1) * PAGE_SIZE}`,
    ...args
  );

  const counts: Record<Tab, number> = { all: 0, published: 0, draft: 0, scheduled: 0, trash: 0 };
  for (const r of all<{ k: string; c: number }>(
    `SELECT CASE WHEN p.status = 'trash' THEN 'trash' WHEN p.status = 'draft' THEN 'draft' WHEN p.published_at > ? THEN 'scheduled' ELSE 'published' END AS k, COUNT(*) AS c
     FROM posts p WHERE ${scope.sql} GROUP BY k`,
    now, ...scope.args
  )) {
    counts[r.k as Tab] = r.c;
    if (r.k !== 'trash') counts.all += r.c;
  }
  return { rows, total, counts };
}
