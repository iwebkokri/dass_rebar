// JSON-LD (schema.org structured data) for public pages and articles. Pure: the server renders it into the page, and the
// admin / builder previews the very same output.
import { extractContent } from './content-text.mjs';

const CTX = 'https://schema.org';
const PLAIN_ORG_TYPES = new Set(['Organization', 'Corporation']); // these types don't take geo / opening hours

/** 'YYYY-MM-DD HH:MM:SS' (UTC, as SQLite stores it) -> ISO 8601. */
export function iso(stamp) {
  const t = String(stamp ?? '').trim();
  if (!t) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)/.exec(t);
  return m ? `${m[1]}T${m[2].length === 5 ? m[2] + ':00' : m[2]}Z` : undefined;
}

/** Absolute URL from a site path or URL; '' when it can't be made absolute. */
export function abs(base, url) {
  const u = String(url ?? '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith('/') && !u.startsWith('//')) return base + u;
  return '';
}

export const pageUrl = (base, path) => (path ? `${base}/${path}` : `${base}/`);

const titleize = (seg) => seg.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const AUTO_TYPE = { about: 'AboutPage', contact: 'ContactPage', insights: 'CollectionPage', products: 'CollectionPage', projects: 'CollectionPage', services: 'CollectionPage' };
export const pageSchemaType = (path, chosen) => chosen || AUTO_TYPE[path] || 'WebPage';

const drop = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)));

/** The business as an Organization / LocalBusiness node. */
export function organizationNode(entity, base, { siteName, defaultImage } = {}) {
  const e = entity;
  const logo = abs(base, e.logo);
  const hasAddress = e.street || e.city || e.region || e.postal || e.country;
  const place = !PLAIN_ORG_TYPES.has(e.type);
  return drop({
    '@context': CTX,
    '@type': e.type || 'Organization',
    '@id': `${base}/#organization`,
    name: e.name || siteName,
    legalName: e.legal && e.legal !== e.name ? e.legal : undefined,
    url: `${base}/`,
    logo: logo ? { '@type': 'ImageObject', url: logo } : undefined,
    image: logo || abs(base, defaultImage) || undefined,
    description: e.description,
    foundingDate: e.founded,
    email: e.email,
    telephone: e.phone,
    address: hasAddress ? drop({ '@type': 'PostalAddress', streetAddress: e.street, addressLocality: e.city, addressRegion: e.region, postalCode: e.postal, addressCountry: e.country }) : undefined,
    geo: place && e.lat && e.lng ? { '@type': 'GeoCoordinates', latitude: Number(e.lat), longitude: Number(e.lng) } : undefined,
    openingHours: place ? e.hours : undefined,
    areaServed: (e.areas || []).map((name) => ({ '@type': 'Place', name })),
    sameAs: e.sameAs,
  });
}

function breadcrumbNode(base, segments, titleOf, last) {
  const items = [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/` }];
  let acc = '';
  segments.forEach((seg, i) => {
    acc += (acc ? '/' : '') + seg;
    const isLast = i === segments.length - 1;
    items.push({ '@type': 'ListItem', position: items.length + 1, name: isLast ? last.name : titleOf?.(acc) || titleize(seg), item: isLast ? last.url : pageUrl(base, acc) });
  });
  return { '@context': CTX, '@type': 'BreadcrumbList', '@id': `${last.url}#breadcrumb`, itemListElement: items };
}

function faqNode(nodes, url) {
  const seen = new Set();
  const list = [];
  for (const f of extractContent(nodes).faqs) {
    const k = f.q.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    list.push({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } });
    if (list.length >= 50) break;
  }
  return list.length ? { '@context': CTX, '@type': 'FAQPage', '@id': `${url}#faq`, mainEntity: list } : null;
}

function customNodes(text) {
  if (!text) return [];
  try {
    const v = JSON.parse(text);
    return (Array.isArray(v) ? v : [v]).filter((x) => x && typeof x === 'object' && !Array.isArray(x)).map((x) => ({ '@context': CTX, ...x }));
  } catch {
    return [];
  }
}

/**
 * @param {any} input
 * @returns {any[]}
 *
 * All JSON-LD objects for one public URL. Each is a stand-alone object with its own @context, to be output as one
 * <script type="application/ld+json"> each.
 */
