// Browser helper used by the contact, quote, calculator and newsletter forms.
export type FormResult = { ok: boolean; error?: string };

export async function submitForm(type: 'contact' | 'quote' | 'calculator' | 'newsletter' | 'form', data: FormData): Promise<FormResult> {
  data.set('type', type);
  try {
    const res = await fetch('/api/forms', { method: 'POST', body: data });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) return { ok: true };
    return { ok: false, error: body.error || 'Something went wrong. Please try again or call us on (905) 813-3014.' };
  } catch {
    return { ok: false, error: 'We couldn’t reach the server. Please check your connection and try again.' };
  }
}
