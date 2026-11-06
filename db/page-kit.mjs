// Shared building blocks for the re-created marketing pages (about, services, products, projects).
// Written with the DSL (db/dsl.mjs); the values reproduce the look of the original hard-coded views.
import { col, row, section, stack, w } from './dsl.mjs';

export const NAVY = '#182845';
export const TAN = '#B0A18E';
export const BROWN = '#7F5F47';
export const BROWN_DK = '#6B4F3A';
export const INTER = 'var(--font-inter), "Helvetica Neue", Arial, sans-serif';

/** Manrope's "line-height: normal" — the old views left line-height unset on most headings. */
export const LH_M = 1.366;
/** Inter's "line-height: normal". */
export const LH_I = 1.21;

export const px = (t, r = t, b = t, l = r) => ({ t, r, b, l });
/** Same value on all four sides. */
export const box = (n) => ({ t: n, r: n, b: n, l: n });
export const gap = (n) => ({ d: `${n}px` });

/** Wide two-column row gap. A 12-track grid adds 11 gaps, so on phones the gap must shrink or the row overflows. */
export const WIDE = { d: '56px', m: '24px' };
/** Spread onto the second column of a WIDE row: restores the 56px vertical space once the columns stack on a phone. */
export const STACKED = { padding: { m: { t: 32 } } };

export const H2 = 'clamp(34px, 4vw, 54px)';

/** Page hero: background photo + navy gradient, breadcrumb, h1 (optionally with a second tan line) and a sub line. */
export function hero({ image, crumbs, title, accent, sub, subMax = '600px', end = 0.2 }) {
  const trail = crumbs.map(([label, href]) => (href ? `<a href="${href}">${label}</a>` : label)).join(' / ');
  const h1 = { size: { d: 'clamp(56px, 7vw, 112px)', m: 'clamp(40px, 13vw, 56px)' }, weight: '800', lineHeight: 0.9, spacing: '-0.02em' };
  return section(
    {
      bgColor: NAVY, textColor: '#F4F5F7', bgImage: image, bgSize: 'cover', bgPosition: 'center',
      overlay: 'rgba(24,40,69,0.5)',
      overlayGradient: `linear-gradient(90deg, rgba(24,40,69,0.97) 0%, rgba(24,40,69,0.86) 45%, rgba(24,40,69,${end}) 100%)`,
      padding: { d: { t: 72, b: 96 } },
    },
    stack(
      { gap: gap(22) },
      ...[
        w.text({ html: `<p>${trail}</p>`, color: '#F4F5F7', size: '13px', lineHeight: LH_I, spacing: '0.08em', linkColor: '#DCDFE3' }),
        w.heading({ text: title, tag: 'h1', ...h1 }),
        // second line of a two-tone headline: pulled up so it sits exactly where a <br> would put it
        accent ? w.heading({ text: accent, tag: 'div', ...h1, color: TAN, margin: { d: { t: -22 } } }) : null,
        w.text({ html: `<p>${sub}</p>`, size: '19px', lineHeight: 1.55, color: '#DCDFE3', maxWidth: { d: subMax } }),
      ].filter(Boolean),
    ),
  );
}

/** Small tracked caps label above a section heading. */
export const eyebrow = (text, color = BROWN_DK) =>
  w.heading({ text, tag: 'div', font: INTER, size: '13px', weight: '700', spacing: '0.14em', lineHeight: LH_I, color });

export const h2 = (text, size = H2) => w.heading({ text, tag: 'h2', size, lineHeight: 1, weight: '800', spacing: '-0.02em' });

/** Eyebrow + h2 as one group (a nested row so the 14px gap is independent of the section's own gap). */
export const head = (label, title, { dark = false, size, cp = {} } = {}) =>
  row({}, col({ gap: gap(14), ...cp }, eyebrow(label, dark ? TAN : BROWN_DK), h2(title, size)));

/** Body copy block (rich text). */
export const body = (html, o = {}) => w.text({ html, size: '18px', lineHeight: 1.65, color: '#23334F', paraGap: '22px', ...o });

/** A band of content: section with background + vertical padding, one column inside. */
export function band({ bg, dark = false, top = false, pad = 104, anchor, gap: g, ...more } = {}, ...children) {
  return section(
    {
      ...(bg ? { bgColor: bg } : {}),
      ...(dark ? { textColor: '#F4F5F7' } : {}),
      ...(top ? { borderStyle: 'solid', borderWidth: { t: 1 }, borderColor: '#C3C9D0' } : {}),
      padding: { d: { t: pad, b: pad } },
      ...(anchor ? { anchor } : {}),
      ...more,
    },
    stack(g ? { gap: gap(g) } : {}, ...children.flat().filter(Boolean)),
  );
}

/** The shared "Talk with a rebar expert" call-to-action band (a saved section). */
export const ctaBand = () => section({ contentMode: 'full' }, row({}, col({ gap: gap(0) }, w.template({ templateId: 'cta-band' }))));
