// Request a quote — re-created from components/QuoteView.tsx as builder content.
import { section, row, col, w } from '../dsl.mjs';

const R20 = { t: 20, r: 20, b: 20, l: 20 };
const P28 = { d: { t: 28, r: 28, b: 28, l: 28 } };

export default {
  path: 'quote',
  title: 'Request a Quote',
  seoTitle: 'Request a Quote',
  seoDescription: 'Request a rebar quote in four quick steps — attach drawings or list the material you need.',
  // Search + AI fields: the direct answer is what answer engines and AI assistants quote (40-60 words); see docs/SEO-AND-TRACKING.md
  focusKeyword: 'rebar quote Ontario',
  answerSummary: 'Request a rebar quote from Dass Rebar in four short steps: tell us about your project, list the material you need or attach your drawings, add your contact details, and submit. Our team reviews the request and replies with pricing for cut-and-bent rebar, mesh and other reinforcing steel.',
  content: [
    // ---- hero (photo + navy gradient) ----
    section(
      {
        bgColor: '#182845', textColor: '#FFFFFF', bgImage: '/images/p-takeoff.jpg', bgSize: 'cover', bgPosition: 'center',
        overlay: 'rgba(24,40,69,0.8)', overlayGradient: 'linear-gradient(90deg, rgba(24,40,69,0.95) 0%, rgba(24,40,69,0.8) 55%, rgba(24,40,69,0.45) 100%)',
        padding: { d: { t: 64, b: 120 } },
      },
      row({},
        col(
          { gap: { d: '16px' } },
          w.text({ html: '<p><a href="/">Home</a> / Request a quote</p>', size: '14px', lineHeight: 1.21, color: '#FFFFFF', linkColor: '#DCDFE3' }),
          w.heading({ text: 'Request a quote', tag: 'h1', size: 'clamp(40px, 5vw, 68px)', weight: '800', lineHeight: 1.04, spacing: '-0.025em' }),
          w.text({ html: '<p>Four quick steps. Attach your drawings or list the material you need, and our estimators will get back to you.</p>', size: '18px', lineHeight: 1.6, color: '#DCDFE3', maxWidth: { d: '620px' } }),
        ),
      ),
    ),
    // ---- wizard card (overlaps the hero by 72px; the grey band starts below the overlap) + side cards ----
    section(
      { margin: { d: { t: -72 } }, bgGradient: 'linear-gradient(180deg, transparent 72px, #F4F5F7 72px)', padding: { d: { t: 0, b: 104 }, m: { t: 0, b: 64 } } },
      row(
        { gap: { d: '24px' }, rowAlign: 'start' },
        col({ span: { d: 8, t: 12, m: 12 } }, w['quote-wizard']({})),
        col(
          { span: { d: 4, t: 12, m: 12 }, gap: { d: '16px' }, padding: { d: { t: 112 }, t: { t: 40 }, m: { t: 40 } } },
          row({},
            col(
              { gap: { d: '12px' }, bgColor: '#FFFFFF', textColor: '#182845', radius: R20, padding: P28 },
              w.text({ html: '<p>PREFER TO TALK?</p>', size: '12px', weight: '700', lineHeight: 1.21, spacing: '0.12em', color: '#6B4F3A' }),
              w.heading({ text: '(905) 813-3014', tag: 'div', link: 'tel:9058133014', size: '28px', weight: '800', lineHeight: 1.37, spacing: '0px' }),
              w.text({ html: '<p><a href="mailto:sales@dassrebar.com">sales@dassrebar.com</a></p>', size: '16px', weight: '600', lineHeight: 1.21, linkColor: '#182845' }),
            ),
          ),
          row({},
            col(
              { gap: { d: '14px' }, bgColor: '#182845', textColor: '#FFFFFF', radius: R20, padding: P28 },
              w.heading({ text: 'What happens next', tag: 'div', size: '18px', weight: '800', lineHeight: 1.37, spacing: '0px' }),
              w.text({
                html: '<ol><li>An estimator reviews your drawings or material list.</li><li>We confirm grades, sizes, coatings and schedule.</li><li>You receive a detailed quote and delivery plan.</li></ol>',
                size: '15px', lineHeight: 1.5, color: '#DCDFE3',
                customCss: 'selector .dr-richtext ol { padding-left: 20px; }\nselector .dr-richtext li + li { margin-top: 10px; }',
              }),
            ),
          ),
        ),
      ),
    ),
  ],
};
