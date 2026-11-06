// Server side of the SEO / AI tools: reads the settings, builds Next.js metadata and JSON-LD for public pages and articles.
// (Pure rules live in lib/seo-core.mjs and lib/builder/seo-*.mjs — shared with the browser.)
import type { Metadata } from 'next';
import { all, get } from './db';
import { SITE_DEFAULTS, getSiteSettings } from './settings';
import { siteUrl } from './page-admin';
import type { BNode } from './builder/types';
import { buildJsonLd, pageUrl } from './builder/seo-schema.mjs';
import { analyzeSeo } from './builder/seo-analysis.mjs';
import { postBodyToNodes } from './builder/content-text.mjs';
import {
  AI_BOTS, GENERAL_DEFAULTS, cleanGeneral, cleanLlms, cleanRobots, entityGaps, parseJson, renderTitle, resolveEntity,
} from './seo-core.mjs';

const KEYS = ['seo_general', 'seo_entity', 'seo_robots', 'seo_llms'] as const;

export type SeoSettings = ReturnType<typeof getSeo>;

/** Everything the public site and the admin screens need, with defaults and fallbacks applied. Never throws. */
export function getSeo() {
  const stored: Record<string, string> = {};
  try {
    for (const r of all<{ key: string; value: string }>(`SELECT key, value FROM settings WHERE key IN (${KEYS.map(() => '?').join(',')})`, ...KEYS)) stored[r.key] = r.value;
  } catch { /* unreadable DB: defaults */ }
  const s = getSiteSettings();
  const site = {
    title: s.site_title || SITE_DEFAULTS.title,
    tagline: s.site_tagline || SITE_DEFAULTS.tagline,
    description: s.seo_default_description || SITE_DEFAULTS.description,
    logo: s.site_logo,
    email: s.contact_email,
    phone: s.contact_phone,
    favicon: s.site_favicon || SITE_DEFAULTS.favicon,
    defaultOgImage: s.seo_default_og_image,
  };
  const general = cleanGeneral(parseJson(stored.seo_general ?? '', {}));
  const entityRaw = parseJson(stored.seo_entity ?? '', {});
  const entity = resolveEntity(entityRaw, site);
  const robots = cleanRobots(parseJson(stored.seo_robots ?? '', {}));
  const llms = cleanLlms(parseJson(stored.seo_llms ?? '', {}));
  const blockedBots = AI_BOTS.filter((b) => robots.bots[b.ua] === 'disallow').map((b) => b.ua);
  return { general, entity, entityRaw, robots, llms, site, base: siteUrl(), blockedBots, entityGaps: entityGaps(entity) };
}

// ------------------------------------------------------------------ titles + robots meta
const homeTitle = (seo: SeoSettings) => renderTitle({ ...seo.general, template: '%page% %sep% %tagline%' }, { page: seo.site.title, site: seo.site.title, tagline: seo.site.tagline });
const pageTitle = (seo: SeoSettings, title: string) => renderTitle(seo.general, { page: title, site: seo.site.title, tagline: seo.site.tagline });
/** A title that already names the site ("Dass Rebar | Rebar supplier") is used as it is: appending the site name again would repeat it. */
const namesSite = (seo: SeoSettings, title: string) => !!title && title.toLowerCase().includes(seo.site.title.toLowerCase());
const fullTitleOf = (seo: SeoSettings, title: string) => (namesSite(seo, title) ? title : pageTitle(seo, title));
const titleMeta = (seo: SeoSettings, title: string): Metadata['title'] => (namesSite(seo, title) ? { absolute: title } : title);

function robotsMeta(index: boolean, follow: boolean): NonNullable<Metadata['robots']> {
  return index
    ? { index: true, follow, googleBot: { index: true, follow, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 } }
    : { index: false, follow };
}

