// Rebar weight calculator — re-created from components/CalculatorView.tsx as builder content.
import { band, section, row, col, w } from '../dsl.mjs';

const crumb = (current) => w.text({
  html: `<p><a href="/">HOME</a> / ${current}</p>`,
  color: '#F4F5F7', size: '13px', lineHeight: 1.21, spacing: '0.08em', linkColor: '#DCDFE3',
});

// one cell of the "nominal mass" grid
const cell = (size, mass) => col(
  { span: { d: 4, t: 4, m: 4 }, bgColor: '#F3F4F6', padding: { d: { t: 22, r: 22, b: 22, l: 22 } }, gap: { d: '4px' } },
  w.heading({ text: size, tag: 'div', size: '26px', weight: '800', lineHeight: 1.37, spacing: '-0.02em' }),
  w.text({ html: `<p>${mass}</p>`, size: '13px', lineHeight: 1.21, color: '#3A4658' }),
);

export default {
  path: 'calculator',
  title: 'Rebar Calculator',
  seoTitle: 'Rebar Weight Calculator',
  seoDescription: 'Calculate rebar mass by bar size, length and quantity using nominal CSA masses.',
  // Search + AI fields: the direct answer is what answer engines and AI assistants quote (40-60 words); see docs/SEO-AND-TRACKING.md
  focusKeyword: 'rebar weight calculator',
  answerSummary: 'The Dass Rebar calculator estimates reinforcing steel weight from bar size, length and quantity, using nominal CSA masses per metre. Enter the bar size, the length of each bar and how many bars you need to see the total mass in kilograms, then send the calculation to our team as part of a quote request.',
  content: [
    // ---- page hero ----
    band(
      { bgColor: '#182845', textColor: '#F4F5F7', padding: { d: { t: 72, b: 64 } } },
      { gap: { d: '22px' } },
      crumb('CALCULATOR'),
      w.heading({ text: 'Rebar', tag: 'h1', size: 'clamp(56px, 7vw, 112px)', weight: '800', lineHeight: 0.9, spacing: '-0.02em' }),
      w.heading({ text: 'calculator', tag: 'div', size: 'clamp(56px, 7vw, 112px)', weight: '800', lineHeight: 0.9, spacing: '-0.02em', color: '#B0A18E', margin: { d: { t: -22 } } }),
      w.text({ html: '<p>Calculate your rebar requirements with precision, then send the result straight to our estimators.</p>', size: '19px', lineHeight: 1.55, color: '#DCDFE3', maxWidth: { d: '620px' } }),
    ),
    // ---- the calculator + quote panel ----
    band(
      { bgColor: '#111D33', textColor: '#F4F5F7', padding: { d: { t: 0, b: 96 }, m: { t: 0, b: 56 } } },
      {},
      w['weight-calculator']({ variant: 'full' }),
    ),
    // ---- how it works ----
    section(
      { bgColor: '#F4F5F7', padding: { d: { t: 96, b: 96 }, m: { t: 56, b: 56 } } },
      row(
        { gap: { d: '48px', m: '16px' } },
        col(
          { span: { d: 5, t: 12, m: 12 }, gap: { d: '14px' } },
          w.text({ html: '<p>HOW IT WORKS</p>', size: '13px', lineHeight: 1.21, spacing: '0.14em', weight: '700', color: '#6B4F3A' }),
          w.heading({ text: 'Bars × length × kg/m', tag: 'h2', size: 'clamp(32px, 3.6vw, 48px)', lineHeight: 1, weight: '800' }),
          w.text({ html: '<p>Results use nominal CSA masses and exclude laps, hooks and waste. For a priced takeoff from your drawings, our estimators will run the full schedule.</p>', size: '16px', lineHeight: 1.65, color: '#3A4658' }),
          w.text({ html: '<p><a href="/products">See the full bar data table →</a></p>', size: '16px', weight: '700', lineHeight: 1.21, linkColor: '#182845', padding: { d: { t: 12, b: 12 } } }),
        ),
        col(
          { span: { d: 7, t: 12, m: 12 }, margin: { m: { t: 32 } } },
          row(
            { gap: { d: '1px' }, bgColor: '#B4BCC5', borderStyle: 'solid', borderWidth: { t: 1, r: 1, b: 1, l: 1 }, borderColor: '#B4BCC5' },
            cell('10M', '0.785 kg/m'), cell('15M', '1.570 kg/m'), cell('20M', '2.355 kg/m'),
            cell('25M', '3.925 kg/m'), cell('30M', '5.495 kg/m'), cell('35M', '7.850 kg/m'),
          ),
        ),
      ),
    ),
    // ---- shared call-to-action band ----
    band({ contentMode: 'full' }, {}, w.template({ templateId: 'cta-band' })),
  ],
};
