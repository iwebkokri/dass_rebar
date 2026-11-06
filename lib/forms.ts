// Custom forms (server side): loading definitions, usage scan, and validating a public submission against its definition.
import type { FormDef, FormField } from './builder/types';
import { all, get } from './db';
import { EMAIL, OPTION_TYPES, type FormSettings } from './forms-shared';
import { MAX_ATTACHMENTS, UploadError, checkAttachment } from './uploads';
import type { NewSubmission } from './submissions';

/** A stored form: the public part (FormDef) plus the owner-only settings (recipients, auto-reply). Never hand this to the browser. */
export type StoredForm = Omit<FormDef, 'settings'> & { settings: FormSettings; created_at?: string; updated_at?: string };

const json = <T>(s: string, fallback: T): T => {
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

function hydrate(r: any): StoredForm {
  return { id: r.id, name: r.name, slug: r.slug, fields: json(r.fields, []), settings: json(r.settings, {}), created_at: r.created_at, updated_at: r.updated_at };
}

export function getForm(id: number): StoredForm | undefined {
  const r = get<any>('SELECT * FROM forms WHERE id = ?', id);
  return r ? hydrate(r) : undefined;
}

export function getFormBySlug(slug: string): StoredForm | undefined {
  const r = get<any>('SELECT * FROM forms WHERE slug = ?', slug);
  return r ? hydrate(r) : undefined;
}

export function listForms(): StoredForm[] {
  return all<any>('SELECT * FROM forms ORDER BY name COLLATE NOCASE').map(hydrate);
}

export const formType = (slug: string) => `form:${slug}`;

export function uniqueFormSlug(base: string, exceptId = 0): string {
  let slug = base;
  for (let n = 2; get('SELECT 1 AS x FROM forms WHERE slug = ? AND id <> ?', slug, exceptId); n++) slug = `${base}-${n}`;
  return slug;
}

export function submissionCounts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of all<{ type: string; c: number }>("SELECT type, COUNT(*) AS c FROM submissions WHERE type LIKE 'form:%' GROUP BY type")) out[r.type] = r.c;
  return out;
}

export type FormUse = { kind: 'page' | 'template' | 'popup'; id: number; title: string };

/** Pages, templates (header / footer / saved sections) and popups whose content embeds this form with the Custom form widget. */
export function formUsage(formId: number): FormUse[] {
  const out: FormUse[] = [];
  const needle = `"formId"`;
  const uses = (content: string): boolean => {
    if (!content.includes(needle)) return false;
    const walk = (nodes: any[]): boolean =>
      Array.isArray(nodes) && nodes.some((n) => (n?.type === 'form' && String(n?.props?.formId ?? '') === String(formId)) || walk(n?.children));
    return walk(json<any>(content, {}).nodes);
  };
  for (const p of all<{ id: number; title: string; content: string }>("SELECT id, title, content FROM pages WHERE status <> 'trash' AND content LIKE '%formId%'")) {
    if (uses(p.content)) out.push({ kind: 'page', id: p.id, title: p.title });
  }
  for (const t of all<{ id: number; name: string; kind: string; content: string }>("SELECT id, name, kind, content FROM templates WHERE content LIKE '%formId%'")) {
    if (uses(t.content)) out.push({ kind: t.kind === 'popup' ? 'popup' : 'template', id: t.id, title: t.name });
  }
  return out;
}

// ---------------------------------------------------------------- validating a public submission
export type CustomParsed =
  | { ok: true; row: NewSubmission; files: Array<{ file: File; label: string }> }
  | { ok: false; error: string };

