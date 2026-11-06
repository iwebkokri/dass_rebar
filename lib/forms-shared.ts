// Custom forms: constants + validation of the form DEFINITION (no database, no node: imports — the FormBuilder client component imports this too).
import type { FormDef, FormField } from './builder/types';
import { safeUrl } from './builder/url.mjs';
import { slugify } from './slug.mjs';

export type FieldType = FormField['type'];
export const FIELD_TYPES: Array<{ type: FieldType; label: string }> = [
  { type: 'text', label: 'Short text' },
  { type: 'email', label: 'Email' },
  { type: 'tel', label: 'Phone' },
  { type: 'textarea', label: 'Long text' },
  { type: 'select', label: 'Dropdown' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'file', label: 'File upload' },
];
const TYPE_SET = new Set<string>(FIELD_TYPES.map((t) => t.type));

export const MAX_FIELDS = 40;
export const MAX_OPTIONS = 50;
/** Keys the public endpoint uses itself — a field can't be called any of these. */
export const RESERVED_IDS = ['website', 'type', 'form_id'];
export const FIELD_ID = /^[a-z][a-z0-9_]{0,39}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FormSettings = FormDef['settings'] & { notifyEmails?: string };
export type FormValue = { name: string; slug: string; fields: FormField[]; settings: FormSettings };

export const DEFAULT_SUBMIT_LABEL = 'Send message';
export const DEFAULT_SUCCESS = 'Thank you — your message has been sent. We’ll be in touch shortly.';

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '');

/** Split a "one per line" / comma list of emails. */
export function splitEmails(v: string): string[] {
  return v.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
}

/** Validate + clean the editor's JSON. Never trust the browser: everything stored goes through here. */
export function normaliseFormInput(raw: any): { ok: true; value: FormValue } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid form data.' };

  const name = clip(raw.name, 120);
  if (!name) return { ok: false, error: 'Give the form a name.' };
  const slug = slugify(clip(raw.slug, 80) || name);

  const rawFields: any[] = Array.isArray(raw.fields) ? raw.fields : [];
  if (rawFields.length > MAX_FIELDS) return { ok: false, error: `A form can have at most ${MAX_FIELDS} fields.` };

  const fields: FormField[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < rawFields.length; i++) {
    const r = rawFields[i];
    if (!r || typeof r !== 'object') return { ok: false, error: `Field ${i + 1} is invalid.` };
    const type = String(r.type);
    if (!TYPE_SET.has(type)) return { ok: false, error: `Field ${i + 1}: unknown type.` };
    const label = clip(r.label, 120);
    if (!label) return { ok: false, error: `Field ${i + 1} needs a label.` };

    let id = typeof r.id === 'string' ? r.id.trim() : '';
    if (id && !FIELD_ID.test(id)) return { ok: false, error: `Field “${label}”: the id must be lowercase letters, digits and underscores (start with a letter).` };
    if (id && RESERVED_IDS.includes(id)) return { ok: false, error: `Field “${label}”: “${id}” is a reserved id.` };
    if (!id) {
      const base = slugify(label).replace(/-/g, '_').replace(/^[^a-z]+/, '').slice(0, 30) || 'field';
      id = base;
      for (let n = 2; ids.has(id) || RESERVED_IDS.includes(id); n++) id = `${base}_${n}`;
    }
    if (ids.has(id)) return { ok: false, error: `Two fields share the id “${id}”.` };
    ids.add(id);

    const f: FormField = { id, type: type as FieldType, label, width: r.width === 'half' ? 'half' : 'full' };
    if (r.required) f.required = true;
    const placeholder = clip(r.placeholder, 200);
    if (placeholder && type !== 'checkbox' && type !== 'file' && type !== 'select' && type !== 'date') f.placeholder = placeholder;

    if (type === 'select') {
      const list: unknown[] = Array.isArray(r.options) ? r.options : typeof r.options === 'string' ? r.options.split(/\r?\n/) : [];
      const options: string[] = [];
      for (const o of list) {
        const s = clip(o, 120);
        if (s && !options.includes(s)) options.push(s);
      }
      if (!options.length) return { ok: false, error: `Field “${label}”: add at least one option (one per line).` };
      if (options.length > MAX_OPTIONS) return { ok: false, error: `Field “${label}”: at most ${MAX_OPTIONS} options.` };
      f.options = options;
    }
    fields.push(f);
  }

  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  const settings: FormSettings = {
    submitLabel: clip(s.submitLabel, 60) || DEFAULT_SUBMIT_LABEL,
    successMessage: clip(s.successMessage, 500) || DEFAULT_SUCCESS,
  };
  const redirect = clip(s.redirectUrl, 2000);
  if (redirect) {
    if (!safeUrl(redirect)) return { ok: false, error: 'The redirect address must start with https://, / or #.' };
    settings.redirectUrl = redirect;
  }
  const emails = splitEmails(clip(s.notifyEmails, 1000));
  const bad = emails.find((e) => !EMAIL.test(e));
  if (bad) return { ok: false, error: `“${bad}” is not a valid email address.` };
  if (emails.length > 10) return { ok: false, error: 'At most 10 notification emails.' };
  if (emails.length) settings.notifyEmails = emails.join(', ');

  return { ok: true, value: { name, slug, fields, settings } };
}
