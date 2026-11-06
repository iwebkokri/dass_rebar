// SEO + AI-readiness analysis of one page (or article). Pure: runs in the browser (live in the builder) and on the server
// (admin screens, the Pages list score). No scoring is a promise about rankings — these are practical, explainable checks.
import { countWords, extractContent } from './content-text.mjs';
import { buildJsonLd, typesOf } from './seo-schema.mjs';

const W = { pass: 1, warn: 0.5, fail: 0 };
const QUESTION = /^(who|what|when|where|why|how|which|can|could|does|do|did|is|are|was|were|should|will|would|what['’]s)\b/i;

const check = (id, group, status, message, fix = '') => ({ id, group, status, message, fix });
const norm = (s) => String(s ?? '').toLowerCase();
const has = (text, kw) => norm(text).includes(norm(kw));

/**
 * @param {object} input
 * @param {Array}  input.nodes  builder document nodes
 * @param {object} input.page   { title, path, seo_title, seo_description, focus_keyword, canonical_url, noindex, nofollow, og_image, answer_summary, schema_type, ... }
 * @param {object} input.site   { name, tagline, base, defaultOgImage, entity, entityGaps: string[], llmsEnabled, blockedBots: string[], noindexSite }
 * @param {'page'|'post'} [input.kind]
 * @param {object} [input.post] { authorName, published_at, updated_at } (kind === 'post')
 */
export function analyzeSeo({ nodes, page, site, kind = 'page', post }) {
  const c = extractContent(nodes);
  const checks = [];
  const p = page || {};
  const title = String(p.seo_title || p.title || '').trim();
  const desc = String(p.seo_description || '').trim();
  const kw = String(p.focus_keyword || '').trim();
  const h1s = c.headings.filter((h) => h.level === 1);
  const firstText = c.paragraphs.slice(0, 2).map((x) => x.text).join(' ');
  const intro = firstText.split(/\s+/).slice(0, 100).join(' ');

  // ------------------------------------------------------------------ SEO
  checks.push(!title ? check('title', 'seo', 'fail', 'No page title.', 'Give the page a title.')
    : title.length < 30 ? check('title', 'seo', 'warn', `The title is short (${title.length} characters).`, 'Aim for 30–60 characters so it uses the space in search results.')
    : title.length > 60 ? check('title', 'seo', 'warn', `The title is long (${title.length} characters) and may be cut off.`, 'Keep it to about 60 characters.')
    : check('title', 'seo', 'pass', `Title length is good (${title.length} characters).`));

  checks.push(!desc ? check('description', 'seo', 'fail', 'No meta description.', 'Write a 70–160 character summary — it is often shown under the title in search results.')
    : desc.length < 70 ? check('description', 'seo', 'warn', `The description is short (${desc.length} characters).`, 'Aim for 70–160 characters.')
    : desc.length > 160 ? check('description', 'seo', 'warn', `The description is long (${desc.length} characters) and may be cut off.`, 'Keep it to about 160 characters.')
    : check('description', 'seo', 'pass', `Description length is good (${desc.length} characters).`));

  if (!kw) {
    checks.push(check('keyword', 'seo', 'warn', 'No focus keyword set.', 'Enter the phrase people would search for to get keyword checks.'));
  } else {
    const slug = norm(p.path).replace(/[-_/]+/g, ' ');
    checks.push(has(title, kw) ? check('kw-title', 'seo', 'pass', 'The focus keyword is in the title.') : check('kw-title', 'seo', 'warn', 'The focus keyword is not in the title.', 'Work the keyword into the title, ideally near the start.'));
    checks.push(has(desc, kw) ? check('kw-desc', 'seo', 'pass', 'The focus keyword is in the description.') : check('kw-desc', 'seo', 'warn', 'The focus keyword is not in the description.', 'Mention it naturally in the meta description.'));
    checks.push(has(slug, kw.replace(/[-_]+/g, ' ')) ? check('kw-url', 'seo', 'pass', 'The focus keyword is in the page address.') : check('kw-url', 'seo', 'warn', 'The focus keyword is not in the page address.', 'Consider a path that contains it (changing a published path creates a redirect).'));
    checks.push(h1s.some((h) => has(h.text, kw)) ? check('kw-h1', 'seo', 'pass', 'The focus keyword is in the main heading (H1).') : check('kw-h1', 'seo', 'warn', 'The focus keyword is not in the main heading (H1).', 'Use it in the H1.'));
    checks.push(has(intro, kw) ? check('kw-intro', 'seo', 'pass', 'The focus keyword appears in the opening text.') : check('kw-intro', 'seo', 'warn', 'The focus keyword is missing from the opening text.', 'Mention it within the first paragraph or two.'));
    checks.push(c.headings.some((h) => h.level >= 2 && has(h.text, kw)) ? check('kw-sub', 'seo', 'pass', 'The focus keyword is in a subheading.') : check('kw-sub', 'seo', 'warn', 'The focus keyword is not in any subheading (H2–H6).', 'Use it in at least one subheading.'));
  }

  checks.push(h1s.length === 1 ? check('h1', 'seo', 'pass', 'Exactly one main heading (H1).')
    : h1s.length === 0 ? check('h1', 'seo', 'fail', 'The page has no H1.', 'Set one heading’s HTML tag to H1 (Heading → Settings → HTML tag).')
    : check('h1', 'seo', 'warn', `The page has ${h1s.length} H1 headings.`, 'Use a single H1 and H2–H3 for the rest.'));

  let skipped = 0;
  let prev = 0;
  for (const h of c.headings) { if (prev && h.level > prev + 1) skipped++; prev = h.level; }
  checks.push(c.headings.length === 0 ? check('heading-order', 'seo', 'warn', 'The page has no headings.', 'Break the content up with headings.')
    : skipped ? check('heading-order', 'seo', 'warn', `${skipped} heading${skipped > 1 ? 's skip' : ' skips'} a level (for example H2 straight to H4).`, 'Keep heading levels in order.')
    : check('heading-order', 'seo', 'pass', 'Heading levels are in order.'));

  const min = 300;
  checks.push(c.words >= min ? check('words', 'seo', 'pass', `${c.words} words of content.`)
    : c.words >= 150 ? check('words', 'seo', 'warn', `Only ${c.words} words of content.`, `Pages with at least ${min} words usually rank and get quoted more easily.`)
    : check('words', 'seo', 'fail', `Very little text (${c.words} words).`, 'Add more descriptive text.'));

  const noAlt = c.images.filter((i) => i.src && !i.alt).length;
  checks.push(c.images.length === 0 ? check('alt', 'seo', 'pass', 'No images to describe.')
    : noAlt ? check('alt', 'seo', 'warn', `${noAlt} of ${c.images.length} image${c.images.length > 1 ? 's have' : ' has'} no alt text.`, 'Describe each image in its Alt text field.')
    : check('alt', 'seo', 'pass', `All ${c.images.length} image${c.images.length > 1 ? 's have' : ' has'} alt text.`));

  const internal = c.links.filter((l) => l.href.startsWith('/') && !l.href.startsWith('//')).length;
  const external = c.links.filter((l) => /^https?:\/\//i.test(l.href)).length;
  const empty = c.links.filter((l) => !l.href || l.href === '#').length;
  checks.push(empty ? check('links', 'seo', 'warn', `${empty} link${empty > 1 ? 's point' : ' points'} nowhere (empty or “#”).`, 'Add a real address or remove the link.')
    : internal === 0 && kind === 'page' && p.path !== '' ? check('links', 'seo', 'warn', 'No links to other pages of this site.', 'Link to related pages so visitors and crawlers can find them.')
    : check('links', 'seo', 'pass', `${internal} internal and ${external} external link${internal + external === 1 ? '' : 's'}.`));

  const canon = String(p.canonical_url || '').trim();
  checks.push(canon && !/^https?:\/\/[^\s]+$/i.test(canon) && !/^\/(?!\/)\S*$/.test(canon) ? check('canonical', 'seo', 'fail', 'The canonical URL is not a valid address.', 'Use a full https:// address or leave it empty.')
    : canon ? check('canonical', 'seo', 'pass', 'A custom canonical URL is set.')
    : check('canonical', 'seo', 'pass', 'The canonical URL defaults to this page’s own address.'));

  if (p.noindex || site?.noindexSite) {
    checks.push(check('indexing', 'seo', 'warn', site?.noindexSite ? 'The whole site is hidden from search engines (SEO → General).' : 'This page is hidden from search engines (noindex).', site?.noindexSite ? 'Untick “Discourage search engines” when you are ready to launch.' : 'Untick “Hide from search engines” in the page settings if it should be found.'));
  } else checks.push(check('indexing', 'seo', 'pass', 'Search engines may index this page.'));

  const hasImage = !!(p.og_image || site?.defaultOgImage);
  checks.push(hasImage ? check('og-image', 'seo', 'pass', 'A social sharing image is set.') : check('og-image', 'seo', 'warn', 'No social sharing image.', 'Add one on the page or a default under SEO → General (1200 × 630 px).'));

  // ------------------------------------------------------------------ AI-readiness (GEO / AEO / AIO)
  const summaryWords = countWords(p.answer_summary);
  checks.push(!summaryWords ? check('ai-summary', 'ai', 'fail', 'No direct-answer summary.', 'Write a 40–60 word summary that answers the page’s main question on its own. AI answers and featured snippets quote it.')
    : summaryWords < 40 || summaryWords > 60 ? check('ai-summary', 'ai', 'warn', `The answer summary is ${summaryWords} words.`, 'Aim for 40–60 words: long enough to be complete, short enough to be quoted.')
    : check('ai-summary', 'ai', 'pass', `Answer summary is ${summaryWords} words.`));

  const faqOn = c.accordions.filter((a) => a.schema && a.count >= 2);
  checks.push(faqOn.length ? check('ai-faq', 'ai', 'pass', `FAQ structured data is on (${c.faqs.length} question${c.faqs.length === 1 ? '' : 's'}).`)
    : c.accordions.length ? check('ai-faq', 'ai', 'warn', 'There is an accordion, but FAQ structured data is switched off.', 'Select the accordion and turn on “Add FAQ structured data”.')
    : check('ai-faq', 'ai', 'warn', 'No FAQ section.', 'Add an Accordion with real customer questions and turn on FAQ structured data.'));

  const qHeads = c.headings.filter((h) => h.level >= 2 && (/\?\s*$/.test(h.text) || QUESTION.test(h.text))).length + c.blocks.filter((b) => b.t === 'faq' && (/\?\s*$/.test(b.q) || QUESTION.test(b.q))).length;
  checks.push(qHeads ? check('ai-questions', 'ai', 'pass', `${qHeads} heading${qHeads > 1 ? 's are' : ' is'} phrased as a question.`) : check('ai-questions', 'ai', 'warn', 'No headings phrased as questions.', 'Headings such as “How long does bar bending take?” match how people ask AI assistants.'));

  checks.push(c.lists.length + c.tables > 0 ? check('ai-scan', 'ai', 'pass', 'Contains lists or tables that are easy to quote.') : check('ai-scan', 'ai', 'warn', 'No lists or tables.', 'Bullet lists and tables are easy for answer engines to lift out.'));

  const long = c.paragraphs.filter((x) => countWords(x.text) > 150).length;
  checks.push(long ? check('ai-short', 'ai', 'warn', `${long} paragraph${long > 1 ? 's are' : ' is'} over 150 words.`, 'Keep paragraphs short (2–4 sentences).') : check('ai-short', 'ai', 'pass', 'Paragraphs are short and scannable.'));

  const gaps = site?.entityGaps || [];
  checks.push(!gaps.length ? check('ai-entity', 'ai', 'pass', 'The business profile is complete.') : check('ai-entity', 'ai', 'warn', `The business profile is missing: ${gaps.join(', ')}.`, 'Complete SEO → Business profile so machines can identify who you are.'));

  if (kind === 'post') {
    const miss = [!post?.authorName && 'an author', !post?.published_at && 'a publish date'].filter(Boolean);
    checks.push(miss.length ? check('ai-author', 'ai', 'warn', `The article has no ${miss.join(' or ')}.`, 'Named authors and dates are trust signals for AI answers.') : check('ai-author', 'ai', 'pass', 'Author and dates are set.'));
  }

  checks.push(site?.llmsEnabled === false ? check('ai-llms', 'ai', 'warn', 'llms.txt is switched off.', 'Turn it on under SEO → AI & llms.txt so AI tools get a clean map of your site.') : check('ai-llms', 'ai', 'pass', 'llms.txt is on.'));

  const blocked = site?.blockedBots || [];
  checks.push(site?.noindexSite ? check('ai-crawlers', 'ai', 'fail', 'Search engines and AI crawlers are asked to stay away from the whole site.', 'Untick “Discourage search engines” under SEO → General.')
    : blocked.length ? check('ai-crawlers', 'ai', 'warn', `${blocked.length} AI crawler${blocked.length > 1 ? 's are' : ' is'} blocked: ${blocked.slice(0, 4).join(', ')}${blocked.length > 4 ? '…' : ''}.`, 'That is your choice — blocked crawlers can’t cite or learn from this page.')
    : check('ai-crawlers', 'ai', 'pass', 'AI crawlers are allowed.'));

  let types = [];
  try {
    types = typesOf(buildJsonLd({
      base: site?.base || 'https://example.com', siteName: site?.name || '', tagline: site?.tagline, entity: site?.entity || { type: 'Organization', hours: [], areas: [], sameAs: [] },
      kind: kind === 'post' ? 'post' : 'page', page: { ...p, path: p.path ?? '' }, post: kind === 'post' ? { ...(post || {}), slug: p.path, title: p.title, ...p } : undefined, nodes,
    }));
  } catch { /* preview only */ }
  checks.push(types.length ? check('ai-jsonld', 'ai', 'pass', `Structured data is generated automatically (${[...new Set(types)].join(', ')}).`) : check('ai-jsonld', 'ai', 'warn', 'No structured data could be generated.'));

  const score = (group) => {
    const list = checks.filter((x) => x.group === group);
    return list.length ? Math.round((list.reduce((n, x) => n + W[x.status], 0) / list.length) * 100) : 0;
  };
  return { checks, scores: { seo: score('seo'), ai: score('ai') }, stats: { words: c.words, h1: h1s.length, headings: c.headings.length, images: c.images.length, links: c.links.length, faqs: c.faqs.length } };
}

/** 'good' / 'ok' / 'poor' band for a 0–100 score (colours in the UI). */
export const band = (n) => (n >= 80 ? 'good' : n >= 50 ? 'ok' : 'poor');
