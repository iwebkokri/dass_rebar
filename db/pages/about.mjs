// About — re-created from components/AboutView.tsx as builder content.
import { col, row, section, w } from '../dsl.mjs';
import { BROWN_DK, INTER, STACKED, WIDE, LH_I, LH_M, NAVY, TAN, band, body, box, ctaBand, eyebrow, gap, h2, head, hero, px } from '../page-kit.mjs';

const RULE = '#C3C9D0';
const SP6 = { d: 6, t: 12, m: 12 };

// ---- 02 who we serve: four lettered columns -------------------------------------------------------------------------
const SERVE = [
  ['A', 'Residential developers', 'Mid-rise and high-rise towers, townhomes and seniors’ residences.'],
  ['B', 'ICI construction', 'Industrial, commercial and institutional builds, from arenas to hotels.'],
  ['C', 'Civil construction', 'MTO-approved steel for highways, bridges and public infrastructure.'],
  ['D', 'Precast', 'Cut-and-bent bar and mesh supplied to precast producers.'],
];
// padding + divider per column, per device (2x2 on tablet, stacked on mobile)
const SERVE_LAYOUT = [
  { pad: { d: px(28, 24, 8, 0), t: px(28, 24, 8, 0), m: px(28, 0, 8, 0) }, bw: { d: { r: 1 }, t: { r: 1 }, m: { r: 0 } } },
  { pad: { d: px(28, 24, 8, 24), t: px(28, 0, 8, 24), m: px(28, 0, 8, 0) }, bw: { d: { r: 1 }, t: { r: 0 }, m: { t: 1 } } },
  { pad: { d: px(28, 24, 8, 24), t: px(28, 24, 8, 0), m: px(28, 0, 8, 0) }, bw: { d: { r: 1 }, t: { r: 1, t: 1 }, m: { r: 0, t: 1 } } },
  { pad: { d: px(28, 0, 8, 24), t: px(28, 0, 8, 24), m: px(28, 0, 8, 0) }, bw: { d: { r: 0 }, t: { t: 1 }, m: { t: 1 } } },
];
const serveCol = ([letter, title, text], i) =>
  col(
    {
      span: { d: 3, t: 6, m: 12 }, gap: gap(10), padding: SERVE_LAYOUT[i].pad,
      borderStyle: 'solid', borderColor: RULE, borderWidth: SERVE_LAYOUT[i].bw,
    },
    w.heading({ text: letter, tag: 'div', font: INTER, size: '13px', weight: '600', lineHeight: LH_I, color: BROWN_DK }),
    w.heading({ text: title, tag: 'h3', size: '24px', lineHeight: LH_M }),
    w.text({ html: `<p>${text}</p>`, size: '15px', lineHeight: 1.55, color: '#3A4658' }),
  );

// ---- 03 story: four timeline columns --------------------------------------------------------------------------------
const STORY = [
  ['1986', 'Jay Dass opens an electronics store in downtown Toronto — the start of JDASS Corp.'],
  ['Growth', 'The group diversifies into real estate, hospitality, retail and metals, building substantial land holdings across the GTA.'],
  ['Metals', 'Dass Metal Products becomes a national provider of drywall framing and accessories, joined by Dass Steel Service Centre and Dass Rebar.'],
  ['Today', 'Dass Rebar is listed on MTO’s Designated Sources for Materials and serves projects across Ontario from Vaughan.'],
];
const storyCol = ([label, text], i) =>
  col(
    { span: { d: 3, t: 6, m: 12 }, gap: gap(12), padding: { d: px(28, i === 3 ? 0 : 28, 0, 0), m: px(28, 0, 0, 0) } },
    w.heading({ text: label, tag: 'div', size: '48px', lineHeight: LH_M, ...(i === 3 ? { color: TAN } : {}) }),
    w.text({ html: `<p>${text}</p>`, size: '16px', lineHeight: 1.6, color: '#DCDFE3' }),
  );

