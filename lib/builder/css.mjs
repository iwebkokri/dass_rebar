// Turns a builder document into CSS. Runs on the server for the public site and in the editor canvas, so what you see is what
// visitors get. Every value is validated here — a bad value is dropped, never emitted.
import { BREAKPOINTS, controlsFor, isDeviceMap } from './schema.mjs';

const ID_RE = /^[a-z][a-z0-9]{3,12}$/;
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%/]+\)|hsla?\(\s*[\d.\s,%/deg]+\)|var\(--[\w-]+\)|[a-z]{3,20})$/i;
const SIZE_RE = /^(auto|-?\d+(\.\d+)?(px|%|em|rem|vw|vh|ch)?|(clamp|min|max|calc)\([\d\w%.,+\-*/ ()]+\))$/;
const GRADIENT_RE = /^(linear|radial|conic)-gradient\([#\w\s,.%()/-]+\)$/i;
const BAD_CSS = /[;{}<>\\]|\/\*|\*\/|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding|url\s*\(/i;

export const isNodeId = (id) => typeof id === 'string' && ID_RE.test(id);

export function safeColor(v) {
  return typeof v === 'string' && v.length <= 80 && COLOR_RE.test(v.trim()) ? v.trim() : null;
}
export function safeSize(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return `${v}px`;
  return typeof v === 'string' && v.length <= 80 && SIZE_RE.test(v.trim()) ? v.trim() : null;
}
export function safeGradient(v) {
  return typeof v === 'string' && v.length <= 300 && GRADIENT_RE.test(v.trim()) ? v.trim() : null;
}
/** A URL safe to place inside CSS url("…"). */
export function cssUrl(v) {
  if (typeof v !== 'string' || !v || /["'()\s\\<>]/.test(v)) return null;
  return /^(\/(?!\/)|https?:\/\/)/i.test(v) ? v : null;
}

function dim(v, negative) {
  if (!v || typeof v !== 'object') return null;
  const n = (x) => {
    const num = Number(x);
    if (x === '' || x == null || !Number.isFinite(num)) return null;
    return Math.max(negative ? -2000 : 0, Math.min(2000, num));
  };
  const sides = [v.t, v.r, v.b, v.l].map(n);
  if (sides.every((s) => s === null)) return null;
  return sides.map((s) => `${s ?? 0}px`).join(' ');
}

function format(c, v) {
  switch (c.kind) {
    case 'switch': return v === true ? '' : null;
    case 'dimensions': return dim(v, c.negative);
    case 'number': {
      if (v === '' || v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? `${n}${c.unit || ''}` : null;
    }
    case 'size': return safeSize(v);
    case 'color': return safeColor(v);
    case 'align': return ['left', 'center', 'right'].includes(v) ? v : null;
    case 'select': {
      if (v === '' || v == null) return null;
      return (c.options || []).some((x) => x.value === String(v)) ? String(v) : null;
    }
    case 'image': return cssUrl(v);
    case 'text': return c.gradient ? safeGradient(v) : typeof v === 'string' && v && !BAD_CSS.test(v) ? v : null;
    default: return null;
  }
}

const prefixSel = (root, sel = '') => {
  if (!sel) return root;
  return sel.split(',').map((p, i) => (i === 0 ? root + p : `${root} ${p.trim()}`)).join(', ');
};

export function sanitizeCustomCss(css) {
  if (typeof css !== 'string') return '';
  // custom CSS legitimately contains ; { } — block only the dangerous constructs (BAD_CSS also bans those, which is right for single values)
  const BAD_CUSTOM = /[<>\\]|\/\*|\*\/|expression\s*\(|javascript:|@import|behavior\s*:|-moz-binding|url\s*\(/i;
  return BAD_CUSTOM.test(css.replace(/url\s*\(\s*["']?(\/|https?:)[^)"']*["']?\s*\)/gi, '')) ? '' : css.slice(0, 5000);
}

const DEVICE_QUERY = {
  t: `@media (max-width:${BREAKPOINTS.t}px)`,
  m: `@media (max-width:${BREAKPOINTS.m}px)`,
};
const HIDE_QUERY = {
  d: `@media (min-width:${BREAKPOINTS.t + 1}px)`,
  t: `@media (min-width:${BREAKPOINTS.m + 1}px) and (max-width:${BREAKPOINTS.t}px)`,
  m: `@media (max-width:${BREAKPOINTS.m}px)`,
};

/** Walk the tree and collect `{ device -> { selector -> declarations[] } }`. */
function collect(nodes, out) {
  for (const node of nodes) {
    if (!isNodeId(node.id)) continue;
    const root = `.dr-n-${node.id}`;
    const props = node.props || {};
    for (const c of controlsFor(node.type)) {
      if (!c.css) continue;
      let v = props[c.key];
      if (v === undefined || v === null || v === '' || v === false) continue;
      const byDevice = c.responsive && isDeviceMap(c, v) ? v : { d: v };
      for (const dev of ['d', 't', 'm']) {
        const dv = byDevice[dev];
        if (dv === undefined || dv === null || dv === '' || dv === false) continue;
        const text = format(c, dv);
        if (text === null) continue;
        for (const rule of c.css) {
          const value = rule.tpl ? (c.kind === 'switch' ? rule.tpl : rule.tpl.replace('{v}', text)) : text;
          if (value === '') continue;
          const sel = prefixSel(root, rule.sel);
          ((out[dev] ||= new Map()).get(sel) || (out[dev].set(sel, []), out[dev].get(sel))).push(`${rule.prop}:${value}`);
        }
      }
    }
    const hide = Array.isArray(props.hideOn) ? props.hideOn : [];
    for (const d of ['d', 't', 'm']) if (hide.includes(d)) (out.hide ||= []).push(`${HIDE_QUERY[d]}{${root}{display:none!important}}`);
    if (typeof props.customCss === 'string' && props.customCss.trim()) {
      const css = sanitizeCustomCss(props.customCss).replace(/\bselector\b/g, root);
      if (css) (out.custom ||= []).push(css);
    }
    if (node.children) collect(node.children, out);
  }
}

/** CSS for a whole list of nodes (a page, a header, a template …). */
export function buildCss(nodes) {
  const out = {};
  collect(nodes || [], out);
  const block = (map) => [...map].map(([sel, decls]) => `${sel}{${decls.join(';')}}`).join('');
  let css = '';
  if (out.d) css += block(out.d);
  if (out.t) css += `${DEVICE_QUERY.t}{${block(out.t)}}`;
  if (out.m) css += `${DEVICE_QUERY.m}{${block(out.m)}}`;
  if (out.hide) css += out.hide.join('');
  if (out.custom) css += out.custom.join('\n');
  return css;
}
