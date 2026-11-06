// Read-side queries used by the public pages (and the CMS lists).
import { all, get, getSetting } from './db';
import { cardDate } from './format';
import { nowStamp, stampToLocalDate } from './post-time';

export type Post = {
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
};

export type TermRef = { slug: string; name: string };

export type PostCard = Post & {
  date: string;
  url: string;
  external: boolean;
  /** Categories, the primary one (the posts.category label) first. */
  categories: TermRef[];
  categorySlugs: string[];
  tags: TermRef[];
  /** Display name of the author ('' when the post has none). */
  authorName: string;
};

type PostRow = Post & { author_name?: string | null };

const LIST_COLS = `p.id, p.slug, p.title, p.category, p.excerpt, '' AS body, p.cover_image, p.external_url, p.published_at, p.status, p.featured,
  p.author_id, p.comments_enabled, p.seo_title, p.seo_description, p.og_image, u.name AS author_name`;

/** One query for the categories + tags of many posts (no N+1). */
export function termsFor(ids: number[]) {
  const map = new Map<number, { categories: TermRef[]; tags: TermRef[] }>();
  if (!ids.length) return map;
  const rows = all<{ post_id: number; taxonomy: string; slug: string; name: string }>(
    `SELECT pt.post_id, t.taxonomy, t.slug, t.name FROM post_terms pt JOIN terms t ON t.id = pt.term_id
     WHERE pt.post_id IN (${ids.map(() => '?').join(',')}) ORDER BY t.name`,
    ...ids
  );
  for (const r of rows) {
    const e = map.get(r.post_id) ?? { categories: [], tags: [] };
    (r.taxonomy === 'category' ? e.categories : e.tags).push({ slug: r.slug, name: r.name });
    map.set(r.post_id, e);
  }
  return map;
}

function toCards(rows: PostRow[]): PostCard[] {
  const terms = termsFor(rows.map((r) => r.id));
  return rows.map(({ author_name, ...p }) => {
    const external = !!p.external_url;
    const t = terms.get(p.id) ?? { categories: [], tags: [] };
    const categories = [...t.categories].sort((a, b) => Number(b.name === p.category) - Number(a.name === p.category)); // primary first
    return {
      ...p,
      date: cardDate(stampToLocalDate(p.published_at)),
      url: external ? p.external_url : `/insights/${p.slug}`,
      external,
      categories,
      categorySlugs: categories.map((c) => c.slug),
      tags: t.tags,
      authorName: author_name || '',
    };
  });
}

/** Published posts (publish date already reached), newest first. The (long) body text is left out — lists don't need it. Optional category slug filter. */
export function getPosts(limit = 200, category?: string): PostCard[] {
  const args: (string | number)[] = [nowStamp()];
  let cat = '';
  if (category) {
    cat = `AND EXISTS (SELECT 1 FROM post_terms pt JOIN terms t ON t.id = pt.term_id WHERE pt.post_id = p.id AND t.taxonomy = 'category' AND t.slug = ?)`;
    args.push(category);
  }
  args.push(limit);
  return toCards(
    all<PostRow>(
      `SELECT ${LIST_COLS} FROM posts p LEFT JOIN users u ON u.id = p.author_id
       WHERE p.status = 'published' AND p.published_at <= ? ${cat} ORDER BY p.published_at DESC, p.id DESC LIMIT ?`,
      ...args
    )
  );
}

/** Featured post for the top of the Insights page (newest flagged one, else the newest post). */
export function splitFeatured(posts: PostCard[]) {
  const featured = posts.find((p) => p.featured) ?? posts[0] ?? null;
  return { featured, rest: posts.filter((p) => p !== featured) };
}

/**
 * A single article page. Only published posts whose date has arrived are returned — unless `preview` is set
 * (the caller has checked that a signed-in editor asked for it), which also returns drafts and scheduled posts.
 * Posts with an external link have no page of their own on this site.
 */
export function getPostBySlug(slug: string, opts: { preview?: boolean } = {}): PostCard | null {
  const where = opts.preview ? "p.status != 'trash'" : "p.status = 'published' AND p.published_at <= ?";
  const row = get<PostRow>(
    `SELECT p.*, u.name AS author_name FROM posts p LEFT JOIN users u ON u.id = p.author_id WHERE p.slug = ? AND p.external_url = '' AND ${where}`,
    ...(opts.preview ? [slug] : [slug, nowStamp()])
  );
  return row ? toCards([row])[0] : null;
}

/** Previous (older) and next (newer) published article of this site, for the links at the bottom of a post. */
export function getAdjacentPosts(post: Pick<Post, 'id' | 'published_at'>): { prev: PostCard | null; next: PostCard | null } {
  const now = nowStamp();
  const one = (cmp: string, order: string) =>
    all<PostRow>(
      `SELECT ${LIST_COLS} FROM posts p LEFT JOIN users u ON u.id = p.author_id
       WHERE p.status = 'published' AND p.external_url = '' AND p.published_at <= ? AND p.id != ?
       AND (p.published_at ${cmp} ? OR (p.published_at = ? AND p.id ${cmp} ?)) ORDER BY p.published_at ${order}, p.id ${order} LIMIT 1`,
      now, post.id, post.published_at, post.published_at, post.id
    );
  const prev = toCards(one('<', 'DESC'))[0] ?? null;
  const next = toCards(one('>', 'ASC'))[0] ?? null;
  return { prev, next };
}

export type Project = {
  id: number;
  slug: string;
  title: string;
  category: string;
  location: string;
  address: string;
  images: string[];
  featured: number;
  roster: number;
  sort_order: number;
  published: number;
};

export function parseImages(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Second line on a project card: "799 Sheppard Avenue West, Toronto" (no repeat if the address already names the place). */
export function projectSubtitle(p: Pick<Project, 'address' | 'location'>): string {
  if (!p.address) return p.location;
  if (!p.location || p.address.toLowerCase().includes(p.location.toLowerCase())) return p.address;
  return `${p.address}, ${p.location}`;
}

export function getProjects() {
  const rows = all<any>('SELECT * FROM projects WHERE published = 1 ORDER BY sort_order, id').map((r): Project => ({ ...r, images: parseImages(r.images) }));
  const featured = rows.filter((p) => p.featured);
  const others = rows.filter((p) => !p.featured);
  return { featured, others, roster: others.filter((p) => p.roster), total: rows.length };
}

export type Product = { id: number; kind: 'stocked' | 'also'; name: string; sizes: string; description: string; image: string; sort_order: number; published: number };

export function getProducts() {
  const rows = all<Product>('SELECT * FROM products WHERE published = 1 ORDER BY sort_order, id');
  return { stocked: rows.filter((p) => p.kind === 'stocked'), also: rows.filter((p) => p.kind === 'also') };
}

export type BarRow = {
  id: number;
  bar_size: string;
  mass_kg_m: number;
  nominal_diameter_mm: number;
  area_mm2: number;
  perimeter_mm: number;
  on_request: number;
  sort_order: number;
};

export function getBarData(): BarRow[] {
  return all<BarRow>('SELECT * FROM bar_data ORDER BY sort_order, id');
}

export function getDiagrams() {
  return {
    nominal: getSetting('bar_diagram_nominal'),
    side: getSetting('bar_diagram_side'),
    actual: getSetting('bar_diagram_actual'),
  };
}
