// A tiny DSL for writing page content as code (used by db/pages/*.mjs and the seed script).
//
//   import { section, row, col, w, cols } from '../dsl.mjs';
//   section({ bgColor: '#182845', padding: { d: { t: 96, b: 96 }, m: { t: 56, b: 56 } } },
//     row({ gap: { d: '48px' } },
//       col({ span: { d: 6, t: 12, m: 12 } }, w.heading({ text: 'Hello', tag: 'h2' }), w.text({ html: '<p>Body</p>' })),
//       col({ span: { d: 6, t: 12, m: 12 } }, w.image({ src: '/images/p-worker.jpg', alt: '' }))));
//
// Responsive props ({ d, t, m }): `d` = desktop (applies everywhere unless overridden), `t` = tablet (<=1024px), `m` = mobile (<=767px).
// Shortcuts:  cols([6, 6], rowProps?)  -> a row of columns with those desktop spans (tablet/mobile stack);
//             stack(props, ...children) -> a single-column row.
import { makeNode } from '../lib/builder/tree.mjs';

export const section = (props = {}, ...rows) => makeNode('section', props, rows.flat());
export const row = (props = {}, ...columns) => makeNode('row', props, columns.flat());
export const col = (props = {}, ...children) => makeNode('column', { span: { d: 12, t: 12, m: 12 }, ...props }, children.flat());

/** Widgets: w.heading({...}), w.text({...}), w['icon-box']({...}) … — any widget type from lib/builder/schema.mjs. */
export const w = new Proxy({}, { get: (_t, type) => (props = {}) => makeNode(String(type), props) });

/** Responsive column span from a desktop span: wide columns stack on tablet/mobile. */
export const span = (d, t = d >= 8 ? 12 : d >= 4 ? 6 : 12, m = 12) => ({ d, t, m });

/** A row whose columns have the given desktop spans, e.g. cols([4, 8], { gap: ... }). Pass children via .map or use `fill`. */
export function cols(spans, rowProps = {}, ...columns) {
  const kids = columns.flat();
  return row(rowProps, ...spans.map((s, i) => col({ span: typeof s === 'number' ? span(s) : s }, ...(Array.isArray(kids[i]) ? kids[i] : kids[i] ? [kids[i]] : []))));
}

/** A one-column row. */
export const stack = (props = {}, ...children) => row({}, col(props, ...children));

/** Section with a boxed single column — the most common "band of content". */
export const band = (sectionProps = {}, colProps = {}, ...children) => section(sectionProps, stack(colProps, ...children));
