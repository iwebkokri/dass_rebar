'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { submitWith } from './ToolsSubmit';
import { saveRedirectAction, type RedirectFormState } from '@/app/admin/redirects/actions';

type Initial = { id: number; from: string; to: string; code: number; enabled: boolean };

/** Add / edit one redirect. Fields are controlled so a validation error doesn't wipe what was typed. */
export function RedirectsForm({ initial }: { initial?: Initial }) {
  const [state, action, pending] = useActionState<RedirectFormState, FormData>(saveRedirectAction.bind(null, initial?.id ?? 0), {});
  const [from, setFrom] = useState(initial?.from ?? '');
  const [to, setTo] = useState(initial?.to ?? '');
  const [code, setCode] = useState(String(initial?.code ?? 301));
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [allow, setAllow] = useState(false);

  return (
    <form onSubmit={submitWith(action)} className="sc-card sc-form sc-redir-form" id="redirect-form">
      <h2 style={{ gridColumn: '1 / -1', marginBottom: 0 }}>{initial ? 'Edit redirect' : 'Add a redirect'}</h2>
      {state.error && <div className="sc-flash sc-flash-err" role="alert" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>{state.error}</div>}
      <div className="sc-field">
        <label htmlFor="r-from">Old address (from)</label>
        <input className="sc-input" id="r-from" name="from" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="/old-page" maxLength={300} required autoComplete="off" />
        <span className="sc-help">A path on this site, e.g. /services/old-name. Starts with “/”.</span>
      </div>
      <div className="sc-field">
        <label htmlFor="r-to">New address (to)</label>
        <input className="sc-input" id="r-to" name="to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="/new-page or https://…" maxLength={2000} required autoComplete="off" />
        <span className="sc-help">A path on this site, or a full https:// address.</span>
      </div>
      <div className="sc-field">
        <label htmlFor="r-code">Type</label>
        <select className="sc-select" id="r-code" name="code" value={code} onChange={(e) => setCode(e.target.value)} style={{ maxWidth: 320 }}>
          <option value="301">301 — moved permanently (SEO-friendly)</option>
          <option value="302">302 — found (temporary)</option>
          <option value="307">307 — temporary, keeps the request method</option>
          <option value="308">308 — permanent, keeps the request method</option>
        </select>
      </div>
      <div className="sc-field">
        <span className="sc-label">Status</span>
        <label className="sc-check"><input type="checkbox" name="enabled" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled</label>
      </div>
      {state.needsConfirm && (
        <div className="sc-field is-wide">
          <label className="sc-check"><input type="checkbox" name="allow_page" checked={allow} onChange={(e) => setAllow(e.target.checked)} /> Redirect anyway — I know a published page exists at the old address</label>
        </div>
      )}
      <div className="sc-form-actions">
        <button className="sc-btn sc-btn-primary" type="submit" disabled={pending}>{pending ? 'Saving…' : initial ? 'Save changes' : 'Add redirect'}</button>
        {initial && <Link className="sc-btn" href="/admin/redirects">Cancel</Link>}
      </div>
    </form>
  );
}