// ---- 04 leadership -----------------------------------------------------------------------------------------------------
const PEOPLE = [['JD', 'Jay Dass', 'Founder'], ['JD', 'Jaswant Dass', 'Chief Executive Officer'], ['PD', 'Preet Dass', 'Chief Operating Officer'], ['ND', 'Navjot Dass', 'Managing Director']];
const person = ([initials, name, role]) =>
  col(
    { span: { d: 6, t: 6, m: 12 }, gap: gap(14) },
    row({}, col({ aspect: '1 / 1', bgColor: NAVY, justify: 'center', colAlign: 'center' },
      w.heading({ text: initials, tag: 'div', size: '72px', lineHeight: LH_M, color: TAN }))),
    w.heading({ text: name, tag: 'div', size: '22px', lineHeight: LH_M }),
    w.text({ html: `<p>${role}</p>`, size: '14px', lineHeight: LH_I, color: '#4A5568', margin: { d: { t: -8 } } }),
  );

// ---- 05 expertise -----------------------------------------------------------------------------------------------------
const ibox = (icon, title, text) =>
  w['icon-box']({
    icon, layout: 'left', title, text, iconSize: '40px', iconColor: NAVY, ibGap: '24px',
    titleSize: '22px', titleLineHeight: LH_M, bodyColor: '#3A4658', bodySize: '16px', bodyLineHeight: 1.6,
    padding: { d: { t: 24, b: 24 } }, borderStyle: 'solid', borderWidth: { b: 1 }, borderColor: RULE,
  });

// ---- 06 JDASS family ---------------------------------------------------------------------------------------------------
// [label, name, url, logo?, logoWidthPx?]
const FAMILY = [
  ['HOLDING', 'JDASS Corp', 'https://dass.ca/', '/images/logo-jdass.png', 132],
  ['METALS', 'Dass Metal Products', 'https://dassmetal.com/', '/images/logo-metal.png', 150],
  ['METALS', 'Dass Steel Service Centre', 'https://dasssteel.com/', '/images/logo-dss.png', 132],
  ['METALS', 'Quick Scrap Metal', 'https://quickscrapmetal.com/', '/images/logo-qsm.png', 132],
  ['VENUES', 'Mississauga Convention Centre', 'https://mississaugaconvention.com/'],
  ['VENUES', 'The Play Scape', 'https://theplayscape.ca/'],
  ['HOSPITALITY', 'Skye Hotel', 'https://skyehotel.ca/'],
  ['HOSPITALITY', 'EST Hotel', 'https://esthotel.ca/'],
  ['HOSPITALITY', 'Meadowvale Hotel', 'https://meadowvalehotel.ca/'],
  ['LEISURE', 'Shanty Bay Golf Club', 'https://shantybaygolf.com/'],
  ['RETAIL', 'Food World Supermarket', 'https://foodworldsupermarket.com/'],
  ['PROPERTY', 'JDASS Real Estate', 'https://dass.ca/industries/real-estate/'],
];
const tile = ([label, name, url, logo, logoW]) =>
  col(
    { span: { d: 3, t: 4, m: 12 }, bgColor: '#F3F4F6', padding: { d: px(28, 24) }, gap: gap(6), minHeight: { d: '96px' } },
    w.heading({ text: label, tag: 'div', font: INTER, size: '11px', weight: '400', spacing: '0.1em', lineHeight: LH_I, color: '#4A5568' }),
    logo
      ? w.image({ src: logo, alt: name, link: url, imgWidth: logoW ? `${logoW}px` : undefined, fit: 'contain' })
      : w.heading({ text: name, tag: 'div', link: url, size: '20px', lineHeight: LH_M, color: NAVY }),
  );

