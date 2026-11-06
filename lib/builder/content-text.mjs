// Reads the TEXT out of a builder document: headings, paragraphs, lists, images, links and FAQ pairs.
// Shared by the SEO / AI-readiness analysis (browser + server), the FAQ structured data and llms.txt. Pure.

const ENT = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ', '&ndash;': '–', '&mdash;': '—', '&rsquo;': '’', '&lsquo;': '‘', '&ldquo;': '“', '&rdquo;': '”', '&hellip;': '…' };

/** HTML -> plain text (line breaks become spaces, entities decoded, whitespace collapsed). */
export function plain(html) {
  return String(html ?? '')
    .replace(/<\s*br\s*\/?>/gi, ' ')
    .replace(/<\/(p|li|h[1-6]|blockquote|div)>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp|ndash|mdash|rsquo|lsquo|ldquo|rdquo|hellip);/g, (m) => ENT[m])
    .replace(/&#(\d{2,5});/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

export const countWords = (text) => (String(text ?? '').trim() ? String(text).trim().split(/\s+/).length : 0);

const asArray = (v) => (Array.isArray(v) ? v : []);
const str = (v) => (typeof v === 'string' ? v : '');

/** Block-level pieces of a rich-text value: [{t:'h',level,text} | {t:'p',text} | {t:'ul'|'ol',items} | {t:'quote',text}]. */
export function richBlocks(html) {
  const out = [];
  const src = String(html ?? '');
  const re = /<(h[1-6]|p|ul|ol|blockquote)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  const loose = (chunk) => { const t = plain(chunk); if (t) out.push({ t: 'p', text: t }); };
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    loose(src.slice(last, m.index));
    last = re.lastIndex;
    const tag = m[1].toLowerCase();
    if (tag[0] === 'h') { const text = plain(m[2]); if (text) out.push({ t: 'h', level: Number(tag[1]), text }); }
    else if (tag === 'p') { const text = plain(m[2]); if (text) out.push({ t: 'p', text }); }
    else if (tag === 'blockquote') { const text = plain(m[2]); if (text) out.push({ t: 'quote', text }); }
    else {
      const items = [...m[2].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li\s*>/gi)].map((x) => plain(x[1])).filter(Boolean);
      if (items.length) out.push({ t: tag, items });
    }
  }
  loose(src.slice(last));
  return out;
}

/** Links inside rich text: [{href, text}] */
export function richLinks(html) {
  return [...String(html ?? '').matchAll(/<a\b[^>]*\bhref\s*=\s*"([^"]*)"[^>]*>([\s\S]*?)<\/a\s*>/gi)].map((m) => ({ href: m[1].replace(/&amp;/g, '&'), text: plain(m[2]) }));
}

/**
 * Everything the checks and the structured data need, in document order.
 * @param nodes builder nodes (sections > rows > columns > widgets)
 */
