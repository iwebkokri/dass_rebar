// Home page as builder content. Source of the old look: components/HomeView.tsx.
// Header / footer come from the active templates (db/templates/header.mjs, footer.mjs); the CTA band is the saved section 'CTA band'.
import { section, row, col, w, stack } from '../dsl.mjs';

const INTER = 'var(--font-inter), "Helvetica Neue", Arial, sans-serif';
const NAVY = '#182845';
const BROWN = '#7F5F47';
const DBROWN = '#6B4F3A';
const TAN = '#B0A18E';
const BODY = '#3A4658';
const GREY = '#4A5568';
const LIGHT = '#F4F5F7';
const WHITE = '#FFFFFF';
const LH = 1.37; // Manrope "normal" line height
const sides = (n) => ({ t: n, r: n, b: n, l: n });
const padY = (n) => ({ d: { t: n, b: n } });

// ---- small building blocks ----------------------------------------------------------------------------------------
const eyebrow = (text, color = DBROWN) => w.heading({ text, tag: 'span', font: INTER, size: '13px', weight: '700', spacing: '0.14em', lineHeight: 1.2, color });
const h2 = (text, extra = {}) => w.heading({ text, tag: 'h2', size: 'clamp(34px, 3.8vw, 52px)', lineHeight: 1.08, weight: '800', spacing: '-0.02em', ...extra });
const lead = (text, extra = {}) => w.text({ html: `<p>${text}</p>`, size: '17px', lineHeight: 1.65, color: BODY, ...extra });
const h3 = (text, size, extra = {}) => w.heading({ text, tag: 'h3', size, weight: '800', spacing: '0px', lineHeight: LH, ...extra });

/** Section header row: eyebrow + h2 (+ lead) on the left, an optional link/button on the right (bottom aligned). */
const head = ({ kicker, title, text, action, maxWidth = '720px' }) =>
  row({ gap: { d: '24px' }, rowAlign: 'end' },
    col({ span: { d: action ? 8 : 12, t: 12, m: 12 }, gap: '14px', maxWidth },
      ...[eyebrow(kicker), h2(title), text && lead(text)].filter(Boolean),
    ),
    ...(action ? [col({ span: { d: 4, t: 12, m: 12 } }, action)] : []),
  );

const textLink = (label, url) => w.button({ label, url, variant: 'link', btnPadding: { t: 12, r: 0, b: 12, l: 0 }, textAlign: { d: 'right', m: 'left' } });
const pillButton = (label, url, bg = NAVY) => w.button({ label, url, variant: 'solid', btnBg: bg, btnColor: WHITE, textAlign: { d: 'right', m: 'left' } });

const band = (bg, ...rows) => section({ bgColor: bg, padding: padY(104) }, ...rows);

// ==== 1. hero slider ==================================================================================================
const hero = section(
  { contentMode: 'full', anchor: 'top' },
  stack({},
    w['hero-slider']({
      autoplay: true, interval: 6500,
      slides: [
        { image: '/images/p-worker.jpg', tab: 'Rebar specialists', eyebrow: 'REINFORCING STEEL · VAUGHAN, ONTARIO', heading: 'Ontario’s rebar fabrication specialists', text: 'Estimating, detailing, cutting, bending and delivery — handled in-house by one accountable team.', btn1Label: 'Discover our expertise', btn1Url: '#expertise', btn2Label: 'Request a quote', btn2Url: '/quote' },
        { image: '/images/p-facility.jpg', tab: 'MTO approved', eyebrow: 'MINISTRY OF TRANSPORTATION OF ONTARIO', heading: 'Approved for Ontario’s highways and bridges', text: 'Listed on MTO’s Designated Sources for Materials for provincial highways, bridges and public infrastructure.', btn1Label: 'Quote an MTO project', btn1Url: '/quote' },
        { image: '/images/p-epoxy.jpg', tab: 'Products in stock', eyebrow: 'PRODUCTS IN STOCK', heading: 'Black, epoxy, GFRP and welded mesh', text: 'Grade 400W and 500W rebar from 10M to 35M, with 45M and 55M on request — one order, one truck.', btn1Label: 'View products & bar data', btn1Url: '/products' },
        { image: '/images/p-detailing.jpg', tab: 'Estimating & detailing', eyebrow: 'ESTIMATING & DETAILING', heading: 'Send drawings. Get a priced bar list.', text: 'Our estimators and detailers turn structural drawings into accurate takeoffs and placing drawings.', btn1Label: 'Upload your drawings', btn1Url: '/quote' },
      ],
    }),
  ),
);

