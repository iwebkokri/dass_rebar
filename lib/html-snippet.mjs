// Tiny tokenizer for administrator-entered <head> code (Studio CMS -> Tracking & Code).
//
// React can't put raw HTML inside <head> (Next owns that element), so the snippet is turned into a list of
// elements that the layout re-creates as real <script>/<style>/<link>/<meta>/<noscript>/<base> tags. Anything else
// (<div>, <img>, <iframe> ... and stray text) is not valid in <head> and is reported in `ignored`.
//
// This is NOT a sanitiser — custom code is raw by design and only administrators can save it. It is a parser:
// it never evaluates anything, and it returns plain data (tag, attributes, text).

const ALLOWED = new Set(['script', 'style', 'link', 'meta', 'noscript', 'base']);
const VOID = new Set(['link', 'meta', 'base']);

/** HTML attribute -> React prop. Everything not listed is passed through unchanged (data-*, aria-*, src, href, ...). */
const RENAME = {
  class: 'className', charset: 'charSet', crossorigin: 'crossOrigin', 'http-equiv': 'httpEquiv', referrerpolicy: 'referrerPolicy',
  nomodule: 'noModule', fetchpriority: 'fetchPriority', hreflang: 'hrefLang', itemprop: 'itemProp', imagesizes: 'imageSizes',
  imagesrcset: 'imageSrcSet', fetchPriority: 'fetchPriority',
};
const BOOLEAN = new Set(['async', 'defer', 'nomodule', 'disabled']);

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
const decode = (s) => s.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m]);

/** Parse the attribute part of a tag ( ` src="x" async data-a='b' ` ) into a plain object. */
export function parseAttrs(str) {
  const out = {};
  const re = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(str))) {
    const raw = m[1];
    const name = raw.toLowerCase();
    if (/^on[a-z]+$/.test(name)) continue; // inline event handlers can't be passed through React; use a <script> instead
    if (name === 'style') continue; // React wants an object here; <head> elements don't need it
    const value = m[2] ?? m[3] ?? m[4];
    const prop = RENAME[name] || (name.startsWith('data-') || name.startsWith('aria-') ? name : name);
    if (value === undefined) out[prop] = BOOLEAN.has(name) ? true : '';
    else out[prop] = BOOLEAN.has(name) ? true : decode(value);
  }
  return out;
}

/** The index of the ">" that closes the tag opened at `start` ("<"), honouring quoted attribute values. -1 if unterminated. */
function tagEnd(src, start) {
  let quote = '';
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '>') return i;
  }
  return -1;
}

/**
 * @returns {{ nodes: Array<{tag: string, attrs: Record<string, string|boolean>, text?: string}>, ignored: string[] }}
 */
export function parseHeadSnippet(html) {
  const src = String(html ?? '').replace(/\u0000/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const nodes = [];
  const ignored = [];
  let i = 0;
  while (i < src.length) {
    const lt = src.indexOf('<', i);
    const text = src.slice(i, lt < 0 ? src.length : lt).trim();
    if (text) ignored.push(`text “${text.slice(0, 30)}${text.length > 30 ? '…' : ''}”`);
    if (lt < 0) break;
    const open = /^<([a-zA-Z][a-zA-Z0-9-]*)/.exec(src.slice(lt, lt + 40));
    if (!open) { // "</div>", "<!doctype>", a stray "<"
      const end = src.indexOf('>', lt);
      i = end < 0 ? src.length : end + 1;
      continue;
    }
    const tag = open[1].toLowerCase();
    const end = tagEnd(src, lt);
    if (end < 0) { ignored.push(`unterminated <${tag}>`); break; }
    const attrText = src.slice(lt + open[0].length, end).replace(/\/\s*$/, '');
    if (!ALLOWED.has(tag)) { ignored.push(`<${tag}>`); i = end + 1; continue; }
    const attrs = parseAttrs(attrText);
    if (VOID.has(tag)) { nodes.push({ tag, attrs }); i = end + 1; continue; }
    // script / style / noscript: raw text up to the closing tag (what a browser does)
    const close = new RegExp(`</${tag}\\s*>`, 'i').exec(src.slice(end + 1));
    const bodyEnd = close ? end + 1 + close.index : src.length;
    const body = src.slice(end + 1, bodyEnd);
    nodes.push(body.trim() || tag === 'script' ? { tag, attrs, text: body } : { tag, attrs });
    i = close ? bodyEnd + close[0].length : src.length;
  }
  return { nodes, ignored };
}

/** Site-wide / per-page CSS: leave it alone except for the one thing that could break out of its <style> element. */
export function cleanCss(css) {
  return String(css ?? '').replace(/\u0000/g, '').replace(/<\/(style)/gi, '<\\/$1').slice(0, 100_000).trim();
}

/** Raw HTML for the body locations: only the NUL character is removed. */
export function cleanRawHtml(html) {
  return String(html ?? '').replace(/\u0000/g, '').slice(0, 100_000).trim();
}
