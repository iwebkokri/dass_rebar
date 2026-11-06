'use client';

import { useState } from 'react';

type Entry = [string, string];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** <input type=color> only understands #rrggbb. */
const forPicker = (hex: string) => {
  const h = hex.trim();
  if (/^#[0-9a-f]{6}$/i.test(h)) return h.toLowerCase();
  if (/^#[0-9a-f]{3,4}$/i.test(h)) return ('#' + [...h.slice(1, 4)].map((c) => c + c).join('')).toLowerCase();
  if (/^#[0-9a-f]{8}$/i.test(h)) return h.slice(0, 7).toLowerCase();
  return '#000000';
};

/** Brand colour list editor. Submits one hidden field `design_palette` (JSON) with the valid rows. */
export function SettingsPalette({ initial, defaults }: { initial: Entry[]; defaults: Entry[] }) {
  const [rows, setRows] = useState<Entry[]>(initial);
  const set = (i: number, patch: Partial<{ hex: string; name: string }>) =>
    setRows((r) => r.map((e, k) => (k === i ? [patch.hex ?? e[0], patch.name ?? e[1]] : e)));
  const valid = rows.filter((e) => HEX.test(e[0].trim())).map((e): Entry => [e[0].trim(), e[1].trim()]);

  return (
    <div className="sc-settings-palette">
      <input type="hidden" name="design_palette" value={JSON.stringify(valid)} />
      {rows.length === 0 && <p className="sc-muted" style={{ margin: 0 }}>No custom colours — the page builder uses the built-in brand palette.</p>}
      {rows.map(([hex, name], i) => (
        <div key={i} className="sc-settings-colour">
          <input type="color" aria-label={`Colour ${i + 1}`} value={forPicker(hex)} onChange={(e) => set(i, { hex: e.target.value })} />
          <input
            className="sc-input sc-settings-hex"
            aria-label={`Hex value ${i + 1}`}
            value={hex}
            maxLength={9}
            spellCheck={false}
            onChange={(e) => set(i, { hex: e.target.value })}
            aria-invalid={!HEX.test(hex.trim())}
          />
          <input className="sc-input" aria-label={`Name ${i + 1}`} value={name} maxLength={40} placeholder="Colour name" onChange={(e) => set(i, { name: e.target.value })} />
          <button type="button" className="sc-btn sc-btn-sm sc-btn-danger" onClick={() => setRows((r) => r.filter((_, k) => k !== i))} aria-label={`Remove ${name || hex}`}>Remove</button>
        </div>
      ))}
      {rows.some((e) => !HEX.test(e[0].trim())) && <p className="sc-help" style={{ color: 'var(--sc-warn)' }}>Rows without a valid hex value (like #182845) are not saved.</p>}
      <div className="sc-actions">
        <button type="button" className="sc-btn sc-btn-sm" onClick={() => setRows((r) => (r.length >= 48 ? r : [...r, ['#182845', '']]))}>+ Add colour</button>
        <button type="button" className="sc-btn sc-btn-sm" onClick={() => setRows(defaults.map((d): Entry => [d[0], d[1]]))}>Use the built-in palette</button>
        <button type="button" className="sc-btn sc-btn-sm" onClick={() => setRows([])}>Clear</button>
      </div>
    </div>
  );
}