// ==== 2. services strip (overlaps the hero) + expertise ================================================================
const serviceCard = (icon, title, text, url) =>
  col({ span: { d: 2, t: 4, m: 12 }, bgColor: WHITE, radius: sides(16), padding: sides(24), shadow: '0 12px 32px rgba(24,40,69,0.12)' },
    w['icon-box']({ icon, title, text, link: url, layout: 'top', iconSize: '32px', iconColor: BROWN, ibGap: '12px', ibTextGap: '12px' }),
  );

const expertise = row({ anchor: 'expertise', margin: { d: { t: 96 } }, gap: { d: '64px', m: '16px' }, rowAlign: 'center' },
  // photo with the "Proudly Canadian" badge on top of it
  col({ span: { d: 6, t: 12, m: 12 }, gap: '0px' },
    w.image({ src: '/images/p-coupler.jpg', alt: 'Reinforcing bars and mechanical couplers in the Dass Rebar yard', ratio: '5 / 4', fit: 'cover', imgWidth: '100%', imgRadius: sides(24) }),
    row({ margin: { d: { t: -108, b: 24 } }, padding: { d: { l: 24 } } },
      col({ maxWidth: '280px', direction: 'row', colAlign: 'center', gap: '14px', bgColor: WHITE, radius: sides(16), padding: { t: 14, r: 18, b: 14, l: 14 }, shadow: '0 24px 60px rgba(24,40,69,0.22)' },
        w.image({ src: '/images/badge-canadian.png', alt: 'Proudly Canadian', imgWidth: '56px' }),
        w.text({ html: '<p><strong>Proudly Canadian</strong><br>MTO DSM-listed supplier</p>', size: '14px', lineHeight: 1.35, color: NAVY }),
      ),
    ),
  ),
  // copy
  col({ span: { d: 6, t: 12, m: 12 }, gap: '22px', margin: { m: { t: 48 } } },
    eyebrow('OUR EXPERTISE'),
    h2('Passionate about reinforcing steel'),
    w.text({ html: '<p>Dass Rebar supplies and fabricates reinforcing steel for projects of every scale across the GTA and Ontario. Our sales and engineering team brings over 40 years of collective experience, backed by JDASS Corp — building in the GTA since 1986.</p>', size: '17px', lineHeight: 1.7, color: BODY }),
    w.list({ items: [{ text: 'Residential mid- & high-rise' }, { text: 'ICI construction' }, { text: 'Civil & infrastructure' }, { text: 'Precast producers' }], marker: 'check', listCols: { d: 2 }, listGap: '12px' }),
    w.button({ label: 'Learn more about us', url: '/about', variant: 'solid', btnBg: NAVY, btnColor: WHITE, margin: { d: { t: 8 } } }),
  ),
);

