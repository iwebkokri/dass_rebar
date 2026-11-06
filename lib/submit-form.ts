// Browser helper used by the contact, quote, calculator and newsletter forms.
import { readAttribution } from './attribution';

export type FormResult = { ok: boolean; error?: string };

/** `from` = the <form> being submitted: lets the endpoint record which page and which popup (a [data-dr-popup="<id>"] ancestor) it was in. */
export async function submitForm(type: 'contact' | 'quote' | 'calculator' | 'newsletter' | 'form', data: FormData, from?: Element | null): Promise<FormResult> {
  data.set('type', type);
  let popup = '';
  try {
    data.set('_src', location.pathname + location.search);
    const attr = readAttribution(); // utm_* / landing page / referrer captured on the visitor's first page (lib/attribution.ts)
    if (attr) data.set('_attr', attr);
    popup = from?.closest?.('[data-dr-popup]')?.getAttribute('data-dr-popup') || '';
    if (popup) data.set('_popup', popup);
  } catch { /* ignore */ }
  try {
    const res = await fetch('/api/forms', { method: 'POST', body: data });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      // Tells the tracking snippets (Studio CMS → Tracking & code) that a visitor just submitted a form: they forward it as a
      // lead / conversion event to Google, Meta, TikTok and the GTM data layer. Nothing listens when no tracker is set up.
      // `popup` (when the form was inside a popup) lets the popup mark itself converted / auto-close.
      try { window.dispatchEvent(new CustomEvent('dr:form-success', { detail: { form: type === 'form' ? `form-${String(data.get('form_id') ?? '')}` : type, popup } })); } catch { /* ignore */ }
      return { ok: true };
    }
    return { ok: false, error: body.error || 'Something went wrong. Please try again or call us on (905) 813-3014.' };
  } catch {
    return { ok: false, error: 'We couldn’t reach the server. Please check your connection and try again.' };
  }
}
