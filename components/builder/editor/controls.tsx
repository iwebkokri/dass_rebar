'use client';

// One renderer per control kind. The settings panel is generated from the schema (lib/builder/schema.mjs) — no per-widget UI code.
import { useState } from 'react';
import { ICON_NAMES, ICONS } from '@/lib/builder/icons.mjs';
import { DEVICE_LABEL, isDeviceMap } from '@/lib/builder/schema.mjs';
import type { Device } from '@/lib/builder/types';
import { Icon } from '../util';
import RichEditor from './RichEditor';
import { I } from './ui';

export type Lists = {
  pages: { id: number; title: string; path: string }[];
  menus: { slug: string; name: string }[];
  forms: { id: number; name: string }[];
  categories: { slug: string; name: string }[];
  sections: { id: number; name: string }[];
};
export type CtlCx = { device: Device; lists: Lists; palette: [string, string][]; pickMedia: (kind: 'image' | 'video', cb: (url: string) => void) => void; editTemplate: (id: string) => void };

const empty = (v: any) => v === undefined || v === null || v === '' || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

function cascade(map: Record<string, any>, device: Device) {
  if (device === 'd') return undefined;
  if (device === 't') return map.d;
  return map.t ?? map.d;
}

type FieldProps = { c: any; value: any; onChange: (v: any) => void; cx: CtlCx; nested?: boolean };

export function ControlField({ c, value, onChange, cx, nested }: FieldProps) {
  const resp = !!c.responsive && c.kind !== 'repeater';
  const map: Record<string, any> = resp ? (isDeviceMap(c, value) ? value : empty(value) ? {} : { d: value }) : {};
  const cur = resp ? map[cx.device] : value;
  const inherited = resp && empty(cur) ? cascade(map, cx.device) : undefined;

  const set = (v: any) => {
    if (!resp) { onChange(empty(v) && v !== false ? undefined : v); return; }
    const next = { ...map };
    if (empty(v) && v !== false) delete next[cx.device]; else next[cx.device] = v;
    onChange(Object.keys(next).length ? next : undefined);
  };

  const body = <Editor c={c} cur={cur} inherited={inherited} set={set} cx={cx} />;
  if (c.kind === 'switch') {
    return (
      <div className="be-field be-field--row">
        <label className="be-switch"><input type="checkbox" checked={!!cur} onChange={(e) => set(e.target.checked ? true : undefined)} /><span>{c.label}</span></label>
        {c.help && <small className="be-help">{c.help}</small>}
      </div>
    );
  }
  return (
    <div className={`be-field${nested ? ' is-nested' : ''}`}>
      <div className="be-label">
        <span>{c.label}</span>
        {resp && <span className="be-dev" title={`Value for ${DEVICE_LABEL[cx.device]}`}><I name={cx.device === 'd' ? 'desktop' : cx.device === 't' ? 'tablet' : 'mobile'} size={12} /></span>}
        {!empty(cur) && c.kind !== 'repeater' && <button type="button" className="be-reset" title="Reset to default" onClick={() => set(undefined)}>reset</button>}
      </div>
      {body}
      {c.help && <small className="be-help">{c.help}</small>}
    </div>
  );
}

function Editor({ c, cur, inherited, set, cx }: { c: any; cur: any; inherited: any; set: (v: any) => void; cx: CtlCx }) {
  switch (c.kind) {
    case 'text':
      return <input className="be-input" value={cur ?? ''} placeholder={c.placeholder || (typeof inherited === 'string' ? inherited : '')} onChange={(e) => set(e.target.value)} />;
    case 'textarea':
      return <textarea className={`be-input be-textarea${c.code || c.custom ? ' is-code' : ''}`} rows={c.code || c.custom ? 6 : 3} value={cur ?? ''} onChange={(e) => set(e.target.value)} spellCheck={!(c.code || c.custom)} />;
    case 'rich':
      return <RichEditor value={cur ?? ''} onChange={set} />;
    case 'number':
      return <input className="be-input" type="number" min={c.min} max={c.max} step={c.step ?? 1} value={cur ?? ''} placeholder={inherited !== undefined ? String(inherited) : c.default !== undefined ? String(c.default) : ''} onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))} />;
    case 'size':
      return <SizeInput value={cur} placeholder={typeof inherited === 'string' ? inherited : ''} units={c.units} onChange={set} />;
    case 'select':
      return (
        <select className="be-input" value={cur ?? c.default ?? ''} onChange={(e) => set(e.target.value === '' ? undefined : e.target.value)}>
          {(c.options || []).map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'color':
      return <ColorInput value={cur} inherited={inherited} palette={cx.palette} onChange={set} />;
    case 'image':
    case 'video':
      return <MediaInput kind={c.kind} value={cur} cx={cx} onChange={set} />;
    case 'url':
      return <UrlInput value={cur} cx={cx} onChange={set} />;
    case 'icon':
      return <IconInput value={cur} onChange={set} />;
    case 'align':
      return (
        <div className="be-seg">
          {['left', 'center', 'right'].map((a) => <button key={a} type="button" className={(cur ?? inherited) === a ? 'is-on' : ''} onClick={() => set(cur === a ? undefined : a)}>{a}</button>)}
        </div>
      );
    case 'dimensions':
      return <Dimensions value={cur} negative={c.negative} inherited={inherited} onChange={set} />;
    case 'multi':
      return (
        <div className="be-checks">
          {(c.options || []).map((o: any) => {
            const list: string[] = Array.isArray(cur) ? cur : [];
            return (
              <label key={o.value}><input type="checkbox" checked={list.includes(o.value)} onChange={(e) => set(e.target.checked ? [...list, o.value] : list.filter((x) => x !== o.value))} />{o.label}</label>
            );
          })}
        </div>
      );
    case 'resource':
      return <ResourceInput c={c} value={cur} cx={cx} onChange={set} />;
    case 'repeater':
      return <Repeater c={c} value={cur} cx={cx} onChange={set} />;
    default:
      return null;
  }
}

