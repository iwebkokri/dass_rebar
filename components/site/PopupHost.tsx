'use client';

// Shows the popups the server sent with this page. The server already decided WHICH popups may appear (status, schedule, page rules,
// signed-in visitors); this decides WHEN: triggers (delay, scroll, exit intent, idle, page views, click on a #popup:<slug> link),
// device and frequency. A popup's content is server-rendered and passed in as `node`; nothing is mounted until it opens (no layout shift).
// Dialog behaviour: ESC / overlay / button close, body scroll lock, focus moves in, is trapped and returns (modal types), role=dialog.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { isModalType, type PopupClientSettings } from '@/lib/popups-shared';
import './popup.css';

export type PopupItem = { id: number; slug: string; name: string; s: PopupClientSettings; preview: boolean; autoOk: boolean; node: ReactNode };

type Rec = { closed?: number; shown?: boolean; submitted?: boolean };
const KEY = (id: number) => `dr_pu_${id}`;
const SKEY = (id: number) => `dr_pus_${id}`;
const readRec = (id: number): Rec => { try { return JSON.parse(localStorage.getItem(KEY(id)) || '{}'); } catch { return {}; } };
const writeRec = (id: number, patch: Rec) => { try { localStorage.setItem(KEY(id), JSON.stringify({ ...readRec(id), ...patch })); } catch { /* storage blocked */ } };
const sessionShown = (id: number) => { try { return !!sessionStorage.getItem(SKEY(id)); } catch { return false; } };
const device = () => (window.innerWidth <= 767 ? 'm' : window.innerWidth <= 1024 ? 't' : 'd') as 'd' | 't' | 'm';

/** Frequency + "never after a form was sent" (device is checked separately). */
function frequencyOk(it: PopupItem): boolean {
  const s = it.s;
  const rec = readRec(it.id);
  if (rec.submitted && s.neverAfterSubmit) return false;
  if (s.freq === 'session') return !sessionShown(it.id);
  if (s.freq === 'visitor') return !rec.shown;
  if (s.freq === 'days') return !rec.closed || Date.now() - rec.closed >= s.days * 86400000;
  return true;
}

