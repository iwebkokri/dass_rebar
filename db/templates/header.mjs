// Global header (kind 'header'): the navy info bar + the logo / navigation row. Mirrors components/SiteHeader.tsx.
// The navigation itself comes from the `primary` menu (db/menus/primary.mjs) through the nav-menu widget.
import { section, row, col, w } from '../dsl.mjs';

const INTER = 'var(--font-inter), "Helvetica Neue", Arial, sans-serif';
const TAN = '#B0A18E';

/** 13px text of the info bar. */
const bar = (text, extra = {}) => w.heading({ text, tag: 'span', font: INTER, size: '13px', weight: '400', spacing: '0px', lineHeight: 1.25, ...extra });

// ---- top info bar -------------------------------------------------------------------------------------------------
const topBar = section(
  { tag: 'div', bgColor: '#182845', textColor: '#DCDFE3', padding: { d: { t: 6, b: 6 } } },
  row({ gap: { d: '24px' } },
    // left: MTO + address (hidden on phones; the address also on tablets)
    col({ span: { d: 7, t: 7, m: 12 }, direction: 'row', colAlign: 'center', wrap: true, gap: '8px', hideOn: ['m'] },
      w.icon({ icon: 'shield', iconSize: '14px', iconColor: TAN }),
      bar('MTO Designated Source for Materials', { margin: { d: { r: 12 } } }),
      w.icon({ icon: 'map-pin', iconSize: '14px', iconColor: TAN, hideOn: ['t', 'm'] }),
      bar('370 New Enterprise Way, Vaughan, ON', { hideOn: ['t', 'm'] }),
    ),
    // right: phone + email (spread across the bar on phones)
    col({ span: { d: 5, t: 5, m: 12 }, direction: 'row', colAlign: 'center', wrap: true, gap: '20px', justify: { d: 'flex-end', m: 'space-between' } },
      bar('(905) 813-3014', { link: 'tel:9058133014', color: '#FFFFFF', weight: '600' }),
      bar('sales@dassrebar.com', { link: 'mailto:sales@dassrebar.com', color: '#FFFFFF' }),
    ),
  ),
);

// ---- logo + navigation row ----------------------------------------------------------------------------------------
// 'dr-pos-static' lets the mega menu / mobile panel anchor to the edge of the section instead of the boxed row.
const mainRow = section(
  {
    tag: 'header', bgColor: '#FFFFFF', cssClass: 'dr-pos-static',
    padding: { d: { t: 14, b: 14 }, t: { t: 10, b: 10 } },
    borderStyle: 'solid', borderWidth: { t: 0, r: 0, b: 1, l: 0 }, borderColor: '#E3E6EA',
  },
  row({},
    col({ direction: 'row', justify: 'space-between', colAlign: 'center', wrap: true, gap: '32px' },
      w.logo({ src: '/images/logo-navy.png', alt: 'Dass Rebar', link: '/', tagline: 'A JDASS CORP\nCOMPANY' }),
      w['nav-menu']({
        menu: 'primary', layout: 'bar',
        megaEyebrow: 'OUR SERVICES',
        megaIntro: 'From the first takeoff to the last bundle on site, every step runs in-house at our Vaughan facility.',
        megaLabel: 'All services →', megaUrl: '/services',
      }),
    ),
  ),
);

export default [{ kind: 'header', name: 'Main header', content: [topBar, mainRow] }];
