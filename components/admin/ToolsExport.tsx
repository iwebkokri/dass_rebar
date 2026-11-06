'use client';

import { useState } from 'react';

type Item = { value: string; label: string; count: number };

/** Pick what goes into the export; the download is a plain GET to /admin/tools/export (a signed-in administrator only). */
export function ToolsExport({ items }: { items: Item[] }) {
  const [on, setOn] = useState<Set<string>>(() => new Set(items.map((i) => i.value)));
  const toggle = (v: string) => setOn((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });

  return (
    <form method="get" action="/admin/tools/export" className="sc-card">
      <h2>Export</h2>
      <p className="sc-muted" style={{ margin: '0 0 14px' }}>Download your content as one JSON file. Users, passwords and sessions are never included.</p>
      <div className="sc-tools-checks">
        {items.map((i) => (
          <label key={i.value} className="sc-check sc-tools-check">
            <input type="checkbox" name="include" value={i.value} checked={on.has(i.value)} onChange={() => toggle(i.value)} />
            <span>{i.label} <span className="sc-muted">({i.count})</span></span>
          </label>
        ))}
      </div>
      <div className="sc-actions" style={{ marginTop: 16 }}>
        <button className="sc-btn sc-btn-primary" type="submit" disabled={on.size === 0}>Download export (.json)</button>
        <button className="sc-btn sc-btn-sm" type="button" onClick={() => setOn(new Set(items.map((i) => i.value)))}>Select all</button>
        <button className="sc-btn sc-btn-sm" type="button" onClick={() => setOn(new Set())}>Select none</button>
      </div>
    </form>
  );
}