const rgba = (hex: string, pct: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.min(100, Math.max(0, pct)) / 100})`;
};
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function PopupHost({ items }: { items: PopupItem[] }) {
  const pathname = usePathname();
  const [openId, setOpenId] = useState<number | null>(null);
  const openRef = useRef<number | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const box = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const forced = useRef(false); // opened by a link / preview: not recorded as an automatic showing

  const close = useCallback(() => {
    const id = openRef.current;
    if (id === null) return;
    openRef.current = null;
    setOpenId(null);
    if (!forced.current) writeRec(id, { closed: Date.now() });
    forced.current = false;
  }, []);

  /** auto = from a trigger (checks device + frequency); force = a link / the preview (bypasses them). */
  const open = useCallback((id: number, force = false, from?: HTMLElement | null) => {
    if (openRef.current !== null) return;
    const it = itemsRef.current.find((x) => x.id === id);
    if (!it) return;
    if (!force) {
      if (!it.s.devices[device()] || !frequencyOk(it)) return;
      writeRec(id, { shown: true });
      try { sessionStorage.setItem(SKEY(id), '1'); } catch { /* ignore */ }
    }
    forced.current = force;
    returnFocus.current = from || (document.activeElement as HTMLElement | null);
    openRef.current = id;
    setOpenId(id);
  }, []);

  // ---- triggers (re-armed on every page)
  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const list = itemsRef.current;
    let views = 1;
    try { views = Number(sessionStorage.getItem('dr_pv') || 0) + 1; sessionStorage.setItem('dr_pv', String(views)); } catch { /* ignore */ }

    // preview (signed-in staff only: the server only sends non-live popups to them) and #popup:<slug> in the address
    const pv = Number(new URLSearchParams(window.location.search).get('popup-preview'));
    if (pv && list.some((x) => x.id === pv)) {
      const t = window.setTimeout(() => open(pv, true), 400);
      cleanups.push(() => clearTimeout(t));
      return () => cleanups.forEach((f) => f());
    }
    const hm = /^#(?:popup:([a-z0-9-]+)|dr-popup-(\d+))$/.exec(window.location.hash);
    if (hm) {
      const it = list.find((x) => (hm[1] ? x.slug === hm[1] : String(x.id) === hm[2]) && !x.preview);
      if (it) { const t = window.setTimeout(() => open(it.id, true), 300); cleanups.push(() => clearTimeout(t)); }
    }

    for (const it of list) {
      if (it.preview || !it.autoOk) continue;
      const s = it.s;
      if (!s.devices[device()] || !frequencyOk(it)) continue;
      const fire = () => open(it.id);
      if (s.delay !== null) { const t = window.setTimeout(fire, s.delay * 1000); cleanups.push(() => clearTimeout(t)); }
      if (s.views !== null && views >= s.views) { const t = window.setTimeout(fire, 1200); cleanups.push(() => clearTimeout(t)); }
      if (s.scroll !== null) {
        const onScroll = () => {
          const h = document.documentElement.scrollHeight - window.innerHeight;
          const pct = h <= 0 ? 100 : (window.scrollY / h) * 100;
          if (pct >= (s.scroll as number)) fire();
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        cleanups.push(() => window.removeEventListener('scroll', onScroll));
      }
      if (s.exit && device() === 'd') {
        const onOut = (e: MouseEvent) => { if (!e.relatedTarget && e.clientY <= 0) fire(); };
        document.addEventListener('mouseout', onOut);
        cleanups.push(() => document.removeEventListener('mouseout', onOut));
      }
      if (s.idle !== null) {
        let t = window.setTimeout(fire, s.idle * 1000);
        const reset = () => { clearTimeout(t); t = window.setTimeout(fire, (s.idle as number) * 1000); };
        const evs = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        evs.forEach((ev) => window.addEventListener(ev, reset, { passive: true }));
        cleanups.push(() => { clearTimeout(t); evs.forEach((ev) => window.removeEventListener(ev, reset)); });
      }
    }
    return () => cleanups.forEach((f) => f());
  }, [pathname, items, open]);

  // ---- links:  #popup:<slug>  #dr-popup-<id>  #popup-close
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const h = a.getAttribute('href') || '';
      if (h === '#popup-close') { if (openRef.current !== null) { e.preventDefault(); close(); } return; }
      const m = /^#(?:popup:([a-z0-9-]+)|dr-popup-(\d+))$/.exec(h);
      if (!m) return;
      const it = itemsRef.current.find((x) => (m[1] ? x.slug === m[1] : String(x.id) === m[2]) && !x.preview);
      if (!it) return;
      e.preventDefault();
      if (openRef.current === null) open(it.id, true, a);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [open, close]);

  // ---- a form inside the open popup was sent: remember it ("never again"), optionally close after a moment
  useEffect(() => {
    const onDone = (e: Event) => {
      const id = Number((e as CustomEvent).detail?.popup);
      const it = itemsRef.current.find((x) => x.id === id);
      if (!id || !it || openRef.current !== id) return;
      writeRec(id, { submitted: true }); // "never again after the visitor sent a form" (when the popup says so)
      if (it.s.closeAfterSubmit > 0) window.setTimeout(() => { if (openRef.current === id) close(); }, it.s.closeAfterSubmit * 1000);
    };
    window.addEventListener('dr:form-success', onDone);
    return () => window.removeEventListener('dr:form-success', onDone);
  }, [close]);

  // ---- while open: ESC, focus trap, scroll lock, focus in / out, auto close
  const current = items.find((x) => x.id === openId) || null;
  useEffect(() => {
    if (!current) return;
    const modal = isModalType(current.s.type);
    // label the dialog by its visible heading when it has one (else by the popup's name, see the hidden span below)
    const heading = box.current?.querySelector<HTMLElement>('h1, h2, h3');
    if (heading && box.current) {
      if (!heading.id) heading.id = `dr-pu-h-${current.id}`;
      box.current.setAttribute('aria-labelledby', heading.id);
    }
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    if (modal) {
      const sb = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (sb > 0) document.body.style.paddingRight = `${sb}px`;
      requestAnimationFrame(() => {
        const first = box.current?.querySelector<HTMLElement>(FOCUSABLE);
        (first || box.current)?.focus({ preventScroll: true });
      });
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab' || !modal || !box.current) return;
      const f = Array.from(box.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!f.length) { e.preventDefault(); box.current.focus(); return; }
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    const auto = current.s.autoClose > 0 ? window.setTimeout(close, current.s.autoClose * 1000) : 0;
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (auto) clearTimeout(auto);
      if (modal) { document.body.style.overflow = prevOverflow; document.body.style.paddingRight = prevPad; }
      const back = returnFocus.current;
      returnFocus.current = null;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, [current, close]);

  if (!current) return null;
  const s = current.s;
  const modal = isModalType(s.type);
  const wide = s.widthUnit === '%' ? `min(${s.width}vw, 100vw - 24px)` : `min(${s.width}px, 100vw - 24px)`;
  const style = {
    '--pu-z': s.zIndex,
    '--pu-ov': rgba(s.overlay, s.overlayOpacity),
    '--pu-w': s.type === 'bar-top' || s.type === 'bar-bottom' || s.type === 'fullscreen' ? '100%' : wide,
    '--pu-bg': s.bg,
    '--pu-r': `${s.type === 'bar-top' || s.type === 'bar-bottom' || s.type === 'fullscreen' ? 0 : s.radius}px`,
    '--pu-mh': s.maxHeight > 0 ? `${s.maxHeight}vh` : 'calc(100vh - 32px)',
    '--pu-shadow': s.shadow === 'none' ? 'none' : s.shadow === 'soft' ? '0 8px 28px rgba(11,18,32,.22)' : '0 24px 70px rgba(11,18,32,.45)',
  } as React.CSSProperties;

  return (
    <div className={`dr-pu dr-pu--${s.type} dr-pu-a-${s.animation}${modal ? ' is-modal' : ''}`} style={style} onMouseDown={(e) => { if (modal && e.target === e.currentTarget) close(); }}>
      <div ref={box} className="dr-pu-box" role="dialog" aria-modal={modal ? 'true' : 'false'} aria-labelledby={`dr-pu-t-${current.id}`} data-dr-popup={current.id} tabIndex={-1}>
        <span id={`dr-pu-t-${current.id}`} className="dr-pu-sr">{current.name}</span>
        <button type="button" className={`dr-pu-x dr-pu-x--${s.closeStyle} dr-pu-x--${s.closePos}`} aria-label="Close" onClick={close}>{s.closeStyle === 'text' ? 'Close ✕' : '×'}</button>
        <div className="dr-pu-body">{current.node}</div>
      </div>
    </div>
  );
}