const clip = (v: unknown, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const isFile = (v: FormDataEntryValue): v is File => typeof v !== 'string' && v.size > 0;

/** Check every value against the form's fields. Returns the submission row (data keyed by field LABEL) + the files to store. */
export function parseCustomForm(def: StoredForm, fd: FormData): CustomParsed {
  const data: Record<string, unknown> = {};
  const byField = new Map<string, string>(); // field id -> cleaned text value (for name/email/phone mapping)
  const files: Array<{ file: File; label: string }> = [];
  const missing: string[] = [];
  const used = new Set<string>();

  for (const f of def.fields) {
    // Labels become the keys of the stored data — keep them unique.
    let key = f.label;
    for (let n = 2; used.has(key); n++) key = `${f.label} (${n})`;
    used.add(key);

    switch (f.type) {
      case 'file': {
        const list = fd.getAll(f.id).filter(isFile);
        if (!list.length) {
          if (f.required) missing.push(f.label);
          break;
        }
        for (const file of list) {
          try {
            checkAttachment(file);
          } catch (err) {
            if (err instanceof UploadError) return { ok: false, error: err.message };
            throw err;
          }
          files.push({ file, label: key });
        }
        data[key] = list.map((x) => x.name.slice(0, 120)).join(', ');
        break;
      }

      case 'checkbox':
      case 'consent': {
        const on = /^(on|true|1|yes)$/i.test(clip(fd.get(f.id), 8));
        if (f.required && !on) {
          missing.push(f.label);
          break;
        }
        data[key] = on ? 'Yes' : 'No';
        break;
      }

      case 'hidden': {
        // The browser can't change it: the value always comes from the form's definition.
        if (f.value) data[key] = f.value.slice(0, 500);
        break;
      }

      case 'checkboxes': {
        const options = f.options || [];
        const picked = fd.getAll(f.id).map((v) => clip(v, 120)).filter(Boolean);
        const bad = picked.find((v) => !options.includes(v));
        if (bad) return { ok: false, error: `“${f.label}”: please choose from the listed options.` };
        const chosen = options.filter((o) => picked.includes(o));
        if (!chosen.length) {
          if (f.required) missing.push(f.label);
          break;
        }
        data[key] = chosen.join(', ');
        break;
      }

      default: {
        const max = f.type === 'textarea' ? 5000 : f.type === 'email' ? 200 : f.type === 'tel' ? 40 : 500;
        const v = clip(fd.get(f.id), max);
        if (!v) {
          if (f.required) missing.push(f.label);
          break;
        }
        if (f.type === 'email' && !EMAIL.test(v)) return { ok: false, error: `“${f.label}”: please enter a valid email address.` };
        if (f.type === 'number') {
          const n = Number(v);
          if (!Number.isFinite(n) || Math.abs(n) > 1e12) return { ok: false, error: `“${f.label}”: please enter a number.` };
          data[key] = n;
          byField.set(f.id, String(n));
          break;
        }
        if (f.type === 'date') {
          const d = new Date(`${v}T00:00:00Z`);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return { ok: false, error: `“${f.label}”: please enter a valid date.` };
        }
        if (OPTION_TYPES.includes(f.type) && !(f.options || []).includes(v)) return { ok: false, error: `“${f.label}”: please choose one of the listed options.` };
        data[key] = v;
        byField.set(f.id, v);
      }
    }
  }

  if (missing.length) return { ok: false, error: `Please fill in: ${missing.join(', ')}.` };
  if (files.length > MAX_ATTACHMENTS) return { ok: false, error: `Please attach no more than ${MAX_ATTACHMENTS} files.` };

  const text = (pred: (f: FormField) => boolean) => def.fields.filter(pred).map((f) => byField.get(f.id) || '').find(Boolean) || '';
  const isNameField = (f: FormField) => f.type === 'text' && /name/i.test(f.label) && !/company|business|organi[sz]ation|project|file|user/i.test(f.label);
  const first = text((f) => isNameField(f) && /first|given/i.test(f.label));
  const last = text((f) => isNameField(f) && /last|sur|family/i.test(f.label));
  const name = first && last ? `${first} ${last}` : text((f) => isNameField(f) && /full|^\s*(your\s+)?name\s*$/i.test(f.label)) || text(isNameField) || first || last;

  // An answer the editor explicitly mapped ("Use as the customer's …") always wins over the guesses from field type / label.
  const mapped = (role: NonNullable<FormField['map']>) => text((f) => f.map === role);
  const row: NewSubmission = {
    type: formType(def.slug),
    name: (mapped('name') || name).slice(0, 160),
    // the email field marked "contact" wins; otherwise the first one that was filled in
    email: mapped('email') || text((f) => f.type === 'email' && !!f.contact) || text((f) => f.type === 'email'),
    phone: (mapped('phone') || text((f) => f.type === 'tel')).slice(0, 40),
    company: (mapped('company') || text((f) => f.type === 'text' && /company|business|organi[sz]ation/i.test(f.label))).slice(0, 160),
    message: mapped('message') || text((f) => f.type === 'textarea'),
    data,
  };
  return { ok: true, row, files };
}
