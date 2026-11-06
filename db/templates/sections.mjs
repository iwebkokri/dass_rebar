// Saved sections ('section' templates) — reusable blocks that pages include with  w.template({ templateId: '<slug of the name>' }).
// 'CTA band' = the "Talk with a rebar expert" band that sits above the footer on every page except /contact and /quote.
import { section, row, col, w } from '../dsl.mjs';

const INTER = 'var(--font-inter), "Helvetica Neue", Arial, sans-serif';
const MANROPE = 'var(--font-manrope), sans-serif';
const NAVY = '#182845';
const BROWN = '#7F5F47';
const sides = (n) => ({ t: n, r: n, b: n, l: n });

const checkItem = (title) =>
  w['icon-box']({
    icon: 'check-circle', title, text: '', layout: 'left',
    iconSize: '22px', iconColor: BROWN, ibGap: '12px',
    titleFont: INTER, titleSize: '17px', titleWeight: '400', titleColor: NAVY,
  });

const ctaBand = section(
  { bgColor: '#F4F5F7', borderStyle: 'solid', borderWidth: { t: 1, r: 0, b: 0, l: 0 }, borderColor: '#E3E6EA', padding: { d: { t: 80, b: 80 } } },
  row({ gap: { d: '40px', m: '16px' }, rowAlign: 'center' },
    // left: pitch
    col({ span: { d: 7, t: 12, m: 12 }, gap: '20px' },
      w.heading({ text: 'GET IN TOUCH', tag: 'span', font: INTER, size: '12px', weight: '700', spacing: '0.12em', lineHeight: 1.25, color: '#6B4F3A' }),
      w.heading({ text: 'Talk with a rebar expert', tag: 'h2', size: 'clamp(32px, 3.6vw, 48px)', lineHeight: 1.08, weight: '800', spacing: '-0.02em' }),
      row({}, col({ gap: '12px' },
        checkItem('Projects of any scale, residential to civil'),
        checkItem('In-house estimating from your drawings'),
        checkItem('MTO-approved steel, delivered on schedule'),
      )),
    ),
    // right: call-us card
    col({ span: { d: 5, t: 12, m: 12 }, margin: { m: { t: 24 } }, bgColor: NAVY, textColor: '#FFFFFF', radius: sides(20), padding: sides(36), gap: '14px' },
      w.heading({ text: 'Call our sales team', tag: 'span', font: INTER, size: '14px', weight: '400', spacing: '0px', lineHeight: 1.25, color: '#DCDFE3' }),
      w.heading({ text: '(905) 813-3014', tag: 'span', link: 'tel:9058133014', font: MANROPE, size: { d: '40px', m: '32px' }, weight: '800', spacing: '-0.01em', lineHeight: 1.37, color: '#FFFFFF' }),
      row({ margin: { d: { t: 6 } } }, col({ direction: 'row', wrap: true, gap: '10px' },
        w.button({ label: 'Request a quote', url: '/quote', variant: 'solid', size: 'md', btnBg: BROWN, btnColor: '#FFFFFF', btnPadding: { t: 13, r: 21, b: 13, l: 21 } }),
        w.button({ label: 'Email us', url: 'mailto:sales@dassrebar.com', variant: 'outline', size: 'md', btnColor: '#FFFFFF', btnBorder: '#919CA4', btnWeight: '600', btnPadding: { t: 13, r: 21, b: 13, l: 21 } }),
      )),
    ),
  ),
);

export default [{ kind: 'section', name: 'CTA band', content: [ctaBand] }];