const servicesAndExpertise = section(
  { bgColor: LIGHT, padding: { d: { t: 0, b: 88 } } },
  row({ gap: { d: '12px' }, margin: { d: { t: -48 } } },
    serviceCard('fabrication', 'Fabrication', 'Automated cutting and bending to schedule.', '/services#fabrication'),
    serviceCard('calculator', 'Estimating', 'Precise cost assessments from your drawings.', '/services#estimating'),
    serviceCard('pencil', 'Detailing', 'Accurate placing drawings and bar lists.', '/services#detailing'),
    serviceCard('calendar', 'Project management', 'One contact from planning to install.', '/services#management'),
    serviceCard('truck', 'Delivery', 'Our own fleet, sequenced to your pours.', '/services#delivery'),
    serviceCard('grid', 'Assembly', 'Ready-to-install cages and components.', '/services#assembly'),
  ),
  expertise,
);

// ==== 3. key figures ===================================================================================================
const figure = (number, label, extra = {}) =>
  w.counter({
    number, suffix: '', label, numLineHeight: LH, lblColor: WHITE,
    width: { d: 'calc((100% - 128px) / 5)', t: 'calc((100% - 64px) / 3)', m: '100%' }, ...extra,
  });

const keyFigures = section(
  { bgColor: NAVY, textColor: WHITE, padding: padY(64) },
  row({}, col({ direction: 'row', wrap: true, gap: '32px' },
    figure('40', 'Years of collective sales & engineering experience', { suffix: '+' }),
    figure('8', 'Bar sizes supplied, 10M through 55M'),
    figure('6', 'In-house services, from estimate to delivery'),
    figure('26', 'Featured projects across Ontario'),
    figure('MTO', 'Designated Sources for Materials listed', { numColor: TAN }),
  )),
);

// ==== 4. products ======================================================================================================
const products = band(WHITE,
  head({ kicker: 'PRODUCTS', title: 'Reinforcement in stock and made to order', action: textLink('Full specifications →', '/products') }),
  row({ margin: { d: { t: 44 } } }, col({}, w.products({ kind: 'stocked', layout: 'strip', cols: { d: 3, t: 2, m: 1 }, prodGap: '20px' }))),
  row({ margin: { d: { t: 44 } } }, col({}, w.products({ kind: 'also', alsoLabel: 'Also supplied:' }))),
);

// ==== 5. projects ======================================================================================================
const projects = band(LIGHT,
  head({ kicker: 'OUR PROJECTS', title: 'Discover our projects', text: 'From mid-rise residences to hotels, arenas and industrial builds — reinforced with steel from our Vaughan yard.', action: pillButton('All projects', '/projects') }),
  row({ margin: { d: { t: 44 } } }, col({}, w.projects({ source: 'featured', layout: 'cards', limit: 3, cols: { d: 3, t: 2, m: 1 }, linkUrl: '/projects', projGap: '24px' }))),
  row({ margin: { d: { t: 44 } } }, col({}, w.projects({ source: 'roster', layout: 'chips', chipsLabel: 'Also on our roster:' }))),
);

// ==== 6. sectors =======================================================================================================
const sector = (image, title, text) =>
  col({ span: { d: 3, t: 6, m: 12 }, bgImage: image, bgSize: 'cover', bgPosition: 'center', radius: sides(20), minHeight: { d: '400px', t: '480px', m: '420px' }, justify: 'flex-end', gap: '0px' },
    row({},
      col({ bgGradient: 'linear-gradient(180deg, rgba(24,40,69,0) 0%, rgba(24,40,69,0.92) 100%)', radius: { t: 0, r: 0, b: 20, l: 20 }, padding: { d: { t: 120, r: 24, b: 24, l: 24 } }, gap: '8px' },
        h3(title, '24px', { color: WHITE }),
        w.text({ html: `<p>${text}</p>`, size: '15px', lineHeight: 1.5, color: '#DCDFE3' }),
      ),
    ),
  );

