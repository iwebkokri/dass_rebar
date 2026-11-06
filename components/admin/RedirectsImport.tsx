'use client';

import { useActionState, useState } from 'react';
import { submitWith } from './ToolsSubmit';
import { csvRedirects, type CsvState } from '@/app/admin/redirects/actions';

/** CSV import: pick a file (or paste rows) → Preview (nothing is written) → Import. Columns: from,to,code. */
export function RedirectsImport() {
  const [state, action, pending] = useActionState<CsvState, FormData>(csvRedirects, {});
  const [text, setText] = useState('');
  const [allow, setAllow] = useState(false); // controlled: React clears uncontrolled fields after each submit, and Import must match the Preview
  const results = state.results ?? [];
  const good = results.filter((r) => r.status !== 'error').length;

  return (
    <form onSubmit={submitWith(action)} className="sc-card sc-redir-import">
      <h2>Import from CSV</h2>
      <p className="sc-muted" style={{ margin: '0 0 12px' }}>One redirect per line: <code>from,to,code</code> (the code is optional, default 301). Existing “from” addresses are updated. Check the preview before importing.</p>
      {state.error && <div className="sc-flash sc-flash-err" role="alert">{state.error}</div>}
      {state.committed && (
        <div className="sc-flash sc-flash-ok" role="status">Imported {good} redirect{good === 1 ? '' : 's'}{results.length - good > 0 ? `; ${results.length - good} skipped (see below)` : ''}.</div>
      )}

      <div className="sc-field">
        <label htmlFor="csv-file">CSV file</label>
        <input
          className="sc-input"
          id="csv-file"
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f && f.size <= 1_000_000) setText(await f.text());
          }}
        />
      </div>
      <div className="sc-field" style={{ marginTop: 12 }}>
        <label htmlFor="csv-text">…or paste rows</label>
        <textarea className="sc-textarea" id="csv-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder={'/old-page,/new-page,301\n/promo,https://example.com/offer,302'} spellCheck={false} />
        <input type="hidden" name="csv" value={text} />
      </div>
      <label className="sc-check" style={{ marginTop: 12 }}><input type="checkbox" name="allow_pages" checked={allow} onChange={(e) => setAllow(e.target.checked)} /> Allow redirects away from addresses that are published pages</label>

      <div className="sc-actions" style={{ marginTop: 14 }}>
        <button className="sc-btn" type="submit" name="intent" value="preview" disabled={pending || !text.trim()}>{pending ? 'Checking…' : 'Preview'}</button>
        {results.length > 0 && !state.committed && good > 0 && (
          <button className="sc-btn sc-btn-primary" type="submit" name="intent" value="import" disabled={pending}>Import {good} redirect{good === 1 ? '' : 's'}</button>
        )}
      </div>

      {results.length > 0 && (
        <div className="sc-tablewrap" style={{ marginTop: 16 }}>
          <table className="sc-table">
            <thead><tr><th>Line</th><th>From</th><th>To</th><th>Type</th><th>Result</th></tr></thead>
            <tbody>
              {results.slice(0, 500).map((r) => (
                <tr key={`${r.line}-${r.from}`}>
                  <td className="sc-muted">{r.line}</td>
                  <td>{r.from}</td>
                  <td className="sc-redir-to">{r.to}</td>
                  <td>{r.code || '301'}</td>
                  <td>
                    {r.status === 'error' ? <span className="sc-badge sc-badge-new" title={r.message}>skipped</span> : <span className={`sc-badge ${r.status === 'new' ? 'sc-badge-ok' : 'sc-badge-warn'}`}>{r.status === 'new' ? 'new' : 'update'}</span>}
                    {r.message && <div className="sc-muted sc-redir-msg">{r.message}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length > 500 && <div className="sc-empty">Showing the first 500 of {results.length} rows.</div>}
        </div>
      )}
    </form>
  );
}
