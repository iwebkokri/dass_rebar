// Products & bar data — re-created from components/ProductsView.tsx as builder content.
import { col, row, section, w } from '../dsl.mjs';
import { BROWN, INTER, LH_I, NAVY, box, band, ctaBand, gap, head, hero, px } from '../page-kit.mjs';

const BENDS = [
  ['straight', 'Straight bar'], ['l-bar', '90° hook / L-bar'], ['hook-180', '180° hook'], ['u-bar', 'U-bar'],
  ['stirrup', 'Stirrup / tie'], ['cranked', 'Cranked bar'], ['multi-leg', 'Multi-leg bend'], ['hoop', 'Circular hoop'],
];

const bend = ([file, label]) =>
  col(
    { span: { d: 3, t: 6, m: 6 }, bgColor: "#F3F4F6", padding: { d: box(24), m: box(16) }, gap: gap(14) },
    w.image({ src: `/images/bends/${file}.svg`, alt: label, imgWidth: '100%' }),
    w.heading({ text: label, tag: 'div', size: '16px', weight: '700', lineHeight: LH_I, font: INTER }),
  );

export default {
  path: 'products',
  title: 'Products & Bar Data',
  seoTitle: 'Products & Bar Data',
  seoDescription: 'Grade 400W/500W rebar 10M–55M, epoxy-coated rebar, GFRP bars and welded wire mesh, plus full CSA bar data.',
  content: [
    hero({
      image: '/images/p-gfrp.jpg',
      crumbs: [['HOME', '/'], ['SERVICES', '/services'], ['FABRICATION']],
      title: 'Fabrication',
      accent: '& products',
      sub: 'Grade 400W rebar from 10M to 35M, with 45M and 55M on request — plus epoxy, GFRP, mesh and accessories.',
      subMax: '620px',
      end: 0.15,
    }),

    band({ bg: '#F4F5F7', pad: 96, g: 40 }, head('01 — GRADE 400W DIAMETERS', 'Every size, one supplier'), w['bar-table']({ variant: 'chips' })),

    band(
      { bg: '#FFFFFF', top: true, pad: 96, g: 44 },
      head('02 — MATERIAL WE STOCK', 'Ready in the Vaughan yard'),
      w.products({ kind: 'stocked', layout: 'cards', cols: { d: 3, t: 2, m: 1 } }),
      w.products({ kind: 'also' }),
    ),

    section(
      { bgColor: NAVY, textColor: '#F4F5F7', padding: { d: { t: 96, b: 96 }, m: { t: 64, b: 64 } } },
      row(
        { gap: { d: '24px' }, rowAlign: 'end' },
        col({ span: { d: 8, t: 12, m: 12 } }, head('03 — BAR PROPERTIES', 'Canadian metric bar data', { dark: true })),
        col(
          { span: { d: 4, t: 12, m: 12 }, textAlign: { d: 'right', t: 'left' } },
          w.button({ label: 'Open the weight calculator →', url: '/calculator', variant: 'link', btnColor: '#F4F5F7', btnWeight: '600' }),
        ),
      ),
      row({ gap: { d: '40px' } }, col({ gap: gap(40), padding: { d: { t: 40 } } }, w['bar-diagrams']({}), w['bar-table']({ variant: 'full' }))),
    ),

    section(
      { bgColor: '#F4F5F7', padding: { d: { t: 96, b: 96 }, m: { t: 64, b: 64 } } },
      row(
        { gap: { d: '24px' }, rowAlign: 'end' },
        col({ span: { d: 8, t: 12, m: 12 } }, head('04 — TYPICAL BAR BEND SHAPES', 'Bent to your schedule')),
        col(
          { span: { d: 4, t: 12, m: 12 }, textAlign: { d: 'right', t: 'left' } },
          w.button({ label: 'Download bar bend chart (PDF)', url: 'https://dassrebar.com/wp-content/uploads/2025/05/dass-rebar-bar-bends.pdf', icon: 'download', newTab: true }),
        ),
      ),
      row(
        { gap: { d: '1px' }, bgColor: '#B4BCC5', borderStyle: 'solid', borderWidth: box(1), borderColor: '#B4BCC5', margin: { d: { t: 40 } } },
        ...BENDS.map(bend),
      ),
    ),

    ctaBand(),
  ],
};
