'use client';

// Rebar weight calculator: `compact` (home page card with a link button) and `full` (calculator page: calculator + quote request).
import { useId, useState } from 'react';
import { submitForm } from '@/lib/submit-form';
import { CheckIcon, Honeypot, SafeLink } from './shared';

export type CalcBar = { id: number; bar_size: string; mass_kg_m: number; nominal_diameter_mm: number; on_request?: number };

type Props = {
  bars: CalcBar[];
  variant: 'compact' | 'full';
  edit?: boolean;
  ctaLabel?: string;
  ctaUrl?: string;
  calcTitle?: string;
  quoteTitle?: string;
  quoteButton?: string;
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-CA');

export default function Calculator({ bars, variant, edit, ctaLabel, ctaUrl, calcTitle, quoteTitle, quoteButton }: Props) {
  const uid = useId();
  const sizes = bars.filter((b) => !b.on_request).map((b) => ({ id: b.bar_size, d: Number(b.nominal_diameter_mm) || 0, m: Number(b.mass_kg_m) || 0 }));
  const [size, setSize] = useState('15M');
  const [len, setLen] = useState('12');
  const [qty, setQty] = useState('100');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const cur = sizes.find((s) => s.id === size) || sizes[1] || sizes[0] || { id: '—', d: 0, m: 0 };
  const L = parseFloat(len) || 0;
  const Q = parseFloat(qty) || 0;
  const full = variant === 'full';
  let warn = '';
  if (full) {
    if (L > 18) warn = 'Please enter a length from 0 to 18 m.';
    else if (Q < 1) warn = 'Please enter at least 1 bar.';
  }
  const kg = warn ? 0 : cur.m * L * Q;
  const totalKg = fmt(kg);
  const tonnes = (kg / 1000).toFixed(2);
  const metres = fmt(warn ? 0 : L * Q);

  const chips = (
    <div className="dr-chip-row">
      {sizes.map((s) => (
        <button key={s.id} type="button" className="dr-size-btn" aria-pressed={s.id === cur.id} onClick={() => setSize(s.id)}>
          {s.id}
        </button>
      ))}
    </div>
  );

  if (!full) {
    return (
      <div className="dr-calc">
        <div className="dr-calc-group">
          <span className="dr-calc-label">Bar size</span>
          {chips}
        </div>
        <div className="dr-calc-2">
          <div className="dr-fld">
            <label htmlFor={`${uid}-len`} className="dr-calc-label">Length per bar (m)</label>
            <input id={`${uid}-len`} className="dr-input dr-input--calc" type="number" min="0" step="0.5" value={len} onChange={(e) => setLen(e.target.value)} />
          </div>
          <div className="dr-fld">
            <label htmlFor={`${uid}-qty`} className="dr-calc-label">Number of bars</label>
            <input id={`${uid}-qty`} className="dr-input dr-input--calc" type="number" min="0" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
        <div className="dr-calc-result dr-calc-result--row">
          <div className="dr-calc-res-main">
            <span className="dr-calc-sub">Total mass</span>
            <span className="dr-calc-big">{totalKg} <span className="dr-calc-unit">kg</span></span>
          </div>
          <div className="dr-calc-res-side">
            <span>{tonnes} tonnes</span>
            <span>{metres} m of {cur.id}</span>
          </div>
        </div>
        {ctaUrl ? (
          <SafeLink href={ctaUrl} edit={edit} className="dr-calc-cta">{ctaLabel || 'Open full calculator & quote'}</SafeLink>
        ) : null}
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy || warn) return;
    const data = new FormData(e.currentTarget);
    data.set('size', cur.id);
    data.set('length', String(L));
    data.set('bars', String(Q));
    data.set('total_kg', String(Math.round(kg)));
    setBusy(true);
    setError('');
    const res = await submitForm('calculator', data);
    setBusy(false);
    if (res.ok) setSent(true);
    else setError(res.error || '');
  }

  return (
    <div className="dr-calc-full">
      <div className="dr-calc-main">
        <h2 className="dr-calc-h">{calcTitle || 'Steel bar mass calculator'}</h2>
        <div className="dr-calc-group">
          <span className="dr-calc-label">Bar size <span className="dr-calc-dim">(required)</span></span>
          {chips}
        </div>
        <div className="dr-calc-2">
          <div className="dr-fld">
            <label htmlFor={`${uid}-qty`} className="dr-calc-label"># of bars <span className="dr-calc-dim">(min 1)</span></label>
            <input id={`${uid}-qty`} className="dr-input dr-input--calc" type="number" min="1" step="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="dr-fld">
            <label htmlFor={`${uid}-len`} className="dr-calc-label">Bar length, m <span className="dr-calc-dim">(0–18)</span></label>
            <input id={`${uid}-len`} className="dr-input dr-input--calc" type="number" min="0" max="18" step="0.1" value={len} onChange={(e) => setLen(e.target.value)} />
          </div>
        </div>
        {warn ? <p className="dr-calc-warn">{warn}</p> : null}
        <div className="dr-calc-result">
          <span className="dr-calc-cap">METRIC MASS RESULT</span>
          <span className="dr-calc-huge">{totalKg} <span className="dr-calc-unit dr-calc-unit--lg">kg</span></span>
          <div className="dr-calc-facts">
            <span>{tonnes} t</span>
            <span>{metres} m of {cur.id}</span>
            <span>{cur.m.toFixed(3)} kg/m · Ø {cur.d.toFixed(1)} mm</span>
          </div>
        </div>
      </div>

      <div className="dr-calc-side">
        {!sent ? (
          <form onSubmit={submit} className="dr-form-col">
            <h2 className="dr-calc-h dr-calc-h--light">{quoteTitle || 'Quote this order'}</h2>
            <p className="dr-calc-note">We’ll attach your calculation: <strong>{qty} × {cur.id} at {len} m</strong>.</p>
            <div className="dr-fld">
              <label htmlFor={`${uid}-name`} className="dr-fld-label">Name <span className="dr-fld-dim">(required)</span></label>
              <input id={`${uid}-name`} className="dr-input" name="name" required type="text" autoComplete="name" />
            </div>
            <div className="dr-fld">
              <label htmlFor={`${uid}-email`} className="dr-fld-label">Email</label>
              <input id={`${uid}-email`} className="dr-input" name="email" type="email" autoComplete="email" />
            </div>
            <div className="dr-fld">
              <label htmlFor={`${uid}-phone`} className="dr-fld-label">Phone <span className="dr-fld-dim">(required)</span></label>
              <input id={`${uid}-phone`} className="dr-input" name="phone" required type="tel" autoComplete="tel" />
            </div>
            <Honeypot />
            {error ? <p role="alert" className="dr-error">{error}</p> : null}
            <button type="submit" disabled={busy} className="dr-fbtn dr-fbtn-main dr-form-submit">{busy ? 'Sending…' : quoteButton || 'I’d like to receive a quote'}</button>
          </form>
        ) : (
          <div className="dr-done">
            <CheckIcon />
            <h2 className="dr-calc-h dr-calc-h--light">Request sent</h2>
            <p className="dr-done-text">Thanks — our estimators will be in touch about {totalKg} kg of {cur.id}.</p>
            <button type="button" className="dr-fbtn dr-fbtn-ghost" onClick={() => setSent(false)}>Start a new calculation</button>
          </div>
        )}
      </div>
    </div>
  );
}
