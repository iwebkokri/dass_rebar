'use client';

// Tracking IDs + custom code form. Controlled inputs, so a rejected ID never costs anyone the code they typed.
import { useActionState, useState } from 'react';
import { saveTracking, type TrackingState } from '@/app/admin/tracking/actions';
import { TRACKER_FIELDS, trackKey } from '@/lib/tracking-core.mjs';

type Initial = Record<string, string | boolean>;

const START: TrackingState = { ok: false, errors: {}, warnings: [] };

export default function TrackingForm({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState(saveTracking, START);
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(TRACKER_FIELDS.map((f: { key: string }) => [f.key, String(initial[f.key] ?? '')])));
  const [skip, setSkip] = useState(!!initial.skipUsers);
  const [code, setCode] = useState({ code_css: String(initial.code_css ?? ''), code_head: String(initial.code_head ?? ''), code_body: String(initial.code_body ?? ''), code_footer: String(initial.code_footer ?? '') });
  const bothGoogle = !!(v.ga4.trim() && v.gtm.trim());

  return (
    <form action={action} className="sc-stack" aria-busy={pending}>
      {state.saved && <div className="sc-flash sc-flash-ok" role="status">Saved. The public site picks the change up immediately.</div>}
      {Object.keys(state.errors).length > 0 && (
        <div className="sc-flash sc-flash-err" role="alert">
          Nothing was saved — please fix {Object.keys(state.errors).length === 1 ? 'this ID' : 'these IDs'}:
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{Object.values(state.errors).map((m, i) => (<li key={i}>{m}</li>))}</ul>
        </div>
      )}
      {state.warnings.map((w, i) => (<div key={i} className="sc-flash sc-flash-warn" role="status">{w}</div>))}

      <section className="sc-card sc-form" aria-labelledby="trk-ids">
        <h2 id="trk-ids" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Analytics &amp; advertising pixels</h2>
        <p className="se-lead" style={{ gridColumn: '1 / -1', margin: 0 }}>Paste only the ID — the standard snippet is added for you, and only on the public site (never in the admin or the page builder).</p>
        {(TRACKER_FIELDS as { key: string; label: string; placeholder: string; help: string }[]).map((f) => (
          <div className="sc-field" key={f.key}>
            <label htmlFor={`trk-${f.key}`}>{f.label}</label>
            <input
              className="sc-input" id={`trk-${f.key}`} name={trackKey(f.key)} value={v[f.key]} placeholder={f.placeholder} maxLength={40} autoComplete="off" spellCheck={false}
              aria-invalid={state.errors[f.key] ? true : undefined} aria-describedby={`trk-${f.key}-h`}
              onChange={(e) => setV((s) => ({ ...s, [f.key]: e.target.value }))}
            />
            <span id={`trk-${f.key}-h`} className={state.errors[f.key] ? 'sc-help' : 'sc-help'} style={state.errors[f.key] ? { color: 'var(--sc-danger)' } : undefined}>{state.errors[f.key] || f.help}</span>
          </div>
        ))}
        {bothGoogle && <div className="sc-flash sc-flash-warn" style={{ gridColumn: '1 / -1', margin: 0 }}>You set both Tag Manager and Analytics 4. Both will load — but if your GTM container already sends GA4 page views, remove the GA4 ID here so visits aren’t counted twice.</div>}
        <div className="sc-field is-wide">
          <label className="sc-check"><input type="checkbox" name="track_skip_users" checked={skip} onChange={(e) => setSkip(e.target.checked)} /> Don’t track signed-in admin / editor users</label>
          <span className="sc-help">Recommended: your own visits while editing are left out of the numbers. Applies to the pixels above only — your custom code below is always output.</span>
        </div>
        <div className="sc-flash sc-flash-warn" style={{ gridColumn: '1 / -1', margin: 0 }}>
          <b>Privacy:</b> this site does not include a cookie-consent banner. Analytics and advertising pixels set cookies and share visitor data with third parties; for visitors in the EU, UK or Canada you will likely need a consent tool (for example through Google Tag Manager’s consent mode or a CMP) before these load.
        </div>
      </section>

      <section className="sc-card" aria-labelledby="trk-css">
        <h2 id="trk-css">Custom CSS</h2>
        <p className="se-lead">Applied to every public page — and shown inside the page builder, so you can see your changes while editing.</p>
        <div className="sc-field">
          <textarea className="sc-textarea se-code" name="code_css" rows={9} value={code.code_css} onChange={(e) => setCode((c) => ({ ...c, code_css: e.target.value }))} spellCheck={false} aria-label="Custom CSS" placeholder={'.dr-btn { border-radius: 4px; }'} />
        </div>
      </section>

      <section className="sc-card" aria-labelledby="trk-code">
        <h2 id="trk-code">Custom code (JavaScript / HTML)</h2>
        <div className="sc-flash sc-flash-warn" style={{ marginTop: 0 }}>
          <b>Administrators only — and powerful.</b> This code is output exactly as typed on every public page and runs for every visitor, with the same access as the site itself. Only paste code from sources you trust. It is never added to the admin or the page builder.
        </div>
        <div className="sc-stack" style={{ gap: 18 }}>
          <div className="sc-field">
            <label htmlFor="trk-head">Header code <span className="sc-faint">(inside &lt;head&gt;)</span></label>
            <textarea className="sc-textarea se-code" id="trk-head" name="code_head" rows={6} value={code.code_head} onChange={(e) => setCode((c) => ({ ...c, code_head: e.target.value }))} spellCheck={false} placeholder={'<script src="https://example.com/widget.js" async></script>\n<meta name="theme-color" content="#182845">'} />
            <span className="sc-help">Script, style, link, meta, noscript and base tags only — other tags can’t go in &lt;head&gt; and are ignored. Inline event attributes (onload=…) are dropped; use a script instead.</span>
          </div>
          <div className="sc-field">
            <label htmlFor="trk-body">Body-open code <span className="sc-faint">(right after &lt;body&gt;)</span></label>
            <textarea className="sc-textarea se-code" id="trk-body" name="code_body" rows={4} value={code.code_body} onChange={(e) => setCode((c) => ({ ...c, code_body: e.target.value }))} spellCheck={false} placeholder="Anything that must come first in the page, e.g. a <noscript> fallback." />
          </div>
          <div className="sc-field">
            <label htmlFor="trk-foot">Footer code <span className="sc-faint">(just before &lt;/body&gt;)</span></label>
            <textarea className="sc-textarea se-code" id="trk-foot" name="code_footer" rows={6} value={code.code_footer} onChange={(e) => setCode((c) => ({ ...c, code_footer: e.target.value }))} spellCheck={false} placeholder="Chat widgets and other scripts that can load last." />
          </div>
        </div>
      </section>

      <div className="sc-settings-save">
        <button className="sc-btn sc-btn-primary" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save tracking & code'}</button>
      </div>
    </form>
  );
}
