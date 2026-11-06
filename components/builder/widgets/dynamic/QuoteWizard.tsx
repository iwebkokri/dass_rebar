'use client';

// 4-step quote request wizard (project -> drawings -> materials -> details), posts to /api/forms (type=quote).
import { useId, useState } from 'react';
import { submitForm } from '@/lib/submit-form';
import { CheckIcon, Honeypot } from './shared';

const STEP_NAMES = ['Project', 'Drawings', 'Materials', 'Details'];
const ITEMS: [string, string, string][] = [
  ['b10', '10M black rebar', '6 m (19′-8″) bars'], ['b15', '15M black rebar', '6 m (19′-8″) bars'], ['b20', '20M black rebar', '6 m (19′-8″) bars'],
  ['e10', '10M epoxy-coated', 'Bars'], ['e15', '15M epoxy-coated', 'Bars'],
  ['g10', '10M GFRP', 'Bars'], ['g15', '15M GFRP', 'Bars'],
  ['m66', 'Welded wire mesh 6×6 6/6', 'Sheets'], ['m99', 'Welded wire mesh 6×6 9/9', 'Sheets'], ['m1010', 'Welded wire mesh 6×6 10/10', 'Sheets'],
];
const TYPES: [string, string, string][] = [
  ['fab', 'Cut, bent & delivered', 'Fabricated to your bar lists'],
  ['stock', 'Straight stock supply', 'Stock lengths, mesh, GFRP'],
  ['est', 'Estimate from drawings', 'Takeoff and detailing first'],
];
const SECTORS = ['Residential', 'ICI (industrial, commercial, institutional)', 'Civil / MTO infrastructure', 'Precast'];