const sectors = band(WHITE,
  head({ kicker: 'SECTORS WE SERVE', title: 'Built for every kind of concrete' }),
  row({ margin: { d: { t: 44 } }, gap: { d: '20px' } },
    sector('/images/haw-2.jpg', 'Residential', 'Mid-rise and high-rise towers, townhomes and seniors’ residences.'),
    sector('/images/uc-3.jpg', 'ICI construction', 'Industrial, commercial and institutional builds — hotels to arenas.'),
    sector('/images/hic-1.jpg', 'Civil & infrastructure', 'MTO-approved steel for highways, bridges and public works.'),
    sector('/images/hic-4.jpg', 'Precast', 'Cut-and-bent bar and mesh supplied to precast producers.'),
  ),
);

// ==== 7. why Dass Rebar ================================================================================================
const why = (num, title, text) =>
  col({ span: { d: 6, t: 6, m: 12 }, bgColor: WHITE, radius: sides(20), padding: sides(28), gap: '12px' },
    w.heading({ text: num, tag: 'span', size: '15px', weight: '800', spacing: '0px', lineHeight: LH, color: DBROWN }),
    h3(title, '20px'),
    w.text({ html: `<p>${text}</p>`, size: '15px', lineHeight: 1.6, color: GREY }),
  );

const whyUs = band(LIGHT,
  row({ gap: { d: '56px', m: '16px' } },
    col({ span: { d: 5, t: 12, m: 12 }, gap: '16px' },
      eyebrow('WHY DASS REBAR'),
      h2('Raising the bar on quality & service'),
      lead('JDass Corp was founded on delivering the quality and service customers deserve. Here’s how we carry that into every order.'),
    ),
    col({ span: { d: 7, t: 12, m: 12 }, margin: { m: { t: 40 } } },
      row({ gap: { d: '16px' } },
        why('01', 'One accountable team', 'Estimating, detailing, fabrication and trucking under one roof — no hand-offs between subcontractors.'),
        why('02', 'Precision equipment', 'State-of-the-art automated bending and shearing for accurate, repeatable bends.'),
        why('03', 'On-time delivery', 'An extensive fleet delivers orders of any size safely, exactly where you need them.'),
        why('04', 'Expert advice', 'A knowledgeable team that helps you order the right product for every requirement.'),
      ),
    ),
  ),
);

// ==== 8. weight calculator =============================================================================================
const calculator = band(WHITE,
  row({ gap: { d: '48px', m: '16px' }, rowAlign: 'start' },
    col({ span: { d: 6, t: 12, m: 12 }, gap: '18px' },
      eyebrow('TOOLS'),
      h2('Rebar weight calculator'),
      lead('A quick tonnage check using nominal CSA masses. For a priced takeoff, send us your drawings.'),
      w['bar-table']({ variant: 'compact' }),
    ),
    col({ span: { d: 6, t: 12, m: 12 }, margin: { m: { t: 32 } } },
      w['weight-calculator']({ variant: 'compact', ctaLabel: 'Open full calculator & quote', ctaUrl: '/calculator' }),
    ),
  ),
);

// ==== 9. insights ======================================================================================================
const insights = band(LIGHT,
  head({ kicker: 'INSIGHTS', title: 'Guides for estimators & buyers', action: textLink('All articles →', '/insights'), maxWidth: '100%' }),
  row({ margin: { d: { t: 40 } } }, col({}, w.insights({ layout: 'grid', limit: 3, cols: { d: 3, t: 2, m: 1 }, postGap: '24px' }))),
);

// ==== 10. CTA band (saved section) =====================================================================================
const cta = section({ contentMode: 'full' }, stack({}, w.template({ templateId: 'cta-band' })));

export default {
  path: '',
  title: 'Home',
  // same text the old home route used (app/layout.tsx default metadata)
  seoTitle: 'Dass Rebar | MTO-Approved Rebar Supplier & Fabricator in Ontario',
  seoDescription: 'Dass Rebar supplies and fabricates reinforcing steel across the GTA and Ontario — estimating, detailing, cutting, bending and delivery. MTO Designated Source for Materials.',
  content: [hero, servicesAndExpertise, keyFigures, products, projects, sectors, whyUs, calculator, insights, cta],
};
