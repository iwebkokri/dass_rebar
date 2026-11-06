'use client';

// Form builder: name / slug, an ordered list of fields (type, label, placeholder, required, width, options) and the form's settings.
import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveForm } from '@/app/admin/forms/actions';
import type { FormField } from '@/lib/builder/types';
import { DEFAULT_SUBMIT_LABEL, DEFAULT_SUCCESS, FIELD_TYPES, MAX_FIELDS, type FieldType, type FormSettings } from '@/lib/forms-shared';
import useUnsavedGuard from './useUnsavedGuard';

type FField = FormField & { optionsText: string };
type Usage = { kind: 'page' | 'template'; id: number; title: string };
type Props = {
  id: number | 'new';
  initial: { name: string; slug: string; fields: FormField[]; settings: FormSettings };
  usage: Usage[];
  submissions: number;
  submissionsHref: string;
};

const DEFAULTS: Record<FieldType, { label: string; id: string }> = {
  text: { label: 'Text', id: 'text' },
  email: { label: 'Email', id: 'email' },
  tel: { label: 'Phone', id: 'phone' },
  textarea: { label: 'Message', id: 'message' },
  select: { label: 'Choose one', id: 'choice' },
  checkbox: { label: 'I agree', id: 'agree' },
  number: { label: 'Number', id: 'number' },
  date: { label: 'Date', id: 'date' },
  file: { label: 'File', id: 'file' },
};
const typeName = (t: string) => FIELD_TYPES.find((x) => x.type === t)?.label ?? t;
const urlOk = (u: string) => !u.trim() || /^(\/(?!\/)|#|\?|https?:\/\/|mailto:|tel:)/i.test(u.trim());
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const hasPlaceholder = (t: string) => ['text', 'email', 'tel', 'textarea', 'number'].includes(t);
const slugOf = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

const toField = (f: FormField): FField => ({ ...f, width: f.width || 'full', optionsText: (f.options || []).join('\n') });

export default function FormBuilder({ id, initial, usage, submissions, submissionsHref }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(id !== 'new');
  const [fields, setFields] = useState<FField[]>(() => initial.fields.map(toField));
  const [settings, setSettings] = useState({
    submitLabel: initial.settings.submitLabel ?? DEFAULT_SUBMIT_LABEL,
    successMessage: initial.settings.successMessage ?? DEFAULT_SUCCESS,
    redirectUrl: initial.settings.redirectUrl ?? '',
    notifyEmails: initial.settings.notifyEmails ?? '',
  });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const snapshot = (n: string, s: string, f: FField[], st: typeof settings) => JSON.stringify({ n, s, f, st });
  const [saved, setSaved] = useState(() => snapshot(initial.name, initial.slug, initial.fields.map(toField), {
    submitLabel: initial.settings.submitLabel ?? DEFAULT_SUBMIT_LABEL,
    successMessage: initial.settings.successMessage ?? DEFAULT_SUCCESS,
    redirectUrl: initial.settings.redirectUrl ?? '',
    notifyEmails: initial.settings.notifyEmails ?? '',
  }));
  const dirty = useMemo(() => snapshot(name, slug, fields, settings) !== saved, [name, slug, fields, settings, saved]);
  useUnsavedGuard(dirty, 'You have unsaved form changes. Leave without saving?');

  const patch = (fid: string, p: Partial<FField>) => setFields((l) => l.map((f) => (f.id === fid ? { ...f, ...p } : f)));
  const move = (i: number, d: -1 | 1) => setFields((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = l.slice();
    [n[i], n[j]] = [n[j], n[i]];
    return n;
  });
  const toggle = (fid: string) => setOpen((s) => { const n = new Set(s); if (n.has(fid)) n.delete(fid); else n.add(fid); return n; });
  const addField = (type: FieldType) => {
    if (fields.length >= MAX_FIELDS) return setStatus({ ok: false, text: `A form can have at most ${MAX_FIELDS} fields.` });
    const base = DEFAULTS[type].id;
    let fid = base;
    for (let n = 2; fields.some((f) => f.id === fid); n++) fid = `${base}_${n}`;
    const f: FField = { id: fid, type, label: DEFAULTS[type].label, width: 'full', required: false, optionsText: type === 'select' ? 'Option 1\nOption 2' : '' };
    setFields((l) => [...l, f]);
    setOpen((s) => new Set(s).add(fid));
    setStatus(null);
  };
  const remove = (fid: string, label: string) => {
    if (!window.confirm(`Remove the field “${label || 'Untitled'}”? Existing submissions keep their saved answers.`)) return;
    setFields((l) => l.filter((f) => f.id !== fid));
  };

  const errors: string[] = [];
  if (!name.trim()) errors.push('Give the form a name.');
  if (!urlOk(settings.redirectUrl)) errors.push('The redirect address must start with https://, / or #.');
  const badEmail = settings.notifyEmails.split(/[,;\s]+/).filter(Boolean).find((e) => !EMAIL.test(e));
  if (badEmail) errors.push(`“${badEmail}” is not a valid email address.`);

  const save = () => {
    if (errors.length) return setStatus({ ok: false, text: errors[0] });
    start(async () => {
      const payload = {
        name,
        slug,
        fields: fields.map(({ optionsText, ...f }) => ({ ...f, options: f.type === 'select' ? optionsText.split(/\r?\n/) : undefined })),
        settings,
      };
      const r = await saveForm(id, payload);
      if (!('error' in r)) {
        if (id === 'new') {
          setSaved(snapshot(name, slug, fields, settings)); // so the leave-guard doesn't fire on our own redirect
          router.replace(`/admin/forms/${r.id}?saved=1`);
        } else {
          setSaved(snapshot(name, slug, fields, settings));
          setStatus({ ok: true, text: 'Saved.' });
        }
      } else {
        setStatus({ ok: false, text: r.error });
      }
    });
  };

  return (
    <div className="fm-wrap">
      <div className="fm-main">
        <div className="sc-card fm-bar">
          <div className="sc-field" style={{ flex: '2 1 260px' }}>
            <label htmlFor="fm-name">Form name <span className="sc-req">*</span></label>
            <input id="fm-name" className="sc-input" value={name} maxLength={120} placeholder="e.g. Request a callback" onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugOf(e.target.value)); }} />
          </div>
          <div className="sc-field" style={{ flex: '1 1 200px' }}>
            <label htmlFor="fm-slug">Slug</label>
            <input id="fm-slug" className="sc-input" value={slug} maxLength={80} readOnly={id !== 'new'} placeholder="auto" onChange={(e) => { setSlug(slugOf(e.target.value)); setSlugTouched(true); }} />
            <span className="sc-help">{id === 'new' ? 'Entries are filed under form:slug.' : 'Fixed after creation, so past entries stay together.'}</span>
          </div>
          <div className="fm-save">
            <button type="button" className="sc-btn sc-btn-primary" onClick={save} disabled={pending || (!dirty && id !== 'new')}>{pending ? 'Saving…' : id === 'new' ? 'Create form' : 'Save form'}</button>
            {dirty && !pending && id !== 'new' && <span className="sc-badge sc-badge-warn">Unsaved changes</span>}
          </div>
          {status && <div className={`sc-flash ${status.ok ? 'sc-flash-ok' : 'sc-flash-err'}`} role={status.ok ? 'status' : 'alert'} style={{ flexBasis: '100%', margin: 0 }}>{status.text}</div>}
        </div>

        <div className="sc-card">
          <h2>Fields <span className="sc-faint">({fields.length} / {MAX_FIELDS})</span></h2>
          {fields.length === 0 && <div className="sc-muted" style={{ marginBottom: 12 }}>No fields yet — add one below.</div>}
          <ul className="fm-list">
            {fields.map((f, i) => {
              const isOpen = open.has(f.id);
              return (
                <li key={f.id} className="fm-field">
                  <div className={`fm-head${isOpen ? ' is-open' : ''}`}>
                    <button type="button" className="fm-title" onClick={() => toggle(f.id)} aria-expanded={isOpen}>
                      <span className="sc-badge">{typeName(f.type)}</span>
                      <strong>{f.label || 'Untitled field'}</strong>
                      {f.required && <span className="sc-req" title="Required">*</span>}
                      {f.width === 'half' && <span className="sc-faint">half width</span>}
                    </button>
                    <span className="fm-btns">
                      <button type="button" className="sc-btn sc-btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" title="Move up">↑</button>
                      <button type="button" className="sc-btn sc-btn-sm" onClick={() => move(i, 1)} disabled={i === fields.length - 1} aria-label="Move down" title="Move down">↓</button>
                      <button type="button" className="sc-btn sc-btn-sm" onClick={() => toggle(f.id)} aria-label={isOpen ? 'Collapse' : 'Edit'} title={isOpen ? 'Collapse' : 'Edit'}>{isOpen ? '▴' : '▾'}</button>
                      <button type="button" className="sc-btn sc-btn-sm sc-btn-danger" onClick={() => remove(f.id, f.label)} aria-label="Delete field" title="Delete field">×</button>
                    </span>
                  </div>
                  {isOpen && (
                    <div className="fm-body">
                      <div className="sc-field">
                        <label htmlFor={`fl-${f.id}`}>Label</label>
                        <input id={`fl-${f.id}`} className="sc-input" value={f.label} maxLength={120} onChange={(e) => patch(f.id, { label: e.target.value })} />
                      </div>
                      <div className="sc-field">
                        <label htmlFor={`ft-${f.id}`}>Field type</label>
                        <select id={`ft-${f.id}`} className="sc-select" value={f.type} onChange={(e) => patch(f.id, { type: e.target.value as FieldType, optionsText: e.target.value === 'select' && !f.optionsText ? 'Option 1\nOption 2' : f.optionsText })}>
                          {FIELD_TYPES.map((t) => (<option key={t.type} value={t.type}>{t.label}</option>))}
                        </select>
                      </div>
                      {hasPlaceholder(f.type) && (
                        <div className="sc-field">
                          <label htmlFor={`fp-${f.id}`}>Placeholder</label>
                          <input id={`fp-${f.id}`} className="sc-input" value={f.placeholder || ''} maxLength={200} onChange={(e) => patch(f.id, { placeholder: e.target.value })} />
                        </div>
                      )}
                      <div className="sc-field">
                        <label htmlFor={`fw-${f.id}`}>Width</label>
                        <select id={`fw-${f.id}`} className="sc-select" value={f.width} onChange={(e) => patch(f.id, { width: e.target.value as 'full' | 'half' })}>
                          <option value="full">Full width</option>
                          <option value="half">Half width (two per row)</option>
                        </select>
                      </div>
                      {f.type === 'select' && (
                        <div className="sc-field is-wide">
                          <label htmlFor={`fo-${f.id}`}>Options (one per line)</label>
                          <textarea id={`fo-${f.id}`} className="sc-textarea" rows={4} value={f.optionsText} onChange={(e) => patch(f.id, { optionsText: e.target.value })} />
                        </div>
                      )}
                      <div className="sc-field is-wide">
                        <label className="sc-check"><input type="checkbox" checked={!!f.required} onChange={(e) => patch(f.id, { required: e.target.checked })} /> Required{f.type === 'checkbox' ? ' (must be ticked)' : ''}</label>
                        <span className="sc-help">Field id: <code>{f.id}</code>{f.type === 'file' ? ' · accepted: PDF, DWG, DXF, XLS/XLSX, CSV, DOC/DOCX, TXT, PNG/JPG, ZIP — 10 MB each, 5 files per submission.' : ''}</span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="fm-add">
            <span className="sc-label">Add a field</span>
            <div className="fm-addbtns">
              {FIELD_TYPES.map((t) => (<button key={t.type} type="button" className="sc-btn sc-btn-sm" onClick={() => addField(t.type)} disabled={fields.length >= MAX_FIELDS}>+ {t.label}</button>))}
            </div>
          </div>
        </div>

        <div className="sc-card">
          <h2>Settings</h2>
          <div className="sc-form">
            <div className="sc-field">
              <label htmlFor="fs-btn">Submit button label</label>
              <input id="fs-btn" className="sc-input" value={settings.submitLabel} maxLength={60} onChange={(e) => setSettings({ ...settings, submitLabel: e.target.value })} />
            </div>
            <div className="sc-field">
              <label htmlFor="fs-redir">Redirect after sending (optional)</label>
              <input id="fs-redir" className="sc-input" value={settings.redirectUrl} maxLength={2000} placeholder="/thank-you" onChange={(e) => setSettings({ ...settings, redirectUrl: e.target.value })} />
              {!urlOk(settings.redirectUrl) ? <span className="sc-help" style={{ color: 'var(--sc-danger)' }}>Must start with https://, / or #.</span> : <span className="sc-help">Leave empty to show the success message instead.</span>}
            </div>
            <div className="sc-field is-wide">
              <label htmlFor="fs-msg">Success message</label>
              <textarea id="fs-msg" className="sc-textarea" rows={2} value={settings.successMessage} maxLength={500} onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })} />
            </div>
            <div className="sc-field is-wide">
              <label htmlFor="fs-mail">Send notifications to (optional)</label>
              <input id="fs-mail" className="sc-input" value={settings.notifyEmails} maxLength={1000} placeholder="sales@example.com, owner@example.com" onChange={(e) => setSettings({ ...settings, notifyEmails: e.target.value })} />
              <span className="sc-help">Comma-separated. Empty = the site-wide recipients from Settings (“Send new submissions to”).</span>
            </div>
            <div className="sc-field is-wide">
              <label className="sc-check"><input type="checkbox" checked disabled readOnly /> Save submissions in the CMS</label>
              <span className="sc-help">Always on — every entry is stored under Submissions, even if email isn’t configured.</span>
            </div>
          </div>
        </div>
      </div>

      <aside className="fm-side">
        <div className="sc-card">
          <h2>How to use it</h2>
          {id === 'new' ? (
            <p className="sc-muted" style={{ margin: 0 }}>Create the form first, then place it on a page with the <strong>Custom form</strong> widget (page builder → Dynamic → Custom form) and pick “{name || 'this form'}” in its settings.</p>
          ) : (
            <>
              <p className="sc-muted" style={{ margin: '0 0 10px' }}>Place it on a page with the <strong>Custom form</strong> widget and choose this form (id <code>{id}</code>) in its settings.</p>
              <div className="sc-muted" style={{ fontSize: 13 }}>
                {usage.length ? (
                  <>Currently on: {usage.map((u, k) => (<span key={`${u.kind}${u.id}`}>{k ? ', ' : ''}<Link className="sc-rowlink" href={`/admin/builder/${u.kind === 'page' ? 'page' : 'tpl'}-${u.id}`}>{u.title}</Link></span>))}</>
                ) : 'Not placed on any page yet.'}
              </div>
              <div style={{ marginTop: 10, fontSize: 13 }}>
                <Link className="sc-rowlink" href={submissionsHref}>{submissions} submission{submissions === 1 ? '' : 's'} →</Link>
              </div>
            </>
          )}
        </div>

        <div className="sc-card fm-preview">
          <h2>Preview</h2>
          <div className="fm-pv-grid">
            {fields.map((f) => (
              <div key={f.id} className={`fm-pv-field${f.width === 'half' ? ' is-half' : ''}`}>
                {f.type === 'checkbox' ? (
                  <label className="fm-pv-check"><input type="checkbox" disabled /> <span>{f.label}{f.required && ' *'}</span></label>
                ) : (
                  <>
                    <label>{f.label}{f.required && ' *'}</label>
                    {f.type === 'textarea' ? <textarea disabled rows={3} placeholder={f.placeholder} />
                      : f.type === 'select' ? (<select disabled><option>{f.optionsText.split(/\r?\n/)[0] || 'Select…'}</option></select>)
                      : <input disabled type={f.type === 'file' ? 'file' : f.type === 'date' ? 'date' : 'text'} placeholder={f.placeholder} />}
                  </>
                )}
              </div>
            ))}
            {fields.length === 0 && <div className="sc-faint">Add fields to see the form.</div>}
          </div>
          <div className="fm-pv-btn">{settings.submitLabel || DEFAULT_SUBMIT_LABEL}</div>
        </div>
      </aside>
    </div>
  );
}