export default function QuoteWizard() {
  const uid = useId();
  const [step, setStep] = useState(1);
  const [cust, setCust] = useState('No');
  const [ptype, setPtype] = useState('fab');
  const [q, setQ] = useState<Record<string, number>>({});
  const [f, setF] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const bind = (k: string, def = '') => ({ value: f[k] ?? def, onChange: (e: React.ChangeEvent<any>) => setF((s) => ({ ...s, [k]: e.target.value })) });
  const setQty = (id: string, v: number) => setQ((s) => ({ ...s, [id]: Math.max(0, v) }));
  const pct = step > 4 ? 100 : (step - 1) * 25;
  const shown = Math.min(step, 4);
  const itemCount = Object.values(q).filter((v) => v > 0).length;

  async function forward() {
    if (step < 4) { setStep(step + 1); setError(''); return; }
    if (busy) return;
    if (!f.loc?.trim() || !f.name?.trim() || !f.email?.trim() || !f.phone?.trim()) {
      setError('Please fill in your project location, name, email and phone.');
      return;
    }
    const data = new FormData();
    data.set('existing_customer', cust);
    data.set('need', TYPES.find((t) => t[0] === ptype)?.[1] || '');
    data.set('sector', f.sector ?? 'Residential');
    data.set('notes', f.notes || '');
    data.set('other_items', f.other || '');
    data.set('location', f.loc);
    data.set('name', f.name);
    data.set('company', f.co || '');
    data.set('email', f.email);
    data.set('phone', f.phone);
    data.set('website', f.website || '');
    data.set('items', JSON.stringify(ITEMS.filter(([id]) => (q[id] || 0) > 0).map(([id, label]) => ({ label, qty: q[id] }))));
    files.forEach((file) => data.append('files', file));
    setBusy(true);
    setError('');
    const res = await submitForm('quote', data);
    setBusy(false);
    if (res.ok) setStep(5);
    else setError(res.error || '');
  }

  function restart() {
    setStep(1); setQ({}); setF({}); setFiles([]); setError('');
  }

  return (
    <div className="dr-quote">
      <div className="dr-qt-progress">
        <div className="dr-qt-top"><span>Step {shown} of 4 — {STEP_NAMES[shown - 1]}</span><span className="dr-qt-pct">{pct}%</span></div>
        <div className="dr-qt-bar"><div className="dr-qt-fill" style={{ width: `${pct}%` }} /></div>
        <ol className="dr-qt-steps">
          {STEP_NAMES.map((label, n) => (
            <li key={label} className={`dr-qt-step${n + 1 <= step ? ' is-done' : ''}${n + 1 === step ? ' is-cur' : ''}`}>{n + 1}. {label}</li>
          ))}
        </ol>
      </div>

      {step === 1 && (
        <div className="dr-qt-body">
          <fieldset className="dr-qt-fs">
            <legend className="dr-qt-legend">Are you already a Dass Rebar customer? *</legend>
            <div className="dr-qt-pills">
              {['Yes', 'No'].map((label) => (
                <button key={label} type="button" className="dr-qt-pill" aria-pressed={cust === label} onClick={() => setCust(label)}>{label}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="dr-qt-fs">
            <legend className="dr-qt-legend">What do you need? *</legend>
            <div className="dr-qt-types">
              {TYPES.map(([id, label, desc]) => (
                <button key={id} type="button" className="dr-qt-type" aria-pressed={ptype === id} onClick={() => setPtype(id)}>
                  <span className="dr-qt-type-t">{label}</span>
                  <span className="dr-qt-type-d">{desc}</span>
                </button>
              ))}
            </div>
          </fieldset>
          <div className="dr-fld dr-fld--narrow">
            <label htmlFor={`${uid}-sector`} className="dr-fld-label">Sector</label>
            <select id={`${uid}-sector`} className="dr-input" {...bind('sector', 'Residential')}>
              {SECTORS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="dr-qt-body">
          <h2 className="dr-qt-h">Attach your drawings</h2>
          <label htmlFor={`${uid}-files`} className="dr-drop">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#7F5F47" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
            <span className="dr-drop-t">Drop files here or browse</span>
            <span className="dr-drop-d">Structural drawings, bar lists or sketches — PDF, DWG, XLS (max 10 MB each)</span>
            <input id={`${uid}-files`} type="file" multiple accept=".pdf,.dwg,.dxf,.xls,.xlsx,.csv,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            {files.length > 0 && <span className="dr-drop-files">{files.map((x) => x.name).join(', ')}</span>}
          </label>
          <div className="dr-fld">
            <label htmlFor={`${uid}-notes`} className="dr-fld-label">Notes for the estimator</label>
            <textarea id={`${uid}-notes`} className="dr-input dr-input--area" {...bind('notes')} maxLength={5000} rows={4} />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="dr-qt-body">
          <div className="dr-qt-hgroup"><h2 className="dr-qt-h">Materials (optional)</h2><span className="dr-qt-sub">Skip this step if you attached drawings.</span></div>
          <div className="dr-qt-items">
            {ITEMS.map(([id, label, unit]) => {
              const v = q[id] || 0;
              return (
                <div key={id} className={`dr-qt-item${v > 0 ? ' is-on' : ''}`}>
                  <div className="dr-qt-item-l"><span className="dr-qt-item-t">{label}</span><span className="dr-qt-item-u">{unit}</span></div>
                  <div className="dr-qt-qty">
                    <button type="button" className="dr-qt-dec" onClick={() => setQty(id, v - 1)} aria-label={`Decrease ${label}`}>−</button>
                    <span aria-live="polite" className="dr-qt-n">{v}</span>
                    <button type="button" className="dr-qt-inc" onClick={() => setQty(id, v + 1)} aria-label={`Increase ${label}`}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="dr-fld">
            <label htmlFor={`${uid}-other`} className="dr-fld-label">Other items (sizes, lengths, couplers, 500W…)</label>
            <textarea id={`${uid}-other`} className="dr-input dr-input--area" {...bind('other')} maxLength={3000} rows={3} />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="dr-qt-grid">
          <h2 className="dr-qt-h dr-fld--full">Your details</h2>
          <Honeypot value={f.website || ''} onChange={(v) => setF((s) => ({ ...s, website: v }))} />
          <div className="dr-fld dr-fld--full">
            <label htmlFor={`${uid}-loc`} className="dr-fld-label">Project location *</label>
            <input id={`${uid}-loc`} className="dr-input" type="text" {...bind('loc')} />
          </div>
          <div className="dr-fld">
            <label htmlFor={`${uid}-name`} className="dr-fld-label">Full name *</label>
            <input id={`${uid}-name`} className="dr-input" type="text" autoComplete="name" {...bind('name')} />
          </div>
          <div className="dr-fld">
            <label htmlFor={`${uid}-co`} className="dr-fld-label">Company</label>
            <input id={`${uid}-co`} className="dr-input" type="text" autoComplete="organization" {...bind('co')} />
          </div>
          <div className="dr-fld">
            <label htmlFor={`${uid}-email`} className="dr-fld-label">Email *</label>
            <input id={`${uid}-email`} className="dr-input" type="email" autoComplete="email" {...bind('email')} />
          </div>
          <div className="dr-fld">
            <label htmlFor={`${uid}-phone`} className="dr-fld-label">Phone *</label>
            <input id={`${uid}-phone`} className="dr-input" type="tel" autoComplete="tel" {...bind('phone')} />
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="dr-done">
          <CheckIcon />
          <h2 className="dr-done-h">Quote request sent</h2>
          <p className="dr-done-text">Thanks — our estimating team will review your request ({itemCount} material lines) and contact you shortly.</p>
          <button type="button" className="dr-fbtn dr-fbtn-ghost" onClick={restart}>Start a new request</button>
        </div>
      )}

      {error ? <p role="alert" className="dr-error">{error}</p> : null}
      {step <= 4 && (
        <div className="dr-qt-nav">
          {step > 1 ? <button type="button" className="dr-fbtn dr-fbtn-ghost" onClick={() => setStep(step - 1)}>Previous</button> : <span />}
          <button type="button" className="dr-fbtn dr-fbtn-main dr-form-submit" onClick={forward} disabled={busy}>{busy ? 'Sending…' : step === 4 ? 'Submit request' : 'Next'}</button>
        </div>
      )}
    </div>
  );
}
