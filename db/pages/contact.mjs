// Contact — re-created from components/ContactView.tsx as builder content.
import { section, row, col, w } from '../dsl.mjs';

const crumb = (current) => w.text({
  html: `<p><a href="/">HOME</a> / ${current}</p>`,
  color: '#F4F5F7', size: '13px', lineHeight: 1.21, spacing: '0.08em', linkColor: '#DCDFE3',
});

// label (12px, tracked) used in the contact cells and hours boxes
const label = (text, color) => w.text({ html: `<p>${text}</p>`, size: '12px', lineHeight: 1.21, spacing: '0.1em', color });
const value = (html) => w.text({ html: `<p>${html}</p>`, size: '20px', weight: '700', lineHeight: 1.4, color: '#F4F5F7', linkColor: '#F4F5F7', linkDecoration: 'none' });

// one cell of the address / phone / email strip in the hero
const contactCell = (pad, borderLeft, icon, title, html) => col(
  {
    span: { d: 4, t: 4, m: 12 }, gap: { d: '10px' }, padding: { d: pad },
    ...(borderLeft ? { borderStyle: 'solid', borderWidth: { l: 1 }, borderColor: '#2C3F63' } : {}),
  },
  w.icon({ icon, iconSize: { d: '28px' }, iconColor: '#DCDFE3' }),
  label(title, '#919CA4'),
  value(html),
);

export default {
  path: 'contact',
  title: 'Contact',
  seoTitle: 'Contact',
  seoDescription: 'Contact Dass Rebar at 370 New Enterprise Way, Woodbridge, ON — (905) 813-3014.',
  // Search + AI fields: the direct answer is what answer engines and AI assistants quote (40-60 words); see docs/SEO-AND-TRACKING.md
  focusKeyword: 'contact Dass Rebar',
  answerSummary: 'Contact Dass Rebar at 370 New Enterprise Way, Woodbridge, Ontario, or call (905) 813-3014. Use the contact form for general questions and the quote request for pricing on cut-and-bent rebar, mesh and other reinforcing steel, attaching drawings if you have them. Messages sent through the website go straight to our team.',
  content: [
    // ---- hero: heading + address / phone / email strip ----
    section(
      { bgColor: '#182845', textColor: '#F4F5F7', padding: { d: { t: 72, b: 0 } } },
      row({},
        col(
          { gap: { d: '22px' } },
          crumb('CONTACT US'),
          w.heading({ text: 'Let’s talk', tag: 'h1', size: 'clamp(56px, 7vw, 112px)', weight: '800', lineHeight: 0.9, spacing: '-0.02em' }),
          w.heading({ text: 'steel.', tag: 'div', size: 'clamp(56px, 7vw, 112px)', weight: '800', lineHeight: 0.9, spacing: '-0.02em', color: '#B0A18E', margin: { d: { t: -22 } } }),
          w.text({ html: '<p>Get in touch with us today — for quotes, estimating or delivery questions.</p>', size: '19px', lineHeight: 1.55, color: '#DCDFE3', maxWidth: { d: '620px' } }),
        ),
      ),
      row(
        { gap: { d: '0px' }, margin: { d: { t: 56 } }, borderStyle: 'solid', borderWidth: { t: 1 }, borderColor: '#2C3F63' },
        contactCell({ t: 28, r: 24, b: 40, l: 0 }, false, 'map-pin', 'ADDRESS', '370 New Enterprise Way<br>Woodbridge, ON L4H 0S8'),
        contactCell({ t: 28, r: 24, b: 40, l: 24 }, true, 'phone', 'CALL US', '<a href="tel:9058133014">(905) 813-3014</a>'),
        contactCell({ t: 28, r: 0, b: 40, l: 24 }, true, 'mail', 'EMAIL', '<a href="mailto:sales@dassrebar.com">sales@dassrebar.com</a>'),
      ),
    ),
    // ---- form + map / hours ----
    section(
      { bgColor: '#F4F5F7', padding: { d: { t: 96, b: 96 }, m: { t: 56, b: 56 } } },
      row(
        { gap: { d: '32px', m: '16px' } },
        col({ span: { d: 7, t: 12, m: 12 } }, w['contact-form']({})),
        col(
          { span: { d: 5, t: 12, m: 12 }, gap: { d: '24px' }, margin: { m: { t: 16 } } },
          w.map({ query: '370 New Enterprise Way, Woodbridge, ON L4H 0S8', zoom: 15, mapHeight: { d: '361px', m: '260px' }, borderStyle: 'solid', borderWidth: { t: 1, r: 1, b: 1, l: 1 }, borderColor: '#B4BCC5' }),
          row({},
            col(
              { gap: { d: '10px' }, bgColor: '#182845', textColor: '#F4F5F7', padding: { d: { t: 28, r: 28, b: 28, l: 28 } } },
              label('HOLIDAY HOURS · OFFICE CLOSED', '#919CA4'),
              w.text({ html: '<p>Thursday, December 25<br>Friday, December 26<br>Thursday, January 1</p>', size: '16px', lineHeight: 1.7, color: '#F4F5F7' }),
            ),
          ),
          row({},
            col(
              { gap: { d: '8px' }, borderStyle: 'solid', borderWidth: { t: 1, r: 1, b: 1, l: 1 }, borderColor: '#B4BCC5', padding: { d: { t: 28, r: 28, b: 28, l: 28 } } },
              label('REGULAR HOURS', '#4A5568'),
              w.text({ html: '<p>[OFFICE HOURS]</p>', size: '16px', lineHeight: 1.21, color: '#23334F' }),
            ),
          ),
        ),
      ),
    ),
  ],
};
