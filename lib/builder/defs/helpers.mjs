// Helpers for declaring builder controls (shared by schema.mjs and defs/*.mjs).
export const o = (...v) => v.map((x) => (Array.isArray(x) ? { value: x[0], label: x[1] } : { value: x, label: String(x).replace(/^./, (c) => c.toUpperCase()) }));
export const ctl = (kind, key, label, more = {}) => ({ kind, key, label, tab: 'content', ...more });

export const FONTS = o(
  ['', 'Default'],
  ['var(--font-inter), "Helvetica Neue", Arial, sans-serif', 'Inter (body)'],
  ['var(--font-manrope), sans-serif', 'Manrope (headings)'],
  ['Georgia, "Times New Roman", serif', 'Serif'],
  ['ui-monospace, Menlo, Consolas, monospace', 'Monospace']
);
export const WEIGHTS = o(['', 'Default'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semi-bold'], ['700', 'Bold'], ['800', 'Extra-bold']);
export const CASES = o(['', 'Default'], ['none', 'Normal'], ['uppercase', 'UPPERCASE'], ['capitalize', 'Capitalize']);
export const ALIGN = o(['', 'Default'], ['left', 'Left'], ['center', 'Center'], ['right', 'Right']);

/** Typography group. `prefix` keeps keys unique when a widget has several text parts; `sel` is the element they style. */
export function typo(prefix, sel, group = 'Typography', extra = {}) {
  const k = (s) => (prefix ? prefix + s : s.charAt(0).toLowerCase() + s.slice(1));
  const base = { tab: 'style', group, ...extra };
  return [
    ctl('color', k('Color'), 'Colour', { ...base, css: [{ sel, prop: 'color' }] }),
    ctl('select', k('Font'), 'Font', { ...base, options: FONTS, css: [{ sel, prop: 'font-family' }] }),
    ctl('size', k('Size'), 'Size', { ...base, responsive: true, units: ['px', 'em', 'rem', 'vw'], css: [{ sel, prop: 'font-size' }] }),
    ctl('select', k('Weight'), 'Weight', { ...base, options: WEIGHTS, css: [{ sel, prop: 'font-weight' }] }),
    ctl('number', k('LineHeight'), 'Line height', { ...base, min: 0.8, max: 3, step: 0.05, css: [{ sel, prop: 'line-height' }] }),
    ctl('size', k('Spacing'), 'Letter spacing', { ...base, units: ['px', 'em'], css: [{ sel, prop: 'letter-spacing' }] }),
    ctl('select', k('Case'), 'Transform', { ...base, options: CASES, css: [{ sel, prop: 'text-transform' }] }),
  ];
}

