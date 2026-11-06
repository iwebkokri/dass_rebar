'use client';

import { useState } from 'react';

type Counts = { created: number; updated: number; skipped: number; deleted: number; notes: string[] };
type Result = {
  ok: boolean;
  error?: string;
  dry?: boolean;
  mode?: 'merge' | 'replace';
  present?: string[];
  types?: string[];
  exportedAt?: string;
  ignored?: string[];
  summary?: Record<string, Counts>;
};

const MAX = 20 * 1024 * 1024;

/** Upload an export file → dry run (nothing is written) → choose what to import → apply in one transaction. */
export function ToolsImport({ labels }: { labels: Record<string, string> }) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState(false);

  async function send(dry: boolean) {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set('file', file);
      fd.set('mode', mode);
      fd.set('dry', dry ? '1' : '0');
      fd.set('types', [...picked].join(','));
      const r = await fetch('/admin/tools/import', { method: 'POST', body: fd, credentials: 'same-origin' });
      const body: Result = await r.json().catch(() => ({ ok: false, error: `Unexpected response (${r.status}).` }));
      setRes(body);
      if (body.ok && dry && picked.size === 0) setPicked(new Set(body.present ?? []));
      setApplied(!!body.ok && !dry);
    } catch {
      setRes({ ok: false, error: 'The upload failed. Check your connection and try again.' });
    } finally {
      setBusy(false);
    }
  }

  const rows = res?.ok ? (res.present ?? []).map((t) => ({ t, c: res.summary?.[t] })) : [];
  const replaceWarning = mode === 'replace' ? 'Replace mode DELETES the existing items of every selected type before importing. Continue?' : '';

  return (
    <div className="sc-card">
      <h2>Import</h2>
      <p className="sc-muted" style={{ margin: '0 0 14px' }}>Upload a file made by Export. You will see exactly what would change before anything is written.</p>

      <div className="sc-field">
        <label htmlFor="imp-file">Export file (.json, up to 20 MB)</label>
        <input
          className="sc-input"
          id="imp-file"
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setRes(f && f.size > MAX ? { ok: false, error: 'That file is larger than 20 MB.' } : null);
            setFile(f && f.size <= MAX ? f : null);
            setPicked(new Set());
            setApplied(false);
          }}
        />
      </div>

      <div className="sc-field" style={{ marginTop: 14 }}>
        <span className="sc-label">Mode</span>
        <label className="sc-check"><input type="radio" name="imp-mode" checked={mode === 'merge'} onChange={() => { setMode('merge'); setApplied(false); }} /> Merge — add new items and update existing ones that match (page path, template name, menu / form / post / project slug, redirect address…)</label>
        <label className="sc-check"><input type="radio" name="imp-mode" checked={mode === 'replace'} onChange={() => { setMode('replace'); setApplied(false); }} /> Replace — wipe the existing items of each selected type, then import the file</label>
      </div>

      <div className="sc-actions" style={{ marginTop: 16 }}>
        <button className="sc-btn" type="button" disabled={!file || busy} onClick={() => send(true)}>{busy ? 'Checking…' : 'Check file (dry run)'}</button>
      </div>

      {res && !res.ok && <div className="sc-flash sc-flash-err" role="alert" style={{ marginTop: 16, marginBottom: 0 }}>{res.error}</div>}

      {res?.ok && (
        <div style={{ marginTop: 16 }}>
          <div className={`sc-flash ${applied ? 'sc-flash-ok' : 'sc-flash-warn'}`} role="status">
            {applied
              ? 'Import finished. The numbers below are what was applied.'
              : `Dry run only — nothing has been changed yet.${res.exportedAt ? ` File exported ${res.exportedAt.slice(0, 10)}.` : ''}`}
          </div>
          <div className="sc-tablewrap">
            <table className="sc-table">
              <thead>
                <tr><th>{applied ? '' : 'Import'}</th><th>Type</th><th className="sc-num">New</th><th className="sc-num">Updated</th><th className="sc-num">Skipped</th>{res.mode === 'replace' && <th className="sc-num">Removed first</th>}<th>Notes</th></tr>
              </thead>
              <tbody>
                {rows.map(({ t, c }) => (
                  <tr key={t}>
                    <td>
                      {!applied && (
                        <input
                          type="checkbox"
                          aria-label={`Import ${labels[t] ?? t}`}
                          checked={picked.has(t)}
                          onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(t)) n.delete(t); else n.add(t); return n; })}
                        />
                      )}
                    </td>
                    <td className="sc-strong">{labels[t] ?? t}</td>
                    {c ? (
                      <>
                        <td className="sc-num">{c.created}</td>
                        <td className="sc-num">{c.updated}</td>
                        <td className="sc-num">{c.skipped > 0 ? <span className="sc-badge sc-badge-warn">{c.skipped}</span> : 0}</td>
                        {res.mode === 'replace' && <td className="sc-num">{c.deleted}</td>}
                        <td className="sc-muted sc-tools-notes">{c.notes.map((n, i) => (<div key={i}>{n}</div>))}</td>
                      </>
                    ) : (
                      <td colSpan={res.mode === 'replace' ? 5 : 4} className="sc-muted">not selected</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res.ignored && res.ignored.length > 0 && <p className="sc-muted">Ignored unknown sections: {res.ignored.join(', ')}.</p>}
          {!applied && (
            <div className="sc-actions" style={{ marginTop: 14 }}>
              <button
                className="sc-btn sc-btn-primary"
                type="button"
                disabled={busy || picked.size === 0}
                onClick={() => {
                  if (replaceWarning && !window.confirm(replaceWarning)) return;
                  send(false);
                }}
              >
                {busy ? 'Importing…' : `Apply import (${mode})`}
              </button>
              <span className="sc-muted">Runs as a single step: if anything fails, nothing is changed. Uncheck types to leave them out, then run the dry run again to refresh the numbers.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
