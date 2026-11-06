// Custom forms: constants + validation of the form DEFINITION (no database, no node: imports — the FormBuilder client component imports this too).
import type { FormDef, FormField, FormPublicSettings } from './builder/types';
import { safeUrl } from './builder/url.mjs';
import { slugify } from './slug.mjs';

export type FieldType = FormField['type'];
export const FIELD_TYPES: Array<{ type: FieldType; label: string }> = [
  { type: 'text', label: 'Short text' },
  { type: 'email', label: 'Email' },
  { type: 'tel', label: 'Phone' },
  { type: 'textarea', label: 'Long text' },
  { type: 'select', label: 'Dropdown' },
  { type: 'radio', label: 'Radio buttons' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'checkboxes', label: 'Checkboxes (several)' },
  { type: 'consent', label: 'Consent checkbox' },
  { type: 'number', label: 'Number' },
  { type: 'date', label: 'Date' },
  { type: 'file', label: 'File upload' },
  { type: 'hidden', label: 'Hidden value' },
];
const TYPE_SET = new Set<string>(FIELD_TYPES.map((t) => t.type));
/** Field types that offer a list of choices. */
export const OPTION_TYPES: FieldType[] = ['select', 'radio', 'checkboxes'];
/** "Use as the customer's …" — which answer is the name / email / phone / company / message (CMS list, lead email, Lead Manager). */
export type MapRole = NonNullable<FormField['map']>;
export const MAP_ROLES: MapRole[] = ['name', 'email', 'phone', 'company', 'message'];
export const MAP_LABEL: Record<MapRole, string> = { name: 'Name', email: 'Email', phone: 'Phone', company: 'Company', message: 'Message' };
export const MAP_TYPES: FieldType[] = ['text', 'email', 'tel', 'textarea', 'select', 'radio', 'number'];
/** Field types that can show placeholder text. */
export const PLACEHOLDER_TYPES: FieldType[] = ['text', 'email', 'tel', 'textarea', 'number'];

export const MAX_FIELDS = 40;
export const MAX_OPTIONS = 50;
/** Keys the public endpoint uses itself — a field can't be called any of these. */
export const RESERVED_IDS = ['website', 'type', 'form_id', '_src', '_popup'];
export const FIELD_ID = /^[a-z][a-z0-9_]{0,39}$/;
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Everything stored in forms.settings. The public widget only ever receives FormPublicSettings. */
export type FormSettings = FormPublicSettings & {
  /** Forward every submission to Lead Manager (default on; a "Newsletter" form starts switched off). Only ever stored as false. */
  leadManager?: boolean;
  /** Email the site owner when someone submits (default on). */
  notify?: boolean;
  /** Send to these addresses instead of the site-wide owner addresses. */
  notifyEmails?: string;
  /** Subject template for the owner email, e.g. "New lead — {form} — {name}". */
  notifySubject?: string;
  /** Thank-you email to the customer (default off). Needs an Email field. */
  autoReply?: boolean;
  autoReplySubject?: string;
  autoReplyBody?: string;
};
export type FormValue = { name: string; slug: string; fields: FormField[]; settings: FormSettings };

export const DEFAULT_SUBMIT_LABEL = 'Send message';
export const DEFAULT_SUCCESS = 'Thank you — your message has been sent. We’ll be in touch shortly.';
export const DEFAULT_AUTOREPLY_SUBJECT = 'We received your message — {{site}}';

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '');
const oneLine = (v: unknown, max: number) => clip(v, max * 2).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

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
  let contactTaken = false;
  const mapTaken = new Set<MapRole>();
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

    const t = type as FieldType;
    const f: FormField = { id, type: t, label, width: r.width === 'half' ? 'half' : 'full' };
    if (r.required && t !== 'hidden') f.required = true;
    const placeholder = clip(r.placeholder, 200);
    if (placeholder && PLACEHOLDER_TYPES.includes(t)) f.placeholder = placeholder;
    const help = clip(r.help, 300);
    if (help && t !== 'hidden') f.help = help;

    if (OPTION_TYPES.includes(t)) {
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
    if (t === 'hidden') {
      f.value = clip(r.value, 500);
      f.width = 'full';
    }
    // "use this answer as the customer's …": one field per role; an email field mapped to "email" is also the contact address
    const role = typeof r.map === 'string' && MAP_ROLES.includes(r.map as MapRole) ? (r.map as MapRole) : undefined;
    if (role && MAP_TYPES.includes(t) && !mapTaken.has(role)) {
      f.map = role;
      mapTaken.add(role);
    }
    if (t === 'email' && (r.contact || f.map === 'email') && !contactTaken) {
      f.contact = true;
      f.map = f.map === 'email' ? 'email' : f.map;
      contactTaken = true;
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
  if (s.notify === false) settings.notify = false;
  if (s.leadManager === false) settings.leadManager = false;
  const subject = oneLine(s.notifySubject, 200);
  if (subject) settings.notifySubject = subject;
  if (s.autoReply === true) {
    if (!fields.some((f) => f.type === 'email')) return { ok: false, error: 'To send an auto-reply, add an Email field so we know where to send it.' };
    settings.autoReply = true;
    settings.autoReplySubject = oneLine(s.autoReplySubject, 200) || DEFAULT_AUTOREPLY_SUBJECT;
    const body = clip(s.autoReplyBody, 2000);
    if (body) settings.autoReplyBody = body;
  } else {
    const subj = oneLine(s.autoReplySubject, 200);
    if (subj) settings.autoReplySubject = subj;
    const body = clip(s.autoReplyBody, 2000);
    if (body) settings.autoReplyBody = body;
  }

  return { ok: true, value: { name, slug, fields, settings } };
}

/** The part of the settings the browser may see (the public form widget). */
export function publicSettings(s: FormSettings | undefined): FormPublicSettings {
  const out: FormPublicSettings = {};
  if (s?.submitLabel) out.submitLabel = s.submitLabel;
  if (s?.successMessage) out.successMessage = s.successMessage;
  if (s?.redirectUrl) out.redirectUrl = s.redirectUrl;
  return out;
}

export type { FormDef };