const toAbs = (base: string, u: string) => (!u ? '' : /^https?:\/\//i.test(u) ? u : u.startsWith('/') ? base + u : '');

/** Site-wide defaults for the root layout: title template, verification codes, base URL, default social card. */
export function rootMetadata(): Metadata {
  const seo = getSeo();
  const { general, site } = seo;
  const v = general.verify;
  const other: Record<string, string> = {};
  if (v.bing) other['msvalidate.01'] = v.bing;
  if (v.pinterest) other['p:domain_verify'] = v.pinterest;
  if (v.facebook) other['facebook-domain-verification'] = v.facebook;
  const image = site.defaultOgImage;
  return {
    metadataBase: new URL(seo.base),
    title: { default: homeTitle(seo), template: pageTitle(seo, '%s') },
    description: site.description,
    icons: { icon: site.favicon },
    applicationName: site.title,
    robots: general.noindexSite ? { index: false, follow: false } : undefined,
    verification: { google: v.google || undefined, yandex: v.yandex || undefined, other: Object.keys(other).length ? other : undefined },
    openGraph: { siteName: site.title, type: 'website', locale: general.locale, ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? 'summary_large_image' : 'summary', ...(general.twitter ? { site: `@${general.twitter}` } : {}) },
  };
}

type PageSeoRow = {
  path: string; title: string; seo_title: string; seo_description: string; og_image: string; noindex: number; nofollow: number;
  canonical_url: string; og_title: string; og_description: string; twitter_card: string; answer_summary: string;
};

/** generateMetadata for a builder page. `draft` = the page isn't published (only editors see it): never indexed. */
export function pageMetadata(page: PageSeoRow, opts: { draft?: boolean } = {}): Metadata {
  const seo = getSeo();
  const { general, site, base } = seo;
  const isHome = page.path === '';
  const url = pageUrl(base, page.path);
  const index = !(page.noindex || opts.draft || general.noindexSite);
  const follow = !(page.nofollow || opts.draft || general.noindexSite);
  const fullTitle = isHome && !page.seo_title ? homeTitle(seo) : fullTitleOf(seo, page.seo_title || page.title);
  const description = page.seo_description || site.description;
  const image = toAbs(base, page.og_image) || toAbs(base, site.defaultOgImage);
  const canonical = page.canonical_url ? (/^https?:\/\//i.test(page.canonical_url) ? page.canonical_url : base + page.canonical_url) : url;
  const ogTitle = page.og_title || fullTitle;
  const ogDescription = page.og_description || description;
  return {
    title: page.seo_title || !isHome ? titleMeta(seo, page.seo_title || page.title) : undefined,
    description: page.seo_description || undefined,
    alternates: { canonical },
    robots: robotsMeta(index, follow),
    openGraph: { type: 'website', url, siteName: site.title, locale: general.locale, title: ogTitle, description: ogDescription, ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: (page.twitter_card as 'summary' | 'summary_large_image') || (image ? 'summary_large_image' : 'summary'), title: ogTitle, description: ogDescription, ...(general.twitter ? { site: `@${general.twitter}`, creator: `@${general.twitter}` } : {}), ...(image ? { images: [image] } : {}) },
  };
}

type PostSeo = {
  slug: string; title: string; excerpt: string; seo_title: string; seo_description: string; og_image: string; cover_image: string;
  noindex?: number; nofollow?: number; canonical_url?: string; og_title?: string; og_description?: string; twitter_card?: string;
  published_at: string; updated_at?: string; authorName?: string; category?: string; tags?: { name: string }[];
};

export function postMetadata(post: PostSeo, opts: { preview?: boolean } = {}): Metadata {
  const seo = getSeo();
  const { general, site, base } = seo;
  const url = `${base}/insights/${post.slug}`;
  const index = !(post.noindex || opts.preview || general.noindexSite);
  const follow = !(post.nofollow || opts.preview || general.noindexSite);
  const description = post.seo_description || post.excerpt || site.description;
  const image = toAbs(base, post.og_image) || toAbs(base, post.cover_image) || toAbs(base, site.defaultOgImage);
  const fullTitle = fullTitleOf(seo, post.seo_title || post.title);
  const ogTitle = post.og_title || fullTitle;
  const ogDescription = post.og_description || description;
  const canonical = post.canonical_url ? (/^https?:\/\//i.test(post.canonical_url) ? post.canonical_url : base + post.canonical_url) : url;
  const stampIso = (t?: string) => (t ? t.replace(' ', 'T') + 'Z' : undefined);
  return {
    title: titleMeta(seo, post.seo_title || post.title),
    description: post.seo_description || post.excerpt || undefined,
    alternates: { canonical },
    robots: robotsMeta(index, follow),
    openGraph: {
      type: 'article', url, siteName: site.title, locale: general.locale, title: ogTitle, description: ogDescription,
      publishedTime: stampIso(post.published_at), modifiedTime: stampIso(post.updated_at), authors: post.authorName ? [post.authorName] : undefined,
      section: post.category || undefined, tags: post.tags?.map((t) => t.name),
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: { card: (post.twitter_card as 'summary' | 'summary_large_image') || (image ? 'summary_large_image' : 'summary'), title: ogTitle, description: ogDescription, ...(general.twitter ? { site: `@${general.twitter}` } : {}), ...(image ? { images: [image] } : {}) },
  };
}

// ------------------------------------------------------------------ JSON-LD
const titleOf = (path: string) => get<{ title: string }>("SELECT title FROM pages WHERE path = ? AND status = 'published'", path)?.title ?? null;

export function pageJsonLd(page: any, nodes: BNode[]): object[] {
  const seo = getSeo();
  return buildJsonLd({
    base: seo.base, siteName: seo.site.title, tagline: seo.site.tagline, entity: seo.entity, kind: 'page', page, nodes, titleOf,
    defaultImage: seo.site.defaultOgImage, locale: seo.general.locale.replace('_', '-'),
  });
}

export function postJsonLd(post: PostSeo & Record<string, any>): object[] {
  const seo = getSeo();
  return buildJsonLd({
    base: seo.base, siteName: seo.site.title, tagline: seo.site.tagline, entity: seo.entity, kind: 'post',
    post: { ...post, tags: (post.tags || []).map((t) => t.name) }, defaultImage: seo.site.defaultOgImage, locale: seo.general.locale.replace('_', '-'),
  });
}

// ------------------------------------------------------------------ analysis (server)
export function siteForAnalysis(seo: SeoSettings = getSeo()) {
  return {
    name: seo.site.title, tagline: seo.site.tagline, base: seo.base, defaultOgImage: seo.site.defaultOgImage, entity: seo.entity, entityGaps: seo.entityGaps,
    llmsEnabled: seo.llms.enabled, blockedBots: seo.blockedBots, noindexSite: seo.general.noindexSite,
  };
}

export function analyzePage(page: any, nodes: BNode[], seo: SeoSettings = getSeo()) {
  return analyzeSeo({ nodes, page, site: siteForAnalysis(seo), kind: 'page' });
}

export function analyzePost(post: any, authorName: string, seo: SeoSettings = getSeo()) {
  return analyzeSeo({
    nodes: postBodyToNodes(post.body, post.title), page: { ...post, path: post.slug }, site: siteForAnalysis(seo), kind: 'post',
    post: { authorName, published_at: post.published_at, updated_at: post.updated_at },
  });
}

export { GENERAL_DEFAULTS };
