'use client';

// The "Popup" tab of the page builder (only for popups): layout + style, triggers, display rules, frequency and closing.
// Everything is validated again on the server (normalisePopupSettings) before it is stored.
import { POPUP_TYPES, type PopupSettings } from '@/lib/popups-shared';

type Props = { settings: PopupSettings; onChange: (next: PopupSettings) => void };

const Group = ({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) => (
  <details className="be-group" open={open}>
    <summary>{title}</summary>
    <div className="be-group-body">{children}</div>
  </details>
);

function NumField({ label, value, min, max, unit, onChange, help, id }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (n: number) => void; help?: string; id: string }) {
  return (
    <div className="be-field">
      <label className="be-label" htmlFor={id}><span>{label}{unit ? ` (${unit})` : ''}</span></label>
      <input id={id} className="be-input" type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value) || 0)} />
      {help && <small className="be-help">{help}</small>}
    </div>
  );
}

/** A trigger that is either off (null) or has a number (seconds / percent / views). */
function OptNum({ label, value, on, unit, min, max, fallback, id, onChange }: { label: string; value: number | null; on: boolean; unit: string; min: number; max: number; fallback: number; id: string; onChange: (v: number | null) => void }) {
  return (
    <div className="be-field be-field--row">
      <label className="be-switch"><input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked ? (value ?? fallback) : null)} /><span>{label}</span></label>
      {on && <input id={id} aria-label={`${label} (${unit})`} className="be-input" style={{ width: 90 }} type="number" min={min} max={max} value={value ?? fallback} onChange={(e) => onChange(Number(e.target.value) || min)} />}
      {on && <small className="be-help" style={{ marginLeft: 6 }}>{unit}</small>}
    </div>
  );
}

const Color = ({ label, value, onChange, id }: { label: string; value: string; onChange: (v: string) => void; id: string }) => (
  <div className="be-field">
    <label className="be-label" htmlFor={id}><span>{label}</span></label>
    <div className="be-color-row">
      <input type="color" aria-label={`${label} picker`} value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value.toUpperCase())} />
      <input id={id} className="be-input" value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} />
    </div>
  </div>
);

const Sel = ({ label, value, options, onChange, id }: { label: string; value: string; options: Array<[string, string]>; onChange: (v: string) => void; id: string }) => (
  <div className="be-field">
    <label className="be-label" htmlFor={id}><span>{label}</span></label>
    <select id={id} className="be-input" value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
  </div>
);

