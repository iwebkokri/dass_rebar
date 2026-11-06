// Global footer (kind 'footer'): JDASS family logo strip + the 4-column navy footer. Mirrors components/SiteFooter.tsx.
// (The "Talk with a rebar expert" band is NOT here — it is the saved section 'CTA band' that pages include; see sections.mjs.)
// The two link columns are the `footer-services` / `footer-company` menus (db/menus/primary.mjs) rendered as a vertical list.
import { section, row, col, w } from '../dsl.mjs';

const INTER = 'var(--font-inter), "Helvetica Neue", Arial, sans-serif';
const TAN = '#B0A18E';
const NONE = { t: 0, r: 0, b: 0, l: 0 };

/** Small-caps style column label ("SERVICES"). */
const label = (text) => w.heading({ text, tag: 'span', font: INTER, size: '12px', weight: '700', spacing: '0.12em', lineHeight: 1.25, color: TAN });
/** Plain 16px line (phone, email). */
const line = (text, link, extra = {}) => w.heading({ text, tag: 'span', link, font: INTER, size: '16px', weight: '400', spacing: '0px', lineHeight: 1.2, color: '#FFFFFF', ...extra });
const small = (text, extra = {}) => w.heading({ text, tag: 'span', font: INTER, size: '13px', weight: '400', spacing: '0px', lineHeight: 1.25, ...extra });

const family = (src, alt, link) => w.logo({ src, alt, link, logoHeight: '34px' });

// ---- "Part of the JDASS family" strip -----------------------------------------------------------------------------
const familyStrip = section(
  { borderStyle: 'solid', borderWidth: { ...NONE, t: 1 }, borderColor: '#E3E6EA', padding: { d: { t: 32, b: 32 } } },
  row({ gap: { d: '24px' }, rowAlign: 'center' },
    col({ span: { d: 3, t: 12, m: 12 } }, small('Part of the JDASS family', { weight: '600', color: '#4A5568' })),
    col({ span: { d: 9, t: 12, m: 12 }, direction: 'row', wrap: true, colAlign: 'center', justify: { d: 'flex-end', t: 'flex-start' }, gap: { d: '48px', t: '32px', m: '24px' } },
      family('/images/logo-jdass.png', 'JDASS Corp', 'https://dass.ca/'),
      family('/images/logo-metal.png', 'Dass Metal Products', 'https://dassmetal.com/'),
      family('/images/logo-dss.png', 'Dass Steel Service Centre', 'https://dasssteel.com/'),
      family('/images/logo-qsm.png', 'Quick Scrap Metal', 'https://quickscrapmetal.com/'),
    ),
  ),
);

// ---- navy footer --------------------------------------------------------------------------------------------------
const quarter = { d: 3, t: 6, m: 12 };

const mainFooter = section(
  { tag: 'footer', bgColor: '#182845', textColor: '#DCDFE3', padding: { d: { t: 72, b: 32 } } },
  row({ gap: { d: '40px', m: '16px' } },
    // 1 — logo, address, phone, email
    col({ span: quarter, gap: '14px' },
      w.logo({ src: '/images/logo-rebar-white.png', alt: 'Dass Rebar', link: '/', logoHeight: '42px' }),
      w.text({ html: '<p>370 New Enterprise Way<br>Woodbridge, ON L4H 0S8</p>', size: '15px', lineHeight: 1.6 }),
      line('(905) 813-3014', 'tel:9058133014', { weight: '600' }),
      line('sales@dassrebar.com', 'mailto:sales@dassrebar.com'),
    ),
    // 2 — services menu
    col({ span: quarter, gap: '10px', margin: { m: { t: 24 } } },
      label('SERVICES'),
      w['nav-menu']({ menu: 'footer-services', layout: 'list', liColor: '#FFFFFF', liSize: '16px' }),
    ),
    // 3 — company menu
    col({ span: quarter, gap: '10px', margin: { m: { t: 24 } } },
      label('COMPANY'),
      w['nav-menu']({ menu: 'footer-company', layout: 'list', liColor: '#FFFFFF', liSize: '16px' }),
    ),
    // 4 — newsletter + social
    col({ span: quarter, gap: '14px', margin: { m: { t: 24 } } },
      label('STAY IN TOUCH'),
      w.text({ html: '<p>Project news and practical rebar guides, straight to your inbox.</p>', size: '15px', lineHeight: 1.55 }),
      w.newsletter({ placeholder: 'Email address', buttonLabel: 'Subscribe', successText: 'Thanks — you’re subscribed.', fieldBg: '#1F3152', fieldColor: '#FFFFFF', fieldBorder: '#919CA4', btnBg: '#7F5F47', btnColor: '#FFFFFF' }),
      w['social-icons']({
        items: [
          { network: 'linkedin', url: 'https://ca.linkedin.com/company/dass-rebar-ca' },
          { network: 'instagram', url: 'https://www.instagram.com/dassrebar/' },
          { network: 'facebook', url: 'https://www.facebook.com/dassrebar/' },
        ],
        btnSize: '44px', socColor: '#FFFFFF', socBorder: '#44567A', socGap: '8px', margin: { d: { t: 6 } },
      }),
    ),
  ),
  // copyright line
  row({ gap: { d: '12px' }, margin: { d: { t: 48 } }, padding: { d: { t: 24 } }, borderStyle: 'solid', borderWidth: { ...NONE, t: 1 }, borderColor: '#2C3F63' },
    col({ span: { d: 6, t: 12, m: 12 } }, small('© {year} Dass Rebar · A JDASS Corp company · All rights reserved', { color: '#919CA4' })),
    col({ span: { d: 6, t: 12, m: 12 }, textAlign: { d: 'right', t: 'left' } }, small('Holiday closures: Dec 25 · Dec 26 · Jan 1', { color: '#919CA4' })),
  ),
);

export default [{ kind: 'footer', name: 'Main footer', content: [familyStrip, mainFooter] }];