export default {
  path: 'about',
  title: 'About Us',
  seoTitle: 'About Us',
  seoDescription: 'Family-led since 1986 — learn about Dass Rebar, a JDASS Corp company in Vaughan, Ontario.',
  content: [
    hero({
      image: '/images/p-facility-pond.jpg', crumbs: [['HOME', '/'], ['ABOUT US']],
      title: 'Expect the', accent: 'extraordinary.',
      sub: 'Raising the bar on quality and service — backed by four decades of JDASS Corp building across the GTA.',
    }),

    // 01 — our promise
    section(
      { bgColor: '#F4F5F7', padding: { d: { t: 104, b: 104 } } },
      row(
        { gap: WIDE },
        col(
          { span: SP6, gap: gap(22) },
          eyebrow('01 — OUR PROMISE'),
          h2('The quality and service you deserve'),
          body('<p>JDass Corp was founded on the principle of delivering customers the quality and service they deserve. At Dass Rebar we uphold that commitment with a pledge of exceptional customer service.</p><p>Our sales and engineering team brings over 40 years of collective experience designing and engineering steel rebar systems, and we’re set up to take projects of any scale from initial estimate, planning and scheduling through fabrication to on-time delivery.</p>'),
        ),
        col(
          { span: SP6, gap: gap(20), ...STACKED },
          w.image({
            src: '/images/p-facility.jpg', alt: 'Dass Rebar facility exterior', ratio: '4 / 3', fit: 'cover', imgWidth: '100%', imgRadius: box(15),
            borderStyle: 'solid', borderWidth: box(1), borderColor: '#B4BCC5', radius: box(16),
          }),
          row(
            { gap: gap(0), borderStyle: 'solid', borderWidth: { t: 1 }, borderColor: RULE },
            col(
              { span: { d: 6, t: 6, m: 6 }, gap: gap(4), padding: { d: px(18, 16, 0, 0) } },
              w.counter({ number: '40', suffix: '+', label: 'Years of collective sales & engineering experience', numSize: '44px', numLineHeight: LH_M, lblSize: '14px', lblColor: '#4A5568' }),
            ),
            col(
              { span: { d: 6, t: 6, m: 6 }, gap: gap(4), padding: { d: px(18, 0, 0, 16) }, borderStyle: 'solid', borderWidth: { l: 1 }, borderColor: '#B4BCC5' },
              w.counter({ number: '1986', suffix: '', label: 'JDASS Corp founded by Jay Dass', numSize: '44px', numLineHeight: LH_M, lblSize: '14px', lblColor: '#4A5568' }),
            ),
          ),
        ),
      ),
    ),

    // 02 — who we serve
    band(
      { bg: '#FFFFFF', top: true, gap: 44 },
      row(
        { rowAlign: 'end', gap: gap(24) },
        col({ span: { d: 7, t: 12, m: 12 }, gap: gap(14) }, eyebrow('02 — WHO WE SERVE'), h2('Becoming Canada’s premier rebar supplier')),
        col({ span: { d: 1, t: 12, m: 12 }, hideOn: ['t', 'm'] }),
        col({ span: { d: 4, t: 12, m: 12 } }, w.text({ html: '<p>State-of-the-art fabrication equipment for precise, accurate bending and shearing — built for four core sectors.</p>', size: '16px', lineHeight: 1.6, color: '#3A4658' })),
      ),
      row({ gap: gap(0), borderStyle: 'solid', borderWidth: { t: 1 }, borderColor: RULE }, SERVE.map(serveCol)),
    ),

    // 03 — our story
    band(
      { bg: NAVY, dark: true, gap: 48 },
      head('03 — OUR STORY', 'From one store to a steel group', { dark: true }),
      row({ gap: gap(0), borderStyle: 'solid', borderWidth: { t: 2 }, borderColor: TAN }, STORY.map(storyCol)),
    ),

    // 04 — leadership
    band(
      { bg: '#F4F5F7' },
      row(
        { gap: WIDE },
        col({ span: { d: 5, t: 12, m: 12 }, gap: gap(14) }, eyebrow('04 — LEADERSHIP'), h2('Family-led since day one')),
        col({ span: { d: 7, t: 12, m: 12 }, ...STACKED }, row({ gap: gap(24) }, PEOPLE.map(person))),
      ),
    ),

    // 05 — expertise you can trust
    band(
      { bg: '#FFFFFF', top: true },
      row(
        { gap: WIDE },
        col({ span: SP6, gap: gap(14) }, eyebrow('05 — EXPERTISE YOU CAN TRUST'), h2('Delivered safely, on time, where you need it')),
        col(
          { span: SP6, gap: gap(0), borderStyle: 'solid', borderWidth: { t: 1 }, borderColor: RULE, margin: { m: { t: 32 } } },
          ibox('truck', 'An extensive delivery fleet', 'Seamless delivery for orders of any size, safely and on schedule, exactly where you need them.'),
          ibox('user', 'People who know the product', 'Knowledgeable staff offering expert advice on our product range, supporting you every step of the way.'),
        ),
      ),
    ),

    // 06 — the JDASS family
    band(
      { bg: '#F4F5F7', top: true, anchor: 'affiliates', pad: 104, gap: 40 },
      head('06 — OUR DIVERSE BRANDS', 'The JDASS family'),
      row({ gap: { d: '1px' }, bgColor: '#B4BCC5', borderStyle: 'solid', borderWidth: box(1), borderColor: '#B4BCC5' }, FAMILY.map(tile)),
    ),

    ctaBand(),
  ],
};
