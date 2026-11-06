// Insights index — re-created from components/InsightsView.tsx as builder content.
import { band, w } from '../dsl.mjs';

const crumb = (current) => w.text({
  html: `<p><a href="/">HOME</a> / ${current}</p>`,
  color: '#F4F5F7', size: '13px', lineHeight: 1.21, spacing: '0.08em', linkColor: '#DCDFE3',
});

export default {
  path: 'insights',
  title: 'Insights',
  seoTitle: 'Insights',
  seoDescription: 'Practical guides on rebar estimating, detailing, procurement and quality control in Ontario.',
  content: [
    // ---- page hero ----
    band(
      { bgColor: '#182845', textColor: '#F4F5F7', padding: { d: { t: 72, b: 88 } } },
      { gap: { d: '22px' } },
      crumb('BLOG'),
      w.heading({ text: 'Field notes', tag: 'h1', size: 'clamp(56px, 7vw, 112px)', weight: '800', lineHeight: 0.9, spacing: '-0.02em' }),
      w.text({ html: '<p>Practical guides on estimating, detailing, procurement and quality control for Ontario reinforcing-steel projects.</p>', size: '19px', lineHeight: 1.55, color: '#DCDFE3', maxWidth: { d: '620px' } }),
    ),
    // ---- featured post + grid ----
    band(
      { bgColor: '#F4F5F7', padding: { d: { t: 72, b: 104 }, m: { t: 48, b: 72 } } },
      {},
      w.insights({ layout: 'featured', limit: 0, cols: { d: 3, t: 2, m: 1 }, featGap: '72px' }),
    ),
    // ---- shared call-to-action band ----
    band({ contentMode: 'full' }, {}, w.template({ templateId: 'cta-band' })),
  ],
};
