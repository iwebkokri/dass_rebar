// First-touch attribution: where a visitor came from. Captured ONCE per browser session (sessionStorage) on their first public page and
// posted along with any form they submit. Plain text only: utm_* parameters, the landing page and document.referrer — nothing personal,
// nothing is sent anywhere except with a form post. Client-safe (no node imports); the server re-validates with cleanAttribution().
export const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;
export type Attribution = Partial<Record<(typeof UTM_KEYS)[number] | 'landing_url' | 'referrer', string>>;

const STORE_KEY = 'dr_attr';

/** Call on every public page load; it only stores something on the first page of the session. Never throws. */
export function captureAttribution(): void {
  try {
    if (window.sessionStorage.getItem(STORE_KEY)) return;
    const sp = new URLSearchParams(window.location.search);
    const a: Attribution = {};
    for (const k of UTM_KEYS) {
      const v = sp.get(k);
      if (v) a[k] = v.slice(0, 200);
    }
    a.landing_url = (window.location.origin + window.location.pathname + window.location.search).slice(0, 500);
    if (document.referrer) a.referrer = document.referrer.slice(0, 500);
    window.sessionStorage.setItem(STORE_KEY, JSON.stringify(a));
  } catch {
    /* storage blocked (private mode, cookies off): attribution is simply not recorded */
  }
}

/** The stored value as a JSON string for the form post ('' when nothing was captured). */
export function readAttribution(): string {
  try {
    return window.sessionStorage.getItem(STORE_KEY) || '';
  } catch {
    return '';
  }
}

const plain = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f<>"'\\`]/g, '').trim().slice(0, max);
const httpUrl = (v: unknown) => {
  const s = plain(v, 500);
  return /^https?:\/\/[^\s]+$/i.test(s) ? s : '';
};

/** Server side: only the known keys, plain text, length-capped. Returns {} for anything unexpected. */
export function cleanAttribution(raw: unknown): Attribution {
  let obj: any = raw;
  if (typeof raw === 'string') {
    if (!raw || raw.length > 4000) return {};
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out: Attribution = {};
  for (const k of UTM_KEYS) {
    const v = plain(obj[k], 200);
    if (v) out[k] = v;
  }
  const landing = httpUrl(obj.landing_url);
  if (landing) out.landing_url = landing;
  const ref = httpUrl(obj.referrer);
  if (ref) out.referrer = ref;
  return out;
}
