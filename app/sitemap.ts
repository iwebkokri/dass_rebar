import type { MetadataRoute } from 'next';
import { all, get } from '@/lib/db';
import { nowUtc, siteUrl } from '@/lib/page-admin';
import { getSeo } from '@/lib/seo';

// Built from the database on every request (never at build time): published, indexable pages + published, non-external, indexable posts.
// Left out: noindex pages / posts, pages whose canonical address points somewhere else, and everything while the whole site is hidden
// from search engines (SEO → General).
export const dynamic = 'force-dynamic';

const asDate = (stamp: string | null | undefined) => {
  if (!stamp) return undefined;
  const d = new Date(stamp.length <= 10 ? `${stamp}T00:00:00Z` : stamp.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? undefined : d;
};

const strip = (u: string) => u.replace(/\/+$/, '');

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = nowUtc();
  const out: MetadataRoute.Sitemap = [];

  try {
    if (getSeo().general.noindexSite) return [];
    const pages = all<{ path: string; updated_at: string; canonical_url: string }>(
      "SELECT path, updated_at, canonical_url FROM pages WHERE status = 'published' AND noindex = 0 AND (published_at IS NULL OR published_at <= ?) ORDER BY path",
      now
    );
    for (const p of pages) {
      const url = p.path ? `${base}/${p.path}` : `${base}/`;
      if (p.canonical_url && strip(/^https?:\/\//i.test(p.canonical_url) ? p.canonical_url : base + p.canonical_url) !== strip(url)) continue;
      out.push({ url, lastModified: asDate(p.updated_at), changeFrequency: p.path ? 'monthly' : 'weekly', priority: p.path ? 0.7 : 1 });
    }
    // the article list is a built-in route; include it until it exists as a page of its own
    if (!get('SELECT 1 AS x FROM pages WHERE path = ?', 'insights')) out.push({ url: `${base}/insights`, changeFrequency: 'weekly', priority: 0.6 });

    const posts = all<{ slug: string; published_at: string; updated_at: string; canonical_url: string }>(
      "SELECT slug, published_at, updated_at, canonical_url FROM posts WHERE status = 'published' AND external_url = '' AND noindex = 0 AND published_at <= ? ORDER BY published_at DESC",
      now
    );
    for (const p of posts) {
      const url = `${base}/insights/${p.slug}`;
      if (p.canonical_url && strip(/^https?:\/\//i.test(p.canonical_url) ? p.canonical_url : base + p.canonical_url) !== strip(url)) continue;
      out.push({ url, lastModified: asDate(p.updated_at) ?? asDate(p.published_at), changeFrequency: 'yearly', priority: 0.5 });
    }
  } catch {
    /* empty or unreadable database: serve whatever we have */
  }
  return out;
}
