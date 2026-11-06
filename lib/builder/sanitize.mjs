// Server-side validation of a builder document before it is stored. Nothing the browser sends is trusted: every node type and
// prop is checked against the schema, rich text is run through an allow-list sanitiser, URLs are restricted, and limits apply.
import sanitizeHtml from 'sanitize-html';
import { CHILD_TYPES, ICON_NAMES, WIDGETS, controlsFor, isDeviceMap } from './schema.mjs';
import { isNodeId, safeColor, safeGradient, safeSize, sanitizeCustomCss } from './css.mjs';
import { newId, walk } from './tree.mjs';
import { safeMediaUrl, safeUrl } from './url.mjs';

export { safeMediaUrl, safeUrl };

export const LIMITS = { nodes: 4000, depth: 10, bytes: 3_000_000 };

const RICH = {
  allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'code', 'hr', 'span', 'sub', 'sup'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowProtocolRelative: false,
  transformTags: {
    a: (tag, attribs) => {
      const attrs = { href: attribs.href || '' };
      if (attribs.target === '_blank') { attrs.target = '_blank'; attrs.rel = 'noopener noreferrer'; }
      return { tagName: 'a', attribs: attrs };
    },
    b: 'strong',
    i: 'em',
  },
};
export function sanitizeRich(html) {
  if (typeof html !== 'string') return '';
  return sanitizeHtml(html.slice(0, 100_000), RICH).trim();
}

function clampNum(c, n) {
  if (!Number.isFinite(n)) return undefined;
  return Math.max(c.min ?? -1e6, Math.min(c.max ?? 1e6, n));
}

/** Validate one value against its control. Returns `undefined` to drop it. */
function cleanValue(c, v, ctx) {
  if (v === undefined || v === null) return undefined;
  switch (c.kind) {
    case 'text': {
      if (typeof v !== 'string') return undefined;
      const s = v.replace(/\u0000/g, '').slice(0, 2000);
      if (c.gradient) return safeGradient(s) || undefined;
      if (c.pattern && s && !c.pattern.test(s)) return undefined;
      return s;
    }
    case 'textarea': {
      if (typeof v !== 'string') return undefined;
      if (c.custom) return sanitizeCustomCss(v);
      if (c.code) return ctx.isAdmin ? v.slice(0, 50_000) : undefined;
      return v.replace(/\u0000/g, '').slice(0, 20_000);
    }
    case 'rich': return sanitizeRich(v);
    case 'url': return safeUrl(v);
    case 'image':
    case 'video': return safeMediaUrl(v);
    case 'number': return clampNum(c, typeof v === 'number' ? v : v === '' ? NaN : Number(v));
    case 'size': return safeSize(v) ?? undefined;
    case 'color': return safeColor(v) ?? undefined;
    case 'switch': return v === true ? true : undefined;
    case 'select': return (c.options || []).some((x) => x.value === String(v)) ? String(v) : undefined;
    case 'align': return ['left', 'center', 'right'].includes(v) ? v : undefined;
    case 'multi': {
      if (!Array.isArray(v)) return undefined;
      const ok = v.filter((x) => (c.options || []).some((o) => o.value === x));
      return ok.length ? [...new Set(ok)] : undefined;
    }
    case 'icon': return v === '' || ICON_NAMES.includes(v) ? v : undefined;
    case 'resource': return typeof v === 'string' || typeof v === 'number' ? (/^[\w-]{0,64}$/.test(String(v)) ? String(v) : undefined) : undefined;
    case 'dimensions': {
      if (!v || typeof v !== 'object') return undefined;
      const out = {};
      for (const side of ['t', 'r', 'b', 'l']) {
        if (v[side] === '' || v[side] === undefined || v[side] === null) continue;
        const n = Number(v[side]);
        if (Number.isFinite(n)) out[side] = Math.max(c.negative ? -2000 : 0, Math.min(2000, n));
      }
      return Object.keys(out).length ? out : undefined;
    }
    case 'repeater': {
      if (!Array.isArray(v)) return undefined;
      return v.slice(0, 100).map((item) => cleanProps(c.fields || [], item && typeof item === 'object' ? item : {}, ctx, null));
    }
    default: return undefined;
  }
}

function cleanControl(c, raw, ctx) {
  if (c.responsive && c.kind !== 'repeater') {
    // responsive values are { d, t, m }; a bare value means desktop
    const src = isDeviceMap(c, raw) ? raw : { d: raw };
    const out = {};
    for (const dev of ['d', 't', 'm']) {
      const val = cleanValue(c, src[dev], ctx);
      if (val !== undefined && val !== '') out[dev] = val;
    }
    return Object.keys(out).length ? out : undefined;
  }
  const val = cleanValue(c, raw, ctx);
  return val === '' ? undefined : val;
}

function cleanProps(controls, props, ctx, node) {
  const out = {};
  for (const c of controls) {
    if (!(c.key in props)) continue;
    // custom HTML: non-admins keep whatever the stored version had
    if (c.code && !ctx.isAdmin) {
      const prev = node && ctx.prevCode.get(node.id);
      if (prev !== undefined) out[c.key] = prev;
      continue;
    }
    const val = cleanControl(c, props[c.key], ctx);
    if (val !== undefined) out[c.key] = val;
  }
  return out;
}

/**
 * Validate + normalise a document. Returns `{ doc, dropped }` (dropped = number of nodes removed for being invalid).
 * Throws if the document is too large / deep. `prev` is the currently stored document (used for admin-only widgets).
 */
export function sanitizeDoc(input, { isAdmin = false, prev = null } = {}) {
  if (!input || typeof input !== 'object' || !Array.isArray(input.nodes)) throw new Error('Invalid page document.');
  let count = 0;
  let dropped = 0;
  const seen = new Set();
  const prevCode = new Map();
  const prevType = new Map();
  if (prev?.nodes) walk(prev.nodes, (n) => { prevType.set(n.id, n.type); if (n.type === 'html') prevCode.set(n.id, n.props?.code ?? ''); });
  const ctx = { isAdmin, prevCode };

  const clean = (list, parentType, depth) => {
    if (!Array.isArray(list)) return [];
    if (depth > LIMITS.depth) throw new Error('Page is nested too deeply.');
    const out = [];
    for (const raw of list) {
      if (!raw || typeof raw !== 'object' || typeof raw.type !== 'string') { dropped++; continue; }
      const def = WIDGETS[raw.type];
      const allowed = parentType === null ? raw.type === 'section' : CHILD_TYPES[parentType]?.includes(raw.type);
      if (!def || !allowed) { dropped++; continue; }
      if (def.adminOnly && !isAdmin && prevType.get(raw.id) !== raw.type) { dropped++; continue; }
      if (++count > LIMITS.nodes) throw new Error('Page has too many elements.');
      let id = isNodeId(raw.id) && !seen.has(raw.id) ? raw.id : newId();
      while (seen.has(id)) id = newId();
      seen.add(id);
      const node = { id, type: raw.type, props: {} };
      node.props = cleanProps(controlsFor(raw.type), raw.props && typeof raw.props === 'object' ? raw.props : {}, ctx, node);
      if (def.container) node.children = clean(raw.children, raw.type, depth + 1);
      out.push(node);
    }
    return out;
  };

  const doc = { v: 1, nodes: clean(input.nodes, null, 1) };
  if (JSON.stringify(doc).length > LIMITS.bytes) throw new Error('Page is too large.');
  return { doc, dropped };
}