export function extractContent(nodes) {
  const blocks = []; // in order: {t:'h',level,text} {t:'p',text} {t:'ul'|'ol',items} {t:'quote',text} {t:'faq',q,a} {t:'img',...} {t:'btn',label,url}
  const images = [];
  const links = [];
  const faqs = [];
  const accordions = [];
  let words = 0;
  let tables = 0;

  const addText = (t) => { words += countWords(t); };
  const addLink = (href, text) => { links.push({ href: str(href).trim(), text: str(text).trim() }); };

  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    const p = node.props || {};
    switch (node.type) {
      case 'heading': {
        const text = plain(p.text);
        const tag = /^h[1-6]$/.test(str(p.tag)) ? p.tag : 'h2';
        if (text) {
          if (/^h[1-6]$/.test(str(p.tag) || 'h2')) blocks.push({ t: 'h', level: Number(tag[1]), text });
          else blocks.push({ t: 'p', text });
          addText(text);
        }
        if (p.link) addLink(p.link, text);
        break;
      }
      case 'text':
        for (const b of richBlocks(p.html)) {
          blocks.push(b);
          addText(b.text || (b.items || []).join(' '));
        }
        for (const l of richLinks(p.html)) addLink(l.href, l.text);
        break;
      case 'image':
        images.push({ src: str(p.src), alt: str(p.alt).trim() });
        if (p.caption) addText(plain(p.caption));
        if (p.link) addLink(p.link, str(p.alt));
        break;
      case 'gallery':
        for (const im of asArray(p.images)) images.push({ src: str(im?.src), alt: str(im?.alt).trim() });
        break;
      case 'button':
        if (p.label) { blocks.push({ t: 'btn', label: plain(p.label), url: str(p.url) }); addText(plain(p.label)); }
        addLink(p.url, plain(p.label));
        break;
      case 'icon-box': {
        const title = plain(p.title);
        const text = plain(p.text);
        if (title) { blocks.push({ t: 'p', text: title, small: true }); addText(title); }
        if (text) { blocks.push({ t: 'p', text }); addText(text); }
        if (p.link) addLink(p.link, title);
        break;
      }
      case 'list': {
        const items = asArray(p.items).map((it) => plain(it?.text)).filter(Boolean);
        if (items.length) { blocks.push({ t: p.marker === 'number' ? 'ol' : 'ul', items }); addText(items.join(' ')); }
        break;
      }
      case 'counter': {
        const t = [p.prefix, p.number, p.suffix, p.label].map(plain).filter(Boolean).join(' ');
        if (t) addText(t);
        break;
      }
      case 'accordion': {
        const items = asArray(p.items).map((it) => ({ q: plain(it?.title), a: plain(it?.body) })).filter((it) => it.q);
        accordions.push({ schema: p.faqSchema === true, count: items.length });
        for (const it of items) {
          blocks.push({ t: 'faq', q: it.q, a: it.a, schema: p.faqSchema === true });
          addText(`${it.q} ${it.a}`);
          if (p.faqSchema === true && it.a) faqs.push(it);
        }
        break;
      }
      case 'bar-table':
        tables++;
        break;
      case 'hero-slider':
        asArray(p.slides).forEach((sl, i) => {
          const h = plain(sl?.heading);
          if (h) { blocks.push({ t: 'h', level: i === 0 ? 1 : 2, text: h }); addText(h); }
          const t = plain(sl?.text);
          if (t) { blocks.push({ t: 'p', text: t }); addText(t); }
          if (sl?.btn1Url) addLink(sl.btn1Url, sl.btn1Label);
          if (sl?.btn2Url) addLink(sl.btn2Url, sl.btn2Label);
        });
        break;
      default:
        break;
    }
    for (const c of node.children || []) visit(c);
  };
  for (const n of nodes || []) visit(n);

  const headings = blocks.filter((b) => b.t === 'h');
  const paragraphs = blocks.filter((b) => b.t === 'p' && !b.small);
  const lists = blocks.filter((b) => b.t === 'ul' || b.t === 'ol');
  return { blocks, headings, paragraphs, lists, images, links, faqs, accordions, words, tables };
}

/** Plain-text / Markdown rendering of a document for llms-full.txt. */
export function toMarkdown(nodes) {
  const { blocks } = extractContent(nodes);
  const out = [];
  for (const b of blocks) {
    if (b.t === 'h') out.push(`${'#'.repeat(Math.min(6, b.level + 1))} ${b.text}`); // page title is H1 in the file; headings nest below it
    else if (b.t === 'p') out.push(b.text);
    else if (b.t === 'quote') out.push(`> ${b.text}`);
    else if (b.t === 'ul') out.push(b.items.map((i) => `- ${i}`).join('\n'));
    else if (b.t === 'ol') out.push(b.items.map((i, n) => `${n + 1}. ${i}`).join('\n'));
    else if (b.t === 'faq') out.push(`**${b.q}**${b.a ? `\n${b.a}` : ''}`);
    else if (b.t === 'btn' && b.label) out.push(`[${b.label}](${b.url || '#'})`);
  }
  return out.join('\n\n');
}

/** Convert an article body (the CMS's simple "## Heading / - list / blank line" text, or HTML) to builder-like nodes for analysis. */
export function postBodyToNodes(body, title = '') {
  const text = String(body ?? '');
  const nodes = [];
  if (title) nodes.push({ type: 'heading', props: { text: title, tag: 'h1' } });
  if (/<\s*(p|h[1-6]|ul|ol)\b/i.test(text)) {
    nodes.push({ type: 'text', props: { html: text } });
    return nodes;
  }
  const html = text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const inline = (x) => esc(x).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
      if (b.startsWith('### ')) return `<h3>${inline(b.slice(4))}</h3>`;
      if (b.startsWith('## ')) return `<h2>${inline(b.slice(3))}</h2>`;
      const ls = b.split('\n');
      if (ls.every((l) => l.startsWith('- '))) return `<ul>${ls.map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
      return `<p>${ls.map(inline).join('<br>')}</p>`;
    })
    .join('');
  nodes.push({ type: 'text', props: { html } });
  return nodes;
}
