// Services — re-created from components/ServicesView.tsx as builder content.
// Six alternating photo/text bands; each section has an anchor id so /services#fabrication etc. keep working.
import { col, row, section, w } from '../dsl.mjs';
import { BROWN, INTER, STACKED, WIDE, LH_I, NAVY, TAN, ctaBand, gap, hero, px } from '../page-kit.mjs';

const RULE = '#C3C9D0';

// [n, anchor, title, photo, alt, photo border, background, dark?, flip?, copy, link?]
const SERVICES = [
  ['01', 'fabrication', 'Fabrication', '/images/p-coupler.jpg', 'Reinforcing bars and mechanical couplers in stock', '#B4BCC5', '#F4F5F7', false, false,
    'Our facility runs cutting-edge rebar fabrication equipment with advanced automation for precise measurements and accurate bends. That equipment, paired with an experienced team, produces rebar to the quality people in the field expect and can trust.',
    ['See what we stock →', '/products']],
  ['02', 'estimating', 'Estimating', '/images/p-takeoff.jpg', 'Estimating from structural drawings', RULE, '#FFFFFF', false, true,
    'Precise, reliable cost assessments built with advanced software and deep industry experience. We account for every detail — from material specifications to project timelines — so you have a complete picture of costs and resource needs.',
    ['Send drawings for an estimate →', '/contact']],
  ['03', 'management', 'Project management', '/images/hic-1.jpg', 'Aerial view of an active project site', '#2C3F63', NAVY, true, false,
    'Our project managers oversee every phase, from planning and scheduling to final delivery and installation. Proven methods coordinate resources, streamline workflows and reduce risk, so projects finish on time and on budget.'],
  ['04', 'detailing', 'Detailing', '/images/p-detailing.jpg', 'Detailer reviewing rebar placing drawings', null, '#F4F5F7', false, true,
    'Skilled detailers use advanced software and industry best practice to produce complete, accurate rebar placing drawings and specifications — minimizing errors and delays. Whatever the size or shape of the bar, we handle complex jobs.'],
  ['05', 'delivery', 'Delivery', '/images/p-mto-banner.jpg', 'Dass Rebar yard, MTO approved supplier', RULE, '#FFFFFF', false, false,
    'An extensive, reliable fleet handles orders of any size. We coordinate closely with your team so materials arrive safely, on schedule and in perfect condition at your site.'],
  ['06', 'assembly', 'Assembly', '/images/p-worker.jpg', 'Ironworker tying reinforcing steel on site', '#B4BCC5', '#F4F5F7', false, true,
    'Our team assembles rebar components to precise specifications for structural integrity, delivering ready-to-install assemblies that save time and labour on site.',
    ['Ask about pre-assembly →', '/contact']],
];

const NAV = [
  ['01', 'Fabrication', '#fabrication'], ['02', 'Estimating', '#estimating'], ['03', 'Project management', '#management'],
  ['04', 'Detailing', '#detailing'], ['05', 'Delivery', '#delivery'], ['06', 'Assembly', '#assembly'],
];

/** One cell of the in-page nav: small grey number + bold label linking to the section. */
const navCol = ([n, label, href], i) => {
  const first = (per) => i % per === 0;
  const pad = (per) => (first(per) ? px(22, 0, 22, 0) : px(22, 0, 22, 16));
  const bw = (per) => (first(per) ? { l: 0 } : { l: 1 });
  return col(
    {
      span: { d: 2, t: 4, m: 6 }, direction: 'row', gap: gap(10), colAlign: 'flex-end',
      padding: { d: pad(6), t: pad(3), m: pad(2) },
      borderStyle: 'solid', borderColor: RULE, borderWidth: { d: bw(6), t: bw(3), m: bw(2) },
    },
    w.heading({ text: n, tag: 'div', font: INTER, size: '12px', weight: '700', lineHeight: LH_I, color: '#4A5568' }),
    w.heading({ text: label, tag: 'div', link: href, font: INTER, size: '16px', weight: '700', lineHeight: LH_I, color: NAVY }),
  );
};

const service = ([n, anchor, title, photo, alt, border, bg, dark, flip, copy, link]) => {
  const image = col(
    // text-first bands put the photo on the right on desktop, but still show it first once stacked
    { span: { d: 6, t: 12, m: 12 }, ...(flip ? { order: { d: 2, t: 0 } } : {}) },
    w.image({
      src: photo, alt, ratio: '4 / 3', fit: 'cover', imgWidth: '100%', imgRadius: { t: 15, r: 15, b: 15, l: 15 },
      radius: { t: 16, r: 16, b: 16, l: 16 },
      ...(border ? { borderStyle: 'solid', borderWidth: { t: 1, r: 1, b: 1, l: 1 }, borderColor: border } : {}),
    }),
  );
  const text = col(
    { span: { d: 6, t: 12, m: 12 }, gap: gap(20), ...STACKED },
    ...[
    w.heading({ text: n, tag: 'div', size: '96px', weight: '800', lineHeight: 0.8, color: dark ? TAN : BROWN }),
    w.heading({ text: title, tag: 'h2', size: 'clamp(36px, 4vw, 56px)', lineHeight: 1, weight: '800', spacing: '-0.02em' }),
    w.text({ html: `<p>${copy}</p>`, size: '17px', lineHeight: 1.65, color: dark ? '#DCDFE3' : '#23334F' }),
    link
      ? w.text({ html: `<p><a href="${link[1]}">${link[0]}</a></p>`, size: '16px', weight: '700', lineHeight: LH_I, linkColor: NAVY, padding: { d: { t: 12, b: 12 } } })
      : null,
    ].filter(Boolean),
  );
  return section(
    { anchor, bgColor: bg, ...(dark ? { textColor: '#F4F5F7' } : {}), padding: { d: { t: 96, b: 96 } } },
    row({ gap: WIDE, rowAlign: 'center' }, image, text),
  );
};

export default {
  path: 'services',
  title: 'Services',
  seoTitle: 'Services',
  seoDescription: 'Fabrication, estimating, detailing, project management, delivery and assembly — all in-house.',
  content: [
    hero({
      image: '/images/p-worker.jpg', crumbs: [['HOME', '/'], ['SERVICES']],
      title: 'Our services',
      sub: 'Six in-house capabilities that take your reinforcing steel from drawing to jobsite — with one accountable team.',
    }),

    // in-page navigation
    section(
      { bgColor: '#FFFFFF', borderStyle: 'solid', borderWidth: { b: 1 }, borderColor: RULE },
      row({ gap: gap(0) }, NAV.map(navCol)),
    ),

    ...SERVICES.map(service),
    ctaBand(),
  ],
};
