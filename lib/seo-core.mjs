// SEO / AI-visibility settings: shapes, defaults and the validating "clean" functions. Pure (no database, no Next).
//
// Stored in the `settings` table as four JSON blobs: seo_general, seo_entity, seo_robots, seo_llms.
// Every blob goes through its clean function when it is saved AND when it is read or imported, so a malformed or hostile
// value can't reach the public pages.
import { safeMediaUrl, safeUrl } from './builder/url.mjs';

// ------------------------------------------------------------------ AI / search crawlers
export const AI_BOTS = [
  { ua: 'GPTBot', vendor: 'OpenAI', note: 'Collects content to train OpenAI models.' },
  { ua: 'ChatGPT-User', vendor: 'OpenAI', note: 'Fetches pages when someone asks ChatGPT about them.' },
  { ua: 'OAI-SearchBot', vendor: 'OpenAI', note: 'Builds the ChatGPT search index (answers with links to you).' },
  { ua: 'ClaudeBot', vendor: 'Anthropic', note: 'Collects content to train Claude.' },
  { ua: 'anthropic-ai', vendor: 'Anthropic', note: 'Older Anthropic crawler name.' },
  { ua: 'PerplexityBot', vendor: 'Perplexity', note: 'Builds the Perplexity answer index (cites sources).' },
  { ua: 'Google-Extended', vendor: 'Google', note: 'Controls use of your content for Gemini; does not affect Google Search.' },
  { ua: 'Applebot-Extended', vendor: 'Apple', note: 'Controls use of your content for Apple’s AI models.' },
  { ua: 'CCBot', vendor: 'Common Crawl', note: 'Open web archive many AI models are trained on.' },
  { ua: 'Bytespider', vendor: 'ByteDance', note: 'ByteDance / TikTok crawler.' },
  { ua: 'Meta-ExternalAgent', vendor: 'Meta', note: 'Collects content for Meta AI.' },
  { ua: 'Amazonbot', vendor: 'Amazon', note: 'Alexa and Amazon AI answers.' },
  { ua: 'cohere-ai', vendor: 'Cohere', note: 'Cohere crawler.' },
];

export const BUSINESS_TYPES = [
  ['Organization', 'Organization (general)'],
  ['LocalBusiness', 'Local business'],
  ['ProfessionalService', 'Professional service'],
  ['HomeAndConstructionBusiness', 'Home & construction business'],
  ['GeneralContractor', 'General contractor'],
  ['Corporation', 'Corporation'],
  ['Store', 'Store / supplier'],
];
const TYPE_SET = new Set(BUSINESS_TYPES.map((t) => t[0]));

export const PAGE_SCHEMA_TYPES = [
  ['', 'Automatic (from the page address)'],
  ['WebPage', 'Web page'],
  ['AboutPage', 'About page'],
  ['ContactPage', 'Contact page'],
  ['CollectionPage', 'Collection / listing page'],
];
export const POST_SCHEMA_TYPES = [
  ['', 'Blog posting'],
  ['BlogPosting', 'Blog posting'],
  ['Article', 'Article'],
  ['NewsArticle', 'News article'],
];
export const TWITTER_CARDS = [['', 'Automatic'], ['summary', 'Summary'], ['summary_large_image', 'Large image']];

// ------------------------------------------------------------------ helpers
const s = (v, max) => String(v ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').trim().slice(0, max);
const line = (v, max) => s(v, max).replace(/\s*\n+\s*/g, ' ');
const lines = (v, maxLines, maxLen) => String(Array.isArray(v) ? v.join('\n') : v ?? '').split(/\n/).map((x) => line(x, maxLen)).filter(Boolean).slice(0, maxLines);
// explicit yes/no values are honoured; anything else (missing, garbage) falls back to the default
const toBool = (v, def = false) => {
  if (v === true || v === 1 || v === '1' || v === 'on' || v === 'true') return true;
  if (v === false || v === 0 || v === '0' || v === 'off' || v === 'false') return false;
  return def;
};
const num = (v, min, max) => {
  const t = String(v ?? '').trim();
  if (!t) return '';
  const n = Number(t);
  return Number.isFinite(n) && n >= min && n <= max ? String(n) : '';
};
export const parseJson = (text, fallback) => {
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : fallback; } catch { return fallback; }
};

