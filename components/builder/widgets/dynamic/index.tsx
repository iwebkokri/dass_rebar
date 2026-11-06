// Dynamic (CMS-driven) widget components. Registered in ../index.ts through DYNAMIC_COMPONENTS.
// These wrappers read ONLY `ctx.data` and hand the client components just the props they need (never the whole ctx).
import type { ComponentType } from 'react';
import type { WidgetProps } from '@/lib/builder/types';
import Projects from './Projects';
import Insights from './Insights';
import { BarDiagrams, BarTable, Products } from './Products';
import Calculator from './Calculator';
import QuoteWizard from './QuoteWizard';
import { ContactForm, CustomForm, Newsletter } from './Forms';
import { EmptyBox, str } from './shared';

function WeightCalculator({ node, ctx }: WidgetProps) {
  const p = node.props || {};
  const bars = ctx.data.bars || [];
  if (!bars.length) return <EmptyBox edit={!!ctx.edit}>No bar data yet — add it under Bar data in the admin.</EmptyBox>;
  return (
    <Calculator
      bars={bars}
      variant={p.variant === 'full' ? 'full' : 'compact'}
      edit={!!ctx.edit}
      ctaLabel={str(p.ctaLabel)}
      ctaUrl={str(p.ctaUrl)}
      calcTitle={str(p.calcTitle)}
      quoteTitle={str(p.quoteTitle)}
      quoteButton={str(p.quoteButton)}
    />
  );
}

function QuoteWizardWidget() {
  return <QuoteWizard />;
}

function ContactFormWidget({ node }: WidgetProps) {
  const p = node.props || {};
  return <ContactForm title={str(p.title)} buttonLabel={str(p.buttonLabel)} successTitle={str(p.successTitle)} successText={str(p.successText)} />;
}

function NewsletterWidget({ node }: WidgetProps) {
  const p = node.props || {};
  return <Newsletter placeholder={str(p.placeholder)} buttonLabel={str(p.buttonLabel)} successText={str(p.successText)} />;
}

function FormWidget({ node, ctx }: WidgetProps) {
  const id = String(node.props?.formId ?? '');
  const form = id ? ctx.data.forms?.[id] : undefined;
  if (!form) return <EmptyBox edit={!!ctx.edit}>{id ? 'This form no longer exists — choose another one in the panel.' : 'Choose a form in the panel →'}</EmptyBox>;
  if (!form.fields?.length) return <EmptyBox edit={!!ctx.edit}>“{form.name}” has no fields yet — add some under Forms in the admin.</EmptyBox>;
  return <CustomForm form={form} />;
}

export const DYNAMIC_COMPONENTS: Record<string, ComponentType<WidgetProps>> = {
  projects: Projects,
  insights: Insights,
  products: Products,
  'bar-table': BarTable,
  'bar-diagrams': BarDiagrams,
  'weight-calculator': WeightCalculator,
  'quote-wizard': QuoteWizardWidget,
  'contact-form': ContactFormWidget,
  newsletter: NewsletterWidget,
  form: FormWidget,
};