function SizeInput({ value, placeholder, units, onChange }: { value: any; placeholder: string; units?: string[]; onChange: (v: any) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    let v = raw.trim();
    if (/^-?\d+(\.\d+)?$/.test(v) && units?.includes('px') !== false) v += 'px';
    setDraft(null);
    onChange(v || undefined);
  };
  return (
    <input className="be-input" value={draft ?? (typeof value === 'string' ? value : '')} placeholder={placeholder || (units ? `e.g. 24${units[0] === 'auto' ? 'px' : units[0]}` : '')}
      onChange={(e) => { setDraft(e.target.value); if (/^-?\d+(\.\d+)?(px|%|em|rem|vw|vh|ch)$|^auto$/.test(e.target.value.trim())) onChange(e.target.value.trim()); }}
      onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }} />
  );
}

function ColorInput({ value, inherited, palette, onChange }: { value: any; inherited: any; palette: [string, string][]; onChange: (v: any) => void }) {
  const hex = typeof (value ?? inherited) === 'string' && /^#[0-9a-f]{6}$/i.test(value ?? inherited) ? (value ?? inherited) : '#000000';
  return (
    <div className="be-color">
      <div className="be-swatches">
        {palette.map(([c, name]) => <button key={c} type="button" title={name} className={`be-sw${value === c ? ' is-on' : ''}`} style={{ background: c }} onClick={() => onChange(c)} />)}
      </div>
      <div className="be-color-row">
        <input type="color" value={hex} onChange={(e) => onChange(e.target.value)} aria-label="Pick a colour" />
        <input className="be-input" value={value ?? ''} placeholder={typeof inherited === 'string' ? inherited : '#RRGGBB or rgba()'} onChange={(e) => onChange(e.target.value || undefined)} />
      </div>
    </div>
  );
}

function MediaInput({ kind, value, cx, onChange }: { kind: 'image' | 'video'; value: any; cx: CtlCx; onChange: (v: any) => void }) {
  const url = typeof value === 'string' ? value : '';
  return (
    <div className="be-media">
      {url && (kind === 'image' ? <img src={url} alt="" className="be-media-prev" /> : <video src={url} className="be-media-prev" muted />)}
      <div className="be-media-btns">
        <button type="button" className="be-btn" onClick={() => cx.pickMedia(kind, (u) => onChange(u))}>{url ? 'Replace' : `Choose ${kind}`}</button>
        {url && <button type="button" className="be-btn be-btn--ghost" onClick={() => onChange(undefined)}>Remove</button>}
      </div>
      <input className="be-input" value={url} placeholder="…or paste a URL" onChange={(e) => onChange(e.target.value || undefined)} />
    </div>
  );
}

function UrlInput({ value, cx, onChange }: { value: any; cx: CtlCx; onChange: (v: any) => void }) {
  const id = 'pages-list';
  return (
    <div className="be-url">
      <input className="be-input" list={id} value={value ?? ''} placeholder="https://… or /page" onChange={(e) => onChange(e.target.value || undefined)} />
      <select className="be-input" value="" onChange={(e) => { if (e.target.value) onChange(e.target.value); }} aria-label="Link to a page">
        <option value="">Link to a page…</option>
        {cx.lists.pages.map((p) => <option key={p.id} value={`/${p.path}`}>{p.title} ({p.path ? '/' + p.path : 'home'})</option>)}
      </select>
      <datalist id={id}>{cx.lists.pages.map((p) => <option key={p.id} value={`/${p.path}`}>{p.title}</option>)}</datalist>
    </div>
  );
}