/** Verification codes: accept the bare token or a pasted <meta … content="TOKEN"> tag. */
export function cleanVerification(v) {
  let t = s(v, 400);
  const m = /content\s*=\s*["']([^"']+)["']/i.exec(t);
  if (m) t = m[1].trim();
  return /^[A-Za-z0-9_\-:.=]{5,200}$/.test(t) ? t : '';
}

// ------------------------------------------------------------------ general
export const GENERAL_DEFAULTS = {
  sep: '|',
  template: '%page% %sep% %site%',
  twitter: '',
  noindexSite: false,
  locale: 'en_CA',
  verify: { google: '', bing: '', yandex: '', pinterest: '', facebook: '' },
};
export const SEPARATORS = ['|', '-', '–', '·', '•', '»', '/'];

export function cleanGeneral(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const sep = SEPARATORS.includes(String(r.sep ?? '')) ? String(r.sep) : GENERAL_DEFAULTS.sep;
  let template = line(r.template, 120) || GENERAL_DEFAULTS.template;
  if (!template.includes('%page%')) template = GENERAL_DEFAULTS.template;
  // only the four known tokens survive; any other percent sign is removed so it can't confuse Next's %s title template
  template = template.split(/(%(?:page|site|sep|tagline)%)/).map((part, i) => (i % 2 ? part : part.replace(/%/g, ''))).join('');
  const twitter = line(r.twitter, 40).replace(/^@+/, '');
  const verify = {};
  for (const k of Object.keys(GENERAL_DEFAULTS.verify)) verify[k] = cleanVerification(r.verify?.[k]);
  const locale = /^[a-z]{2}_[A-Z]{2}$/.test(String(r.locale ?? '')) ? String(r.locale) : GENERAL_DEFAULTS.locale;
  return { sep, template, twitter: /^[A-Za-z0-9_]{1,15}$/.test(twitter) ? twitter : '', noindexSite: toBool(r.noindexSite), locale, verify };
}

