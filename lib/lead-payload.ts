// Turns a stored submission into the JSON the Lead Manager webhook expects. Pure: no database, no network.
//
//   name, email, phone, company, message   the customer (already derived when the lead was stored: built-in forms by name,
//                                          custom forms by the field the editor mapped, else by field type + label)
//   formName, pageUrl                      which form, and the page it was submitted from (absolute)
//   utm_source … utm_content               first-touch campaign attribution
//   externalId                             "dassrebar-sub-<id>" — identical on every retry / resend, so a lead is never created twice
//   fields {}                              everything else, with readable keys
//
// Customer file uploads are private: only a note ("2 files (view in CMS)") and the CMS link are sent, never content or download links.
import type { StoredForm } from './forms';

export type PayloadSub = {
  id: number; type: string; name: string; email: string; phone: string; company: string; message: string;
  data: string; attachments: string; created_at: string; source_url: string; source_label: string; attribution: string;
};

const MAX_FIELDS = 40;
const MAX_KEY = 60;
const MAX_VALUE = 500;
const MAX_MESSAGE = 5000;

const BUILT_IN_NAME: Record<string, string> = { contact: 'Contact form', quote: 'Quote request', calculator: 'Weight calculator', newsletter: 'Newsletter signup' };

export const externalIdFor = (submissionId: number) => `dassrebar-sub-${submissionId}`;

/** Control characters out (newlines / tabs kept only when `multiline`), trimmed, length-capped. */
export function cleanText(v: unknown, max: number, multiline = false): string {
  let s = String(v ?? '');
  s = multiline ? s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '') : s.replace(/[\u0000-\u001f\u007f\u2028\u2029]+/g, ' ').replace(/\s+/g, ' ');
  return s.trim().slice(0, max);
}

const json = <T,>(s: string, fallback: T): T => {
  try {
    return (JSON.parse(s) as T) ?? fallback;
  } catch {
    return fallback;
  }
};

export function formNameFor(sub: Pick<PayloadSub, 'type'>, def?: Pick<StoredForm, 'name'>): string {
  return cleanText(BUILT_IN_NAME[sub.type] ?? def?.name ?? sub.type.replace(/^form:/, ''), 120);
}

export function buildLeadPayload(sub: PayloadSub, def: StoredForm | undefined, base: string): Record<string, unknown> {
  const data = json<Record<string, any>>(sub.data, {});
  const attr = json<Record<string, string>>(sub.attribution, {});
  const attachments = json<unknown[]>(sub.attachments, []);

  const fields: Record<string, string> = {};
  const add = (label: string, value: unknown, max = MAX_VALUE) => {
    if (Object.keys(fields).length >= MAX_FIELDS) return;
    const key = cleanText(label, MAX_KEY);
    const val = cleanText(value, max, true);
    if (key && val && !(key in fields)) fields[key] = val;
  };

  switch (sub.type) {
    case 'contact':
      add('Newsletter consent', 'newsletter_consent' in data ? (data.newsletter_consent ? 'Yes' : 'No') : '');
      break;
    case 'quote': {
      add('Project location', data.project_location);
      add('Sector', data.sector);
      add('Need', data.need);
      add('Existing customer', data.existing_customer);
      const items: Array<{ label?: string; qty?: number }> = Array.isArray(data.items) ? data.items : [];
      if (items.length) {
        add('Rebar sizes', [...new Set(items.map((i) => cleanText(i.label, 60)))].join(', '));
        add('Total quantity', items.reduce((n, i) => n + (Number(i.qty) || 0), 0));
        add('Materials', items.map((i) => `${cleanText(i.label, 60)} × ${Number(i.qty) || 0}`).join('; '));
      }
      add('Other items', data.other_items);
      break;
    }
    case 'calculator':
      add('Rebar size', data.size);
      add('Length (m)', data.length_m);
      add('Quantity', data.bars);
      add('Estimated weight (kg)', data.total_kg);
      break;
    case 'newsletter':
      break;
    default: {
      // custom form: every answer except file uploads (private) and those already sent as name / email / phone / company / message
      const fileLabels = (def?.fields || []).filter((f) => f.type === 'file').map((f) => f.label);
      const used = new Set([sub.name, sub.email, sub.phone, sub.company, sub.message].filter(Boolean).map((x) => String(x).trim()));
      for (const [label, value] of Object.entries(data)) {
        if (fileLabels.some((l) => label === l || label.startsWith(`${l} (`))) continue;
        if (typeof value === 'string' && used.has(value.trim())) continue;
        add(label, value);
      }
    }
  }

  if (sub.source_label) add('Shown in', sub.source_label);
  if (attr.landing_url) add('Landing page', attr.landing_url);
  if (attr.referrer) add('Referrer', attr.referrer);
  add('Submitted at', sub.created_at ? `${sub.created_at.replace(' ', 'T')}Z` : '');
  if (attachments.length) add('attachments', `${attachments.length} file${attachments.length === 1 ? '' : 's'} (view in CMS)`);
  if (base) add('cmsLink', `${base}/admin/submissions/${sub.id}`, 300);

  const payload: Record<string, unknown> = {
    name: cleanText(sub.name, MAX_VALUE),
    email: cleanText(sub.email, 254),
    phone: cleanText(sub.phone, 60),
    company: cleanText(sub.company, MAX_VALUE),
    message: cleanText(sub.message, MAX_MESSAGE, true),
    formName: formNameFor(sub, def),
    externalId: externalIdFor(sub.id),
  };
  if (base && /^\/(?!\/)/.test(sub.source_url)) payload.pageUrl = cleanText(base + sub.source_url, 500);
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const) if (attr[k]) payload[k] = cleanText(attr[k], 200);
  payload.fields = fields;
  return payload;
}