export default function PopupPanel({ settings: s, onChange }: Props) {
  const set = (patch: Partial<PopupSettings>) => onChange({ ...s, ...patch });
  const dt = (v: string) => (v ? v.replace(' ', 'T') : '');
  return (
    <div className="be-popuppanel" data-testid="popup-panel">
      <Group title="Link & layout" open>
        <div className="be-field">
          <label className="be-label" htmlFor="pu-slug"><span>Link name</span></label>
          <input id="pu-slug" className="be-input" value={s.slug} maxLength={60} onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-') })} />
          <small className="be-help">Any button or link with the address <code>#popup:{s.slug || 'name'}</code> opens this popup (or pick “Open popup” in a link’s settings).</small>
        </div>
        <Sel id="pu-type" label="Type" value={s.type} options={POPUP_TYPES.map((t) => [t.value, t.label])} onChange={(v) => set({ type: v as PopupSettings['type'] })} />
        {(s.type === 'modal' || s.type === 'slide-br' || s.type === 'slide-bl') && (
          <div className="be-field be-field--row">
            <div style={{ flex: 1 }}>
              <label className="be-label" htmlFor="pu-width"><span>Width</span></label>
              <input id="pu-width" className="be-input" type="number" min={120} max={3000} value={s.width} onChange={(e) => set({ width: Number(e.target.value) || 120 })} />
            </div>
            <div style={{ width: 80 }}>
              <label className="be-label" htmlFor="pu-unit"><span>Unit</span></label>
              <select id="pu-unit" className="be-input" value={s.widthUnit} onChange={(e) => set({ widthUnit: e.target.value as 'px' | '%' })}><option value="px">px</option><option value="%">%</option></select>
            </div>
          </div>
        )}
        <NumField id="pu-mh" label="Maximum height" unit="% of screen, 0 = fit content" min={0} max={100} value={s.maxHeight} onChange={(n) => set({ maxHeight: n })} />
      </Group>

      <Group title="Style">
        <Color id="pu-bg" label="Background" value={s.bg} onChange={(v) => set({ bg: v })} />
        <Color id="pu-ov" label="Overlay colour" value={s.overlay} onChange={(v) => set({ overlay: v })} />
        <NumField id="pu-ovo" label="Overlay opacity" unit="%" min={0} max={100} value={s.overlayOpacity} onChange={(n) => set({ overlayOpacity: n })} help="Only modals and full-screen popups dim the page." />
        <NumField id="pu-r" label="Corner radius" unit="px" min={0} max={60} value={s.radius} onChange={(n) => set({ radius: n })} />
        <Sel id="pu-sh" label="Shadow" value={s.shadow} options={[['none', 'None'], ['soft', 'Soft'], ['strong', 'Strong']]} onChange={(v) => set({ shadow: v as PopupSettings['shadow'] })} />
        <Sel id="pu-cs" label="Close button" value={s.closeStyle} options={[['circle', 'Round icon'], ['icon', 'Plain ×'], ['text', 'Text “Close”']]} onChange={(v) => set({ closeStyle: v as PopupSettings['closeStyle'] })} />
        <Sel id="pu-cp" label="Close button position" value={s.closePos} options={[['inside', 'Top right, inside'], ['outside', 'Top right, outside the corner'], ['left', 'Top left']]} onChange={(v) => set({ closePos: v as PopupSettings['closePos'] })} />
        <Sel id="pu-an" label="Entrance animation" value={s.animation} options={[['zoom', 'Zoom'], ['fade', 'Fade'], ['slide', 'Slide'], ['none', 'None']]} onChange={(v) => set({ animation: v as PopupSettings['animation'] })} />
        <NumField id="pu-z" label="Layer (z-index)" min={100} max={100000} value={s.zIndex} onChange={(n) => set({ zIndex: n })} help="Raise it only if something on the page covers the popup." />
      </Group>

      <Group title="When it appears" open>
        <small className="be-help" style={{ display: 'block', marginBottom: 8 }}>Pick any combination — the first one that happens opens the popup. A link to <code>#popup:{s.slug || 'name'}</code> always works.</small>
        <OptNum id="pu-t-delay" label="After the page has loaded" value={s.delay} on={s.delay !== null} unit="seconds" min={0} max={3600} fallback={5} onChange={(v) => set({ delay: v })} />
        <OptNum id="pu-t-scroll" label="When the visitor scrolls" value={s.scroll} on={s.scroll !== null} unit="% of the page" min={1} max={100} fallback={50} onChange={(v) => set({ scroll: v })} />
        <div className="be-field be-field--row"><label className="be-switch"><input type="checkbox" checked={s.exit} onChange={(e) => set({ exit: e.target.checked })} /><span>Exit intent (mouse leaves through the top, desktop)</span></label></div>
        <OptNum id="pu-t-idle" label="After inactivity" value={s.idle} on={s.idle !== null} unit="seconds idle" min={1} max={3600} fallback={30} onChange={(v) => set({ idle: v })} />
        <OptNum id="pu-t-views" label="From page view number" value={s.views} on={s.views !== null} unit="in a visit" min={1} max={100} fallback={2} onChange={(v) => set({ views: v })} />
      </Group>

      <Group title="Where and for whom">
        <Sel id="pu-pages" label="Pages" value={s.pages} options={[['all', 'Every page'], ['home', 'Home page only'], ['include', 'Only these pages'], ['exclude', 'Every page except these']]} onChange={(v) => set({ pages: v as PopupSettings['pages'] })} />
        {(s.pages === 'include' || s.pages === 'exclude') && (
          <div className="be-field">
            <label className="be-label" htmlFor="pu-paths"><span>Page addresses (one per line)</span></label>
            <textarea id="pu-paths" className="be-input be-textarea" rows={4} value={s.paths.join('\n')} placeholder={'/products*\n/services/rebar-fabrication\n/'} onChange={(e) => set({ paths: e.target.value.split(/\r?\n/) })} />
            <small className="be-help">Use * as a wildcard: <code>/products*</code> matches /products and everything below it. <code>/</code> is the home page.</small>
          </div>
        )}
        <div className="be-field">
          <span className="be-label"><span>Devices</span></span>
          <div className="be-checks">
            {([['d', 'Desktop'], ['t', 'Tablet'], ['m', 'Mobile']] as const).map(([k, l]) => (
              <label key={k}><input type="checkbox" checked={s.devices[k]} onChange={(e) => set({ devices: { ...s.devices, [k]: e.target.checked } })} />{l}</label>
            ))}
          </div>
        </div>
        <Sel id="pu-vis" label="Visitors" value={s.visitors} options={[['everyone', 'Everyone'], ['guests', 'Signed-out visitors only']]} onChange={(v) => set({ visitors: v as PopupSettings['visitors'] })} />
        <div className="be-field">
          <label className="be-label" htmlFor="pu-start"><span>Start (UTC, optional)</span></label>
          <input id="pu-start" className="be-input" type="datetime-local" value={dt(s.start)} onChange={(e) => set({ start: e.target.value.replace('T', ' ') })} />
        </div>
        <div className="be-field">
          <label className="be-label" htmlFor="pu-end"><span>End (UTC, optional)</span></label>
          <input id="pu-end" className="be-input" type="datetime-local" value={dt(s.end)} onChange={(e) => set({ end: e.target.value.replace('T', ' ') })} />
          <small className="be-help">Times are UTC. The popup must also be switched on (Admin → Popups → Activate).</small>
        </div>
      </Group>

      <Group title="How often, and closing">
        <Sel id="pu-freq" label="Show" value={s.freq} options={[['always', 'Every time the trigger fires'], ['session', 'Once per visit (session)'], ['visitor', 'Once per visitor, ever'], ['days', 'Again after N days once closed']]} onChange={(v) => set({ freq: v as PopupSettings['freq'] })} />
        {s.freq === 'days' && <NumField id="pu-days" label="Don’t show again for" unit="days after it is closed" min={1} max={3650} value={s.days} onChange={(n) => set({ days: n })} />}
        <div className="be-field be-field--row"><label className="be-switch"><input type="checkbox" checked={s.neverAfterSubmit} onChange={(e) => set({ neverAfterSubmit: e.target.checked })} /><span>Never again once the visitor sent a form in it</span></label></div>
        <NumField id="pu-ac" label="Close by itself after" unit="seconds, 0 = stays open" min={0} max={3600} value={s.autoClose} onChange={(n) => set({ autoClose: n })} />
        <NumField id="pu-cas" label="Close after a form is sent" unit="seconds, 0 = stays open" min={0} max={60} value={s.closeAfterSubmit} onChange={(n) => set({ closeAfterSubmit: n })} help="Gives the visitor time to read the “thank you” message." />
      </Group>
    </div>
  );
}