/** "%page% | Dass Rebar" with the real page title, separator and site name filled in. */
export function renderTitle(general, { page, site, tagline }) {
  return general.template
    .replace(/%page%/g, page)
    .replace(/%site%/g, site)
    .replace(/%sep%/g, general.sep)
    .replace(/%tagline%/g, tagline || '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ------------------------------------------------------------------ business entity
export const ENTITY_DEFAULTS = {
  type: 'Organization', name: '', legal: '', logo: '', description: '', founded: '', email: '', phone: '',
  street: '', city: '', region: '', postal: '', country: '', lat: '', lng: '', hours: [], areas: [], sameAs: [],
};
const HOURS_RE = /^(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?(,(Mo|Tu|We|Th|Fr|Sa|Su)(-(Mo|Tu|We|Th|Fr|Sa|Su))?)* \d{2}:\d{2}-\d{2}:\d{2}$/;

/** Returns the cleaned entity and the opening-hours lines that were dropped (so the screen can say so). */
export function cleanEntity(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const hoursIn = lines(r.hours, 14, 60);
  const hours = hoursIn.filter((h) => HOURS_RE.test(h));
  const email = line(r.email, 200);
  const e = {
    type: TYPE_SET.has(String(r.type)) ? String(r.type) : ENTITY_DEFAULTS.type,
    name: line(r.name, 160),
    legal: line(r.legal, 200),
    logo: safeMediaUrl(line(r.logo, 500)),
    description: s(r.description, 1000).replace(/\s*\n+\s*/g, ' '),
    founded: /^\d{4}$/.test(String(r.founded ?? '').trim()) && Number(r.founded) >= 1800 && Number(r.founded) <= 2100 ? String(r.founded).trim() : '',
    email: /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email) ? email : '',
    phone: /^[+()\d\s.\-x]{5,30}$/.test(line(r.phone, 40)) ? line(r.phone, 40) : '',
    street: line(r.street, 200), city: line(r.city, 100), region: line(r.region, 100), postal: line(r.postal, 20), country: line(r.country, 60),
    lat: num(r.lat, -90, 90), lng: num(r.lng, -180, 180),
    hours,
    areas: lines(r.areas, 40, 100),
    sameAs: lines(r.sameAs, 20, 300).map((u) => safeUrl(u)).filter((u) => /^https?:\/\//i.test(u)),
  };
  return { entity: e, droppedHours: hoursIn.length - hours.length };
}

/** Entity settings with the older "Settings" values as fallbacks (so the user doesn't have to enter things twice). */
export function resolveEntity(stored, site) {
  const e = { ...ENTITY_DEFAULTS, ...cleanEntity(stored).entity };
  const out = { ...e };
  if (!out.name) out.name = site.title || '';
  if (!out.logo) out.logo = site.logo || '';
  if (!out.description) out.description = site.description || '';
  if (!out.email) out.email = site.email || '';
  if (!out.phone) out.phone = site.phone || '';
  return out;
}

/** Which of the business basics the AI-readiness check looks at are still missing. */
export function entityGaps(e) {
  const gaps = [];
  if (!e.name) gaps.push('business name');
  if (!e.logo) gaps.push('logo');
  if (!e.street || !e.city) gaps.push('street address and city');
  if (!e.phone) gaps.push('phone number');
  if (!e.sameAs.length) gaps.push('social / profile links');
  return gaps;
}

// ------------------------------------------------------------------ robots
export function cleanRobots(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const bots = {};
  for (const b of AI_BOTS) bots[b.ua] = r.bots?.[b.ua] === 'disallow' ? 'disallow' : 'allow';
  // extra robots.txt lines: printable ASCII directives only, no way to inject a line break into another directive
  const extra = String(r.extra ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/[^\x20-\x7E]/g, '').trim()).filter(Boolean).slice(0, 100).join('\n').slice(0, 5000);
  return { bots, extra };
}

// ------------------------------------------------------------------ llms.txt
export function cleanLlms(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return { enabled: toBool(r.enabled, true), intro: s(r.intro, 1500) };
}

// ------------------------------------------------------------------ per-page / per-post SEO fields
/** Validate the per-page / per-post SEO inputs (strings from a form). Returns cleaned values and an error message or ''. */
export function cleanContentSeo(input, { kind = 'page' } = {}) {
  const i = input || {};
  const canonicalRaw = line(i.canonical_url, 500);
  let canonical = '';
  let error = '';
  if (canonicalRaw) {
    canonical = /^https?:\/\//i.test(canonicalRaw) || /^\/(?!\/)/.test(canonicalRaw) ? safeUrl(canonicalRaw) : '';
    if (!canonical) error = 'The canonical URL must start with https:// (or /).';
  }
  const types = (kind === 'post' ? POST_SCHEMA_TYPES : PAGE_SCHEMA_TYPES).map((t) => t[0]);
  const card = String(i.twitter_card ?? '');
  const values = {
    focus_keyword: line(i.focus_keyword, 80),
    canonical_url: canonical,
    nofollow: toBool(i.nofollow) ? 1 : 0,
    og_title: line(i.og_title, 200),
    og_description: line(i.og_description, 400),
    twitter_card: TWITTER_CARDS.some((c) => c[0] === card) ? card : '',
    schema_type: types.includes(String(i.schema_type ?? '')) ? String(i.schema_type ?? '') : '',
    answer_summary: s(i.answer_summary, 700).replace(/\s*\n+\s*/g, ' '),
    breadcrumb_title: line(i.breadcrumb_title, 100),
  };
  return { values, error };
}

/** custom_jsonld: must be valid JSON (an object or an array of objects). Returns the normalised text, or an error. */
export function cleanCustomJsonLd(text) {
  const t = s(text, 20_000);
  if (!t) return { value: '', error: '' };
  try {
    const v = JSON.parse(t);
    const items = Array.isArray(v) ? v : [v];
    if (!items.length || items.length > 10 || items.some((x) => !x || typeof x !== 'object' || Array.isArray(x))) throw new Error('shape');
    return { value: JSON.stringify(v, null, 2), error: '' };
  } catch {
    return { value: '', error: 'Custom structured data must be valid JSON: one object, or a list of objects.' };
  }
}