export function buildJsonLd(input) {
  const { base, siteName, tagline, entity, kind = 'page', page, post, nodes = [], titleOf, defaultImage, locale = 'en-CA' } = input;
  const out = [];
  const orgRef = { '@type': entity.type || 'Organization', '@id': `${base}/#organization`, name: entity.name || siteName };
  const siteRef = { '@type': 'WebSite', '@id': `${base}/#website`, url: `${base}/`, name: siteName };
  const inLanguage = locale;

  if (kind === 'post' && post) {
    const url = `${base}/insights/${post.slug}`;
    const image = [abs(base, post.og_image) || abs(base, post.cover_image) || abs(base, defaultImage)].filter(Boolean);
    const summary = post.answer_summary || post.seo_description || post.excerpt;
    out.push(drop({
      '@context': CTX,
      '@type': post.schema_type || 'BlogPosting',
      '@id': `${url}#article`,
      headline: String(post.seo_title || post.title).slice(0, 110),
      name: post.title,
      description: summary,
      abstract: post.answer_summary || undefined,
      image,
      datePublished: iso(post.published_at),
      dateModified: iso(post.updated_at) || iso(post.published_at),
      author: post.authorName ? { '@type': 'Person', name: post.authorName } : orgRef,
      publisher: drop({ ...orgRef, logo: abs(base, entity.logo) ? { '@type': 'ImageObject', url: abs(base, entity.logo) } : undefined }),
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      url,
      isPartOf: siteRef,
      articleSection: post.category || undefined,
      keywords: post.tags?.length ? post.tags.join(', ') : undefined,
      inLanguage,
    }));
    out.push(breadcrumbNode(base, ['insights', post.slug], (p) => (p === 'insights' ? 'Insights' : undefined), { name: post.breadcrumb_title || post.title, url }));
    out.push(...customNodes(post.custom_jsonld));
    return out;
  }

  const path = page?.path ?? '';
  const url = pageUrl(base, path);
  const isHome = path === '';
  if (isHome) {
    out.push(organizationNode(entity, base, { siteName, defaultImage }));
    out.push(drop({ '@context': CTX, '@type': 'WebSite', '@id': `${base}/#website`, url: `${base}/`, name: siteName, description: tagline || undefined, inLanguage, publisher: { '@id': `${base}/#organization` } }));
  }
  const image = abs(base, page?.og_image) || abs(base, defaultImage);
  const summary = page?.answer_summary || page?.seo_description;
  out.push(drop({
    '@context': CTX,
    '@type': pageSchemaType(path, page?.schema_type),
    '@id': `${url}#webpage`,
    url,
    name: page?.seo_title || page?.title || siteName,
    description: summary,
    abstract: page?.answer_summary || undefined,
    isPartOf: isHome ? { '@id': `${base}/#website` } : siteRef,
    about: isHome ? { '@id': `${base}/#organization` } : undefined,
    publisher: isHome ? { '@id': `${base}/#organization` } : orgRef,
    primaryImageOfPage: image ? { '@type': 'ImageObject', url: image } : undefined,
    datePublished: iso(page?.published_at) || iso(page?.created_at),
    dateModified: iso(page?.updated_at),
    breadcrumb: isHome ? undefined : { '@id': `${url}#breadcrumb` },
    inLanguage,
  }));
  if (!isHome) out.push(breadcrumbNode(base, path.split('/'), titleOf, { name: page?.breadcrumb_title || page?.title || titleize(path.split('/').pop()), url }));
  const faq = faqNode(nodes, url);
  if (faq) out.push(faq);
  out.push(...customNodes(page?.custom_jsonld));
  return out;
}

/** JSON for inside a <script> element: "<" can never close it, and the Unicode line separators can't break a JS string. */
const BS = String.fromCharCode(92);
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);
export function safeJsonLd(obj) {
  return JSON.stringify(obj).split('<').join(BS + 'u003c').split(LS).join(BS + 'u2028').split(PS).join(BS + 'u2029');
}

/** The @type values of a list of nodes (flat). */
export const typesOf = (list) => list.map((n) => n['@type']);
