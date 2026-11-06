// Popups: the settings model (stored as JSON in templates.settings for templates of kind 'popup'), its validation, path-rule matching
// and the text summaries the admin list shows. Client-safe: no database, no node: imports (the builder's Popup panel and the public
// PopupHost both import it).
import { safeUrl } from './builder/url.mjs';
import { slugify } from './slug.mjs';

export type PopupType = 'modal' | 'slide-br' | 'slide-bl' | 'bar-top' | 'bar-bottom' | 'fullscreen';
export const POPUP_TYPES: Array<{ value: PopupType; label: string; modal: boolean }> = [
  { value: 'modal', label: 'Centered modal', modal: true },
  { value: 'slide-br', label: 'Slide-in, bottom right', modal: false },
  { value: 'slide-bl', label: 'Slide-in, bottom left', modal: false },
  { value: 'bar-top', label: 'Bar across the top', modal: false },
  { value: 'bar-bottom', label: 'Bar across the bottom', modal: false },
  { value: 'fullscreen', label: 'Full screen', modal: true },
];
export const isModalType = (t: PopupType) => t === 'modal' || t === 'fullscreen';

export type PopupSettings = {
  slug: string;
  trashed: boolean;
  // ---- layout + style
  type: PopupType;
  width: number; widthUnit: 'px' | '%';
  /** max height in vh; 0 = as tall as the content */
  maxHeight: number;
  bg: string;
  overlay: string; overlayOpacity: number;
  radius: number;
  shadow: 'none' | 'soft' | 'strong';
  closeStyle: 'icon' | 'circle' | 'text';
  closePos: 'inside' | 'outside' | 'left';
  animation: 'fade' | 'slide' | 'zoom' | 'none';
  zIndex: number;
  // ---- triggers (any combination; null/false = off). Links to #popup:<slug> always work.
  delay: number | null;   // seconds after the page loads
  scroll: number | null;  // % of the page scrolled
  exit: boolean;          // mouse leaves through the top (desktop)
  idle: number | null;    // seconds without any activity
  views: number | null;   // page views in this visit
  // ---- display rules
  pages: 'all' | 'home' | 'include' | 'exclude';
  paths: string[];
  devices: { d: boolean; t: boolean; m: boolean };
  visitors: 'everyone' | 'guests';
  start: string; // 'YYYY-MM-DD HH:MM' UTC or ''
  end: string;
  // ---- frequency + closing
  freq: 'always' | 'session' | 'visitor' | 'days';
  days: number;
  neverAfterSubmit: boolean;
  autoClose: number;        // seconds; 0 = stays open until closed
  closeAfterSubmit: number; // seconds after a form inside it was sent; 0 = stays open
};

