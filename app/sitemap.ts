import type { MetadataRoute } from 'next';
import { all, get } from '@/lib/db';
import { nowUtc, siteUrl } from '@/lib/page-admin';

// Built from the database on every request (never at build time): published, indexable pages + published, non-external posts.
export const dynamic = 'force-dynamic';

const asDate = (stamp: string | null | undefined) => {
  if (!stamp) return undefined;
  const d = new Date(stamp.length <= 10 ? `${stamp}T00:00:00Z` : stamp.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? undefined : d;
};

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = nowUtc();
  const out: MetadataRoute.Sitemap = [];

  try {
    const pages = all<{ path: string; updated_at: string }>(
      "SELECT path, updated_at FROM pages WHERE status = 'published' AND noindex = 0 AND (published_at IS NULL OR published_at <= ?) ORDER BY path",
      now
    );
    for (const p of pages) {
      out.push({ url: p.path ? `${base}/${p.path}` : `${base}/`, lastModified: asDate(p.updated_at), changeFrequency: p.path ? 'monthly' : 'weekly', priority: p.path ? 0.7 : 1 });
    }
    // the article list is a built-in route; include it until it exists as a page of its own
    if (!get('SELECT 1 AS x FROM pages WHERE path = ?', 'insights')) out.push({ url: `${base}/insights`, changeFrequency: 'weekly', priority: 0.6 });

    const posts = all<{ slug: string; published_at: string; updated_at: string }>(
      "SELECT slug, published_at, updated_at FROM posts WHERE status = 'published' AND external_url = '' AND published_at <= ? ORDER BY published_at DESC",
      now
    );
    for (const p of posts) out.push({ url: `${base}/insights/${p.slug}`, lastModified: asDate(p.updated_at) ?? asDate(p.published_at), changeFrequency: 'yearly', priority: 0.5 });
  } catch {
    /* empty or unreadable database: serve whatever we have */
  }
  return out;
}
