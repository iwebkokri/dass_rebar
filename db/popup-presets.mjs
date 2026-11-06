// Starter popups. Used by Admin → Popups → "New popup" and by the example popups seeded (switched OFF) by db/templates/popups.mjs.
// `content` is builder content (sections > rows > columns > widgets) written with the DSL; `settings` is validated by
// normalisePopupSettings() before anything is stored.
import { section, row, col, w } from './dsl.mjs';

const NAVY = '#182845';
const BROWN = '#7F5F47';
const INK = '#3A4658';
const INTER = 'var(--font-inter), "Helvetica Neue", Arial, sans-serif';
const MANROPE = 'var(--font-manrope), sans-serif';
const pad = (t, r = t, b = t, l = r) => ({ d: { t, r, b, l }, m: { t: Math.round(t * 0.75), r: Math.round(r * 0.6), b: Math.round(b * 0.75), l: Math.round(l * 0.6) } });

const eyebrow = (text) => w.heading({ text, tag: 'span', font: INTER, size: '12px', weight: '700', spacing: '0.12em', lineHeight: 1.25, color: '#6B4F3A' });
const title = (text, size = '30px') => w.heading({ text, tag: 'h2', font: MANROPE, size, weight: '800', lineHeight: 1.12, spacing: '-0.02em', color: NAVY });
const body = (html) => w.text({ html: `<p>${html}</p>`, color: INK, size: '16px', lineHeight: 1.55 });

const card = (...children) => section({ padding: pad(40, 40, 36), contentMode: 'full' }, row({}, col({ gap: '14px' }, ...children)));

/** presets[id] = { label, description, name, settings, content(ctx) } — ctx.formId is the id of the form a preset needs (quote). */
export const POPUP_PRESETS = {
  newsletter: {
    label: 'Newsletter signup',
    description: 'A friendly modal with one email field. Appears after 8 seconds.',
    name: 'Newsletter signup',
    settings: { type: 'modal', width: 520, delay: 8, freq: 'days', days: 14, neverAfterSubmit: true, closeAfterSubmit: 4, animation: 'zoom' },
    content: () => [
      card(
        eyebrow('STAY IN THE LOOP'),
        title('Rebar news, straight to your inbox'),
        body('Price updates, stock alerts and project stories — a few emails a month, no spam. Unsubscribe any time.'),
        // light field colours: the widget's default (dark) field is made for the footer, not for a white popup
        w.newsletter({ placeholder: 'you@company.com', buttonLabel: 'Subscribe', successText: 'Thanks — you’re on the list.', btnBg: BROWN, btnColor: '#FFFFFF', fieldBg: '#F4F5F7', fieldColor: NAVY, fieldBorder: '#C9CFD6' }),
      ),
    ],
  },

  quote: {
    label: 'Get a quote',
    description: 'A modal with a quote-request form (created for you). Opens from a button or link.',
    name: 'Get a quote',
    needsForm: 'quote',
    settings: { type: 'modal', width: 640, delay: null, scroll: null, freq: 'always', neverAfterSubmit: false, closeAfterSubmit: 0, animation: 'zoom', maxHeight: 92 },
    content: ({ formId }) => [
      card(
        eyebrow('FREE ESTIMATE'),
        title('Tell us about your project'),
        body('Our estimating team replies within one business day.'),
        w.form({ formId: String(formId || ''), btnBg: BROWN, btnColor: '#FFFFFF' }),
      ),
    ],
  },

  announcement: {
    label: 'Announcement bar',
    description: 'A slim bar across the top of every page with one line and a button.',
    name: 'Announcement bar',
    settings: { type: 'bar-top', width: 100, widthUnit: '%', radius: 0, shadow: 'soft', bg: NAVY, delay: 1, freq: 'days', days: 3, closePos: 'inside', closeStyle: 'icon', animation: 'slide', overlayOpacity: 0 },
    content: () => [
      section({ padding: { d: { t: 12, r: 56, b: 12, l: 24 }, m: { t: 12, r: 44, b: 12, l: 14 } }, contentMode: 'full' },
        row({ rowAlign: 'center', gap: { d: '16px' } },
          col({ span: { d: 9, t: 12, m: 12 } }, w.text({ html: '<p><strong>Holiday hours:</strong> we close Dec 24 – Jan 1. Order by Dec 20 for delivery before the break.</p>', color: '#FFFFFF', size: '15px', lineHeight: 1.4 })),
          col({ span: { d: 3, t: 12, m: 12 } }, w.button({ label: 'See hours', url: '/contact', variant: 'outline', size: 'sm', btnColor: '#FFFFFF', btnBorder: '#FFFFFF' })),
        )),
    ],
  },

  exit: {
    label: 'Exit-intent offer',
    description: 'Appears when a desktop visitor moves the mouse to leave the page.',
    name: 'Exit-intent offer',
    settings: { type: 'modal', width: 560, delay: null, exit: true, devices: { d: true, t: false, m: false }, freq: 'days', days: 30, neverAfterSubmit: true, animation: 'fade' },
    content: () => [
      card(
        eyebrow('BEFORE YOU GO'),
        title('Need a price on your next pour?'),
        body('Send us your drawings or bar list and we’ll come back with a detailed estimate — usually within one business day.'),
        w.button({ label: 'Request a quote', url: '/quote', variant: 'solid', size: 'lg', btnBg: BROWN, btnColor: '#FFFFFF' }),
      ),
    ],
  },

  blank: {
    label: 'Blank',
    description: 'Start from an empty popup and build it in the page builder.',
    name: 'New popup',
    settings: {},
    content: () => [],
  },
};

export const POPUP_PRESET_ORDER = ['newsletter', 'quote', 'announcement', 'exit', 'blank'];
