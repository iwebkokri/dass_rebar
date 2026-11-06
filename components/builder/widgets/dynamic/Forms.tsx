'use client';

// Public forms: contact form, newsletter signup and the custom (admin-built) form. All post to /api/forms through lib/submit-form.
import { useId, useState } from 'react';
import { submitForm } from '@/lib/submit-form';
import { safeUrl } from '@/lib/builder/url.mjs';
import type { FormDef, FormField } from '@/lib/builder/types';
import { CheckIcon, Honeypot } from './shared';

/* ------------------------------------------------------------------ contact */

export function ContactForm({ title, buttonLabel, successTitle, successText }: { title?: string; buttonLabel?: string; successTitle?: string; successText?: string }) {
  const uid = useId();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    const res = await submitForm('contact', data);
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(res.error || '');
  }

  return (
    <div className="dr-contact">
      {!sent ? (
        <form onSubmit={submit} className="dr-form-col dr-form-col--lg">
          <div className="dr-contact-head">
            <h2 className="dr-contact-h">{title || 'Get in touch with us today'}</h2>
            <span className="dr-fld-dim">Fields marked * are required.</span>
          </div>
          <div className="dr-form-grid">
            <div className="dr-fld">
              <label htmlFor={`${uid}-first`} className="dr-fld-label">First name *</label>
              <input id={`${uid}-first`} className="dr-input" name="first_name" required type="text" autoComplete="given-name" />
            </div>
            <div className="dr-fld">
              <label htmlFor={`${uid}-last`} className="dr-fld-label">Last name *</label>
              <input id={`${uid}-last`} className="dr-input" name="last_name" required type="text" autoComplete="family-name" />
            </div>
            <div className="dr-fld">
              <label htmlFor={`${uid}-email`} className="dr-fld-label">Email *</label>
              <input id={`${uid}-email`} className="dr-input" name="email" required type="email" autoComplete="email" />
            </div>
            <div className="dr-fld">
              <label htmlFor={`${uid}-phone`} className="dr-fld-label">Phone *</label>
              <input id={`${uid}-phone`} className="dr-input" name="phone" required type="tel" autoComplete="tel" />
            </div>
            <div className="dr-fld dr-fld--full">
              <label htmlFor={`${uid}-company`} className="dr-fld-label">Company *</label>
              <input id={`${uid}-company`} className="dr-input" name="company" required type="text" autoComplete="organization" />
            </div>
            <div className="dr-fld dr-fld--full">
              <label htmlFor={`${uid}-files`} className="dr-fld-label">Drawings (optional)</label>
              <input id={`${uid}-files`} className="dr-input dr-input--file" name="files" type="file" multiple accept=".pdf,.dwg,.dxf,.xls,.xlsx,.csv,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip" />
            </div>
            <div className="dr-fld dr-fld--full">
              <label htmlFor={`${uid}-note`} className="dr-fld-label">Special note</label>
              <textarea id={`${uid}-note`} className="dr-input dr-input--area" name="message" maxLength={5000} rows={4} />
            </div>
          </div>
          <fieldset className="dr-qt-fs">
            <legend className="dr-fld-label dr-legend">I agree to receive newsletters and marketing updates *</legend>
            <div className="dr-radios">
              <label className="dr-radio"><input type="radio" name="consent" value="yes" required /> Yes</label>
              <label className="dr-radio"><input type="radio" name="consent" value="no" /> No</label>
            </div>
          </fieldset>
          <Honeypot />
          {error ? <p role="alert" className="dr-error">{error}</p> : null}
          <button type="submit" disabled={busy} className="dr-fbtn dr-fbtn-main dr-form-submit dr-fbtn--start">{busy ? 'Sending…' : buttonLabel || 'Submit'}</button>
        </form>
      ) : (
        <div className="dr-done">
          <CheckIcon />
          <h2 className="dr-done-h">{successTitle || 'Message received'}</h2>
          <p className="dr-done-text">{successText || 'Thanks for reaching out — our team will get back to you shortly.'}</p>
          <button type="button" className="dr-fbtn dr-fbtn-ghost" onClick={() => setSent(false)}>Send another message</button>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- newsletter */

export function Newsletter({ placeholder, buttonLabel, successText }: { placeholder?: string; buttonLabel?: string; successText?: string }) {
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function subscribe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setMsg(null);
    const res = await submitForm('newsletter', data);
    setBusy(false);
    if (res.ok) form.reset();
    setMsg({ ok: res.ok, text: res.ok ? successText || 'Thanks — you’re subscribed.' : res.error || 'Something went wrong.' });
  }

  return (
    <form onSubmit={subscribe} className="dr-nl">
      <label htmlFor={`${uid}-em`} className="dr-sr">Email address</label>
      <input id={`${uid}-em`} className="dr-nl-input" name="email" required type="email" placeholder={placeholder || 'Email address'} />
      <Honeypot />
      <button type="submit" disabled={busy} className="dr-nl-btn">{busy ? '…' : buttonLabel || 'Subscribe'}</button>
      {msg ? <span role="status" className={`dr-nl-msg${msg.ok ? '' : ' is-err'}`}>{msg.text}</span> : null}
    </form>
  );
}

/* -------------------------------------------------------------- custom form */

function Field({ f, id }: { f: FormField; id: string }) {
  const req = !!f.required;
  const base = { id, name: f.id, required: req };
  const label = <label htmlFor={id} className="dr-fld-label">{f.label}{req ? ' *' : ''}</label>;
  const cls = `dr-fld${f.width === 'half' ? '' : ' dr-fld--full'}`;

  if (f.type === 'checkbox') {
    return (
      <div className={cls}>
        <label className="dr-check">
          <input type="checkbox" value="Yes" {...base} />
          <span>{f.label}{req ? ' *' : ''}</span>
        </label>
      </div>
    );
  }
  if (f.type === 'textarea') {
    return <div className={cls}>{label}<textarea {...base} className="dr-input dr-input--area dr-form-field" rows={4} maxLength={5000} placeholder={f.placeholder || undefined} /></div>;
  }
  if (f.type === 'select') {
    return (
      <div className={cls}>
        {label}
        <select {...base} className="dr-input dr-form-field" defaultValue="">
          <option value="" disabled={req}>{f.placeholder || 'Select…'}</option>
          {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (f.type === 'file') {
    return <div className={cls}>{label}<input {...base} type="file" className="dr-input dr-input--file dr-form-field" /></div>;
  }
  const type = ['text', 'email', 'tel', 'number', 'date'].includes(f.type) ? f.type : 'text';
  return <div className={cls}>{label}<input {...base} type={type} className="dr-input dr-form-field" placeholder={f.placeholder || undefined} autoComplete={type === 'email' ? 'email' : type === 'tel' ? 'tel' : undefined} /></div>;
}

export function CustomForm({ form }: { form: FormDef }) {
  const uid = useId();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const st = form.settings || {};

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const target = e.currentTarget;
    const data = new FormData(target);
    data.set('form_id', String(form.id));
    setBusy(true);
    setError('');
    const res = await submitForm('form', data);
    setBusy(false);
    if (!res.ok) { setError(res.error || ''); return; }
    const redirect = st.redirectUrl ? safeUrl(st.redirectUrl) : '';
    if (redirect) { window.location.assign(redirect); return; }
    target.reset();
    setSent(true);
  }

  if (sent) {
    return (
      <div className="dr-done">
        <CheckIcon />
        <p className="dr-done-text dr-done-text--lg" role="status">{st.successMessage || 'Thanks — your message has been sent.'}</p>
        <button type="button" className="dr-fbtn dr-fbtn-ghost" onClick={() => setSent(false)}>Send another</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="dr-form" noValidate={false}>
      <div className="dr-form-grid">
        {(form.fields || []).map((f) => <Field key={f.id} f={f} id={`${uid}-${f.id}`} />)}
      </div>
      <Honeypot />
      {error ? <p role="alert" className="dr-error">{error}</p> : null}
      <button type="submit" disabled={busy} className="dr-fbtn dr-fbtn-main dr-form-submit dr-fbtn--start">{busy ? 'Sending…' : st.submitLabel || 'Submit'}</button>
    </form>
  );
}