function IconInput({ value, onChange }: { value: any; onChange: (v: any) => void }) {
  return (
    <details className="be-icons">
      <summary>{value ? <><Icon name={value} size={18} /> {value}</> : 'No icon'}</summary>
      <div className="be-icon-grid">
        <button type="button" className={!value ? 'is-on' : ''} onClick={() => onChange(undefined)} title="None"><I name="close" size={16} /></button>
        {ICON_NAMES.map((n: string) => (
          <button key={n} type="button" className={value === n ? 'is-on' : ''} title={n} onClick={() => onChange(n)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: (ICONS as any)[n] }} />
          </button>
        ))}
      </div>
    </details>
  );
}

function Dimensions({ value, negative, inherited, onChange }: { value: any; negative?: boolean; inherited: any; onChange: (v: any) => void }) {
  const [linked, setLinked] = useState(false);
  const v = value && typeof value === 'object' ? value : {};
  const ph = inherited && typeof inherited === 'object' ? inherited : {};
  const sides: [string, string][] = [['t', 'Top'], ['r', 'Right'], ['b', 'Bottom'], ['l', 'Left']];
  const update = (side: string, raw: string) => {
    const n = raw === '' ? undefined : Number(raw);
    const next: any = linked ? Object.fromEntries(sides.map(([s]) => [s, n])) : { ...v, [side]: n };
    for (const k of Object.keys(next)) if (next[k] === undefined || Number.isNaN(next[k])) delete next[k];
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <div className="be-dims">
      {sides.map(([s, label]) => (
        <label key={s}><input type="number" min={negative ? undefined : 0} value={v[s] ?? ''} placeholder={ph[s] !== undefined ? String(ph[s]) : '0'} onChange={(e) => update(s, e.target.value)} /><span>{label}</span></label>
      ))}
      <button type="button" className={`be-link${linked ? ' is-on' : ''}`} title="Link all sides" aria-pressed={linked} onClick={() => setLinked((x) => !x)}>⛓</button>
    </div>
  );
}

function ResourceInput({ c, value, cx, onChange }: { c: any; value: any; cx: CtlCx; onChange: (v: any) => void }) {
  const L = cx.lists;
  const opts: { value: string; label: string }[] =
    c.source === 'menus' ? L.menus.map((m) => ({ value: m.slug, label: m.name }))
    : c.source === 'forms' ? L.forms.map((f) => ({ value: String(f.id), label: f.name }))
    : c.source === 'categories' ? L.categories.map((x) => ({ value: x.slug, label: x.name }))
    : c.source === 'sections' ? L.sections.map((s) => ({ value: String(s.id), label: s.name }))
    : L.pages.map((p) => ({ value: String(p.id), label: p.title }));
  return (
    <div className="be-url">
      <select className="be-input" value={value ?? ''} onChange={(e) => onChange(e.target.value || undefined)}>
        <option value="">{c.source === 'categories' ? 'All categories' : '— choose —'}</option>
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {c.source === 'sections' && value ? <button type="button" className="be-btn be-btn--ghost" onClick={() => cx.editTemplate(String(value))}>Edit this saved section</button> : null}
    </div>
  );
}

function Repeater({ c, value, cx, onChange }: { c: any; value: any; cx: CtlCx; onChange: (v: any) => void }) {
  const items: any[] = Array.isArray(value) ? value : [];
  const [openIdx, setOpenIdx] = useState<number | null>(items.length === 1 ? 0 : null);
  const setAll = (next: any[]) => onChange(next);
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const next = items.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setAll(next);
    setOpenIdx(j);
  };
  return (
    <div className="be-rep">
      {items.map((it, i) => (
        <div key={i} className={`be-rep-item${openIdx === i ? ' is-open' : ''}`}>
          <div className="be-rep-head">
            <button type="button" className="be-rep-title" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
              <I name="chevron" size={12} />
              <span>{(c.itemLabel && typeof it?.[c.itemLabel] === 'string' && it[c.itemLabel].replace(/<[^>]+>/g, '').slice(0, 40)) || `Item ${i + 1}`}</span>
            </button>
            <button type="button" title="Move up" onClick={() => move(i, -1)}><I name="up" size={12} /></button>
            <button type="button" title="Move down" onClick={() => move(i, 1)}><I name="down" size={12} /></button>
            <button type="button" title="Remove" onClick={() => { setAll(items.filter((_, k) => k !== i)); setOpenIdx(null); }}><I name="trash" size={12} /></button>
          </div>
          {openIdx === i && (
            <div className="be-rep-body">
              {(c.fields || []).map((f: any) => (
                <ControlField key={f.key} c={f} cx={cx} nested value={it?.[f.key]} onChange={(v) => { const next = items.slice(); const item = { ...(next[i] || {}) }; if (v === undefined) delete item[f.key]; else item[f.key] = v; next[i] = item; setAll(next); }} />
              ))}
            </div>
          )}
        </div>
      ))}
      <button type="button" className="be-btn be-btn--ghost" onClick={() => { setAll([...items, JSON.parse(JSON.stringify(c.itemDefaults || {}))]); setOpenIdx(items.length); }}>+ Add item</button>
    </div>
  );
}
