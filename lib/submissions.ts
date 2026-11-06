// Validation + storage for the public forms (contact, quote, calculator, newsletter).
import { all, run } from './db';
import { hasColumn } from './schema-ready';

export type FormType = 'contact' | 'quote' | 'calculator' | 'newsletter';
export const FORM_TYPES: FormType[] = ['contact', 'quote', 'calculator', 'newsletter'];

/** Custom forms built in the CMS are stored with type 'form:<slug>'. */
export const CUSTOM_TYPE = /^form:[a-z0-9-]{1,80}$/;
export const isCustomType = (t: string) => CUSTOM_TYPE.test(t);
/** Built-in type or a custom form's type — what the admin filters accept. */
export const isKnownType = (t: string) => (FORM_TYPES as string[]).includes(t) || isCustomType(t);

/** Human labels for custom types: { 'form:quote-2': 'Quote request' } (built from the forms table; deleted forms fall back to the slug). */
export function customFormLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of all<{ slug: string; name: string }>('SELECT slug, name FROM forms ORDER BY name COLLATE NOCASE')) out[`form:${f.slug}`] = f.name;
  return out;
}
/** Every custom type that has a form or at least one submission, with its label (for the admin filter tabs). */
export function customTypeList(): Array<{ type: string; label: string }> {
  const labels = customFormLabels();
  for (const r of all<{ type: string }>("SELECT DISTINCT type FROM submissions WHERE type LIKE 'form:%'")) if (!labels[r.type]) labels[r.type] = r.type.slice(5);
  return Object.entries(labels).map(([type, label]) => ({ type, label }));
}
export function typeLabel(type: string, labels: Record<string, string>): string {
  return isCustomType(type) ? labels[type] || type.slice(5) : type;
}

export type NewSubmission = {
  type: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
  data: Record<string, unknown>;
  /** Page the visitor was on ('/quote', '/products?x=1' …) and a label such as "Popup: Newsletter" — filled in by the endpoint. */
  source_url?: string;
  source_label?: string;
  /** utm_* + landing page + referrer from the visitor's first page (validated by cleanAttribution) */
  attribution?: Record<string, string>;
};

export type Parsed = { ok: true; row: NewSubmission } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const clip = (v: unknown, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const field = (fd: FormData, key: string, max = 200) => clip(fd.get(key), max);

function missing(list: Array<[string, string]>): string | null {
  const names = list.filter(([, value]) => !value).map(([label]) => label);
  return names.length ? `Please fill in: ${names.join(', ')}.` : null;
}

export function parseSubmission(type: string, fd: FormData): Parsed {
  switch (type) {
    case 'contact': {
      const first = field(fd, 'first_name', 80);
      const last = field(fd, 'last_name', 80);
      const email = field(fd, 'email', 200);
      const phone = field(fd, 'phone', 40);
      const company = field(fd, 'company', 160);
      const consent = field(fd, 'consent', 3);
      const err = missing([['first name', first], ['last name', last], ['email', email], ['phone', phone], ['company', company], ['newsletter choice', consent]]);
      if (err) return { ok: false, error: err };
      if (!EMAIL.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
      return { ok: true, row: { type, name: `${first} ${last}`, email, phone, company, message: field(fd, 'message', 5000), data: { newsletter_consent: consent === 'yes' } } };
    }

    case 'quote': {
      const name = field(fd, 'name', 160);
      const email = field(fd, 'email', 200);
      const phone = field(fd, 'phone', 40);
      const location = field(fd, 'location', 200);
      const err = missing([['project location', location], ['full name', name], ['email', email], ['phone', phone]]);
      if (err) return { ok: false, error: err };
      if (!EMAIL.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
      let items: Array<{ label: string; qty: number }> = [];
      try {
        const parsed = JSON.parse(String(fd.get('items') || '[]'));
        if (Array.isArray(parsed)) {
          items = parsed
            .map((i) => ({ label: clip(i?.label, 120), qty: Math.min(Math.max(Math.trunc(Number(i?.qty) || 0), 0), 100000) }))
            .filter((i) => i.label && i.qty > 0)
            .slice(0, 50);
        }
      } catch {
        /* ignore malformed items */
      }
      return {
        ok: true,
        row: {
          type,
          name,
          email,
          phone,
          company: field(fd, 'company', 160),
          message: field(fd, 'notes', 5000),
          data: {
            existing_customer: field(fd, 'existing_customer', 3),
            need: field(fd, 'need', 80),
            sector: field(fd, 'sector', 120),
            project_location: location,
            items,
            other_items: field(fd, 'other_items', 3000),
          },
        },
      };
    }

    case 'calculator': {
      const name = field(fd, 'name', 160);
      const email = field(fd, 'email', 200);
      const phone = field(fd, 'phone', 40);
      const err = missing([['name', name], ['phone', phone]]);
      if (err) return { ok: false, error: err };
      if (email && !EMAIL.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
      const size = field(fd, 'size', 10);
      const length = Math.min(Math.max(Number(fd.get('length')) || 0, 0), 18);
      const bars = Math.min(Math.max(Math.trunc(Number(fd.get('bars')) || 0), 0), 1_000_000);
      const totalKg = Math.min(Math.max(Math.round(Number(fd.get('total_kg')) || 0), 0), 1e9);
      return {
        ok: true,
        row: { type, name, email, phone, company: '', message: `${bars} × ${size} bars at ${length} m ≈ ${totalKg.toLocaleString('en-CA')} kg`, data: { size, length_m: length, bars, total_kg: totalKg } },
      };
    }

    case 'newsletter': {
      const email = field(fd, 'email', 200);
      if (!EMAIL.test(email)) return { ok: false, error: 'Please enter a valid email address.' };
      return { ok: true, row: { type, name: '', email, phone: '', company: '', message: '', data: {} } };
    }

    default:
      return { ok: false, error: 'Unknown form.' };
  }
}

export function insertSubmission(row: NewSubmission): number {
  const cols = ['type', 'name', 'email', 'phone', 'company', 'message', 'data'];
  const vals: Array<string | number> = [row.type, row.name, row.email, row.phone, row.company, row.message, JSON.stringify(row.data)];
  // Columns added by later migrations are used only when they exist: on a database that has not been migrated yet (a long-running
  // dev server started before the migration) the lead is still saved — a customer's enquiry must never be lost for that reason.
  if (hasColumn('submissions', 'source_url') && hasColumn('submissions', 'source_label')) {
    cols.push('source_url', 'source_label');
    vals.push((row.source_url || '').slice(0, 300), (row.source_label || '').slice(0, 160));
  }
  if (hasColumn('submissions', 'attribution')) {
    cols.push('attribution');
    vals.push(JSON.stringify(row.attribution || {}));
  }
  return run(`INSERT INTO submissions (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, ...vals).lastInsertRowid;
}

export function setAttachments(id: number, attachments: unknown[]) {
  run('UPDATE submissions SET attachments = ? WHERE id = ?', JSON.stringify(attachments), id);
}

/** The page a form was submitted from: a same-site path only ('/quote', '/products?x=1'), never an absolute URL. */
export function cleanSourcePath(v: unknown): string {
  const s = String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return /^\/(?!\/)[^\s<>"'\\]*$/.test(s) ? s.slice(0, 300) : '';
}