export const DEFAULT_POPUP: PopupSettings = {
  slug: '', trashed: false,
  type: 'modal', width: 560, widthUnit: 'px', maxHeight: 0, bg: '#FFFFFF', overlay: '#0B1220', overlayOpacity: 60, radius: 12, shadow: 'strong',
  closeStyle: 'circle', closePos: 'inside', animation: 'zoom', zIndex: 9000,
  delay: 5, scroll: null, exit: false, idle: null, views: null,
  pages: 'all', paths: [], devices: { d: true, t: true, m: true }, visitors: 'everyone', start: '', end: '',
  freq: 'days', days: 7, neverAfterSubmit: true, autoClose: 0, closeAfterSubmit: 4,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback);
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};
const optNum = (v: unknown, min: number, max: number): number | null => {
  if (v === null || v === undefined || v === '' || v === false) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : null;
};
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const dateStr = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim().replace('T', ' ') : '';
  const m = /^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/.exec(s);
  if (!m) return '';
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:00Z`);
  return Number.isNaN(d.getTime()) ? '' : `${m[1]}-${m[2]}-${m[3]} ${m[4] ?? '00'}:${m[5] ?? '00'}`;
};

/** A path rule: "/", "/products", "/products*", "/services/*" — stored normalised (leading slash, lower-case, no trailing slash). */
export function normPathRule(v: string): string {
  let s = String(v || '').trim().toLowerCase().replace(/[\u0000-\u001f\u007f\s"'<>\\]/g, '');
  if (!s) return '';
  s = s.replace(/^https?:\/\/[^/]+/, '');
  if (!s.startsWith('/')) s = `/${s}`;
  s = s.replace(/\/{2,}/g, '/').replace(/\?.*$/, '').replace(/#.*$/, '');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s.slice(0, 200);
}

/** Does a rule ("*" = anything) match a normalised path ('' = home)? Case-insensitive; "/products*" also matches "/products/x". */
export function pathMatches(rule: string, path: string): boolean {
  const p = `/${String(path || '').replace(/^\/+|\/+$/g, '').toLowerCase()}`;
  const r = normPathRule(rule);
  if (!r) return false;
  if (!r.includes('*')) return r === p;
  const re = new RegExp(`^${r.split('*').map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`);
  return re.test(p);
}

/** Validate + clamp everything (never trust the browser or an import). Unknown keys are dropped. */
export function normalisePopupSettings(raw: unknown, name = ''): PopupSettings {
  const r: any = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const d = DEFAULT_POPUP;
  const dev = r.devices && typeof r.devices === 'object' ? r.devices : {};
  const paths: string[] = [];
  for (const p of Array.isArray(r.paths) ? r.paths : typeof r.paths === 'string' ? r.paths.split(/\r?\n|,/) : []) {
    const n = normPathRule(String(p));
    if (n && !paths.includes(n) && paths.length < 50) paths.push(n);
  }
  const slug = slugify(String(r.slug || name || '')).slice(0, 60);
  return {
    slug,
    trashed: r.trashed === true,
    type: oneOf(r.type, POPUP_TYPES.map((t) => t.value), d.type),
    width: num(r.width, 120, 3000, d.width),
    widthUnit: oneOf(r.widthUnit, ['px', '%'] as const, d.widthUnit),
    maxHeight: num(r.maxHeight, 0, 100, d.maxHeight),
    bg: HEX.test(String(r.bg)) ? String(r.bg) : d.bg,
    overlay: HEX.test(String(r.overlay)) ? String(r.overlay) : d.overlay,
    overlayOpacity: num(r.overlayOpacity, 0, 100, d.overlayOpacity),
    radius: num(r.radius, 0, 60, d.radius),
    shadow: oneOf(r.shadow, ['none', 'soft', 'strong'] as const, d.shadow),
    closeStyle: oneOf(r.closeStyle, ['icon', 'circle', 'text'] as const, d.closeStyle),
    closePos: oneOf(r.closePos, ['inside', 'outside', 'left'] as const, d.closePos),
    animation: oneOf(r.animation, ['fade', 'slide', 'zoom', 'none'] as const, d.animation),
    zIndex: num(r.zIndex, 100, 100000, d.zIndex),
    delay: optNum(r.delay, 0, 3600),
    scroll: optNum(r.scroll, 1, 100),
    exit: bool(r.exit, false),
    idle: optNum(r.idle, 1, 3600),
    views: optNum(r.views, 1, 100),
    pages: oneOf(r.pages, ['all', 'home', 'include', 'exclude'] as const, d.pages),
    paths,
    devices: { d: bool(dev.d, true), t: bool(dev.t, true), m: bool(dev.m, true) },
    visitors: oneOf(r.visitors, ['everyone', 'guests'] as const, d.visitors),
    start: dateStr(r.start),
    end: dateStr(r.end),
    freq: oneOf(r.freq, ['always', 'session', 'visitor', 'days'] as const, d.freq),
    days: num(r.days, 1, 3650, d.days),
    neverAfterSubmit: bool(r.neverAfterSubmit, d.neverAfterSubmit),
    autoClose: num(r.autoClose, 0, 3600, d.autoClose),
    closeAfterSubmit: num(r.closeAfterSubmit, 0, 60, d.closeAfterSubmit),
  };
}

/** The "#popup:<slug>" / "#dr-popup-<id>" / "#popup-close" link values (the link control's Open popup / Close popup actions). */
export const popupLink = (slug: string) => `#popup:${slug}`;
export const POPUP_CLOSE_LINK = '#popup-close';
export const isPopupLink = (u: unknown): boolean => typeof u === 'string' && safeUrl(u) !== '' && /^#(popup:[a-z0-9-]+|dr-popup-\d+|popup-close)$/.test(u);

/** One-line description of when a popup appears, for the admin list. */
export function triggerSummary(s: PopupSettings): string {
  const t: string[] = [];
  if (s.delay !== null) t.push(`after ${s.delay}s`);
  if (s.scroll !== null) t.push(`at ${s.scroll}% scroll`);
  if (s.exit) t.push('on exit intent');
  if (s.idle !== null) t.push(`after ${s.idle}s idle`);
  if (s.views !== null) t.push(`on page view ${s.views}`);
  t.push(`link #popup:${s.slug || '…'}`);
  return t.join(' · ');
}

export function rulesSummary(s: PopupSettings): string {
  const where = s.pages === 'all' ? 'every page' : s.pages === 'home' ? 'home page only' : s.pages === 'include' ? `${s.paths.length} listed page${s.paths.length === 1 ? '' : 's'}` : `all except ${s.paths.length} page${s.paths.length === 1 ? '' : 's'}`;
  const dev = (['d', 't', 'm'] as const).filter((k) => s.devices[k]).map((k) => ({ d: 'desktop', t: 'tablet', m: 'mobile' })[k]);
  return `${where}${dev.length === 3 ? '' : ` · ${dev.join('/') || 'no devices'}`}${s.visitors === 'guests' ? ' · signed-out only' : ''}`;
}

/** What the browser needs to decide when to show a popup (everything else stays on the server). */
export type PopupClientSettings = Pick<PopupSettings, 'type' | 'width' | 'widthUnit' | 'maxHeight' | 'bg' | 'overlay' | 'overlayOpacity' | 'radius' | 'shadow' | 'closeStyle' | 'closePos' | 'animation' | 'zIndex' | 'delay' | 'scroll' | 'exit' | 'idle' | 'views' | 'devices' | 'freq' | 'days' | 'neverAfterSubmit' | 'autoClose' | 'closeAfterSubmit'>;
export function clientSettings(s: PopupSettings): PopupClientSettings {
  const { type, width, widthUnit, maxHeight, bg, overlay, overlayOpacity, radius, shadow, closeStyle, closePos, animation, zIndex, delay, scroll, exit, idle, views, devices, freq, days, neverAfterSubmit, autoClose, closeAfterSubmit } = s;
  return { type, width, widthUnit, maxHeight, bg, overlay, overlayOpacity, radius, shadow, closeStyle, closePos, animation, zIndex, delay, scroll, exit, idle, views, devices, freq, days, neverAfterSubmit, autoClose, closeAfterSubmit };
}
