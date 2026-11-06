// Tracking IDs + custom code (Studio CMS → Tracking & code): read side, validated again on every read.
import { all } from './db';
import { TRACKER_FIELDS, trackKey, trustedId } from './tracking-core.mjs';
import { cleanCss, cleanRawHtml } from './html-snippet.mjs';

export const CODE_KEYS = ['code_css', 'code_head', 'code_body', 'code_footer'] as const;
const SETTING_KEYS = [...TRACKER_FIELDS.map((f: { key: string }) => trackKey(f.key)), 'track_skip_users', ...CODE_KEYS];

export type Tracking = {
  ga4: string; gtm: string; ads: string; ads_label: string; meta: string; linkedin: string; tiktok: string; clarity: string;
  /** Leave the built-in trackers out for signed-in CMS users (default on). */
  skipUsers: boolean;
  css: string; head: string; body: string; footer: string;
};

export function getTracking(): Tracking {
  const raw: Record<string, string> = {};
  try {
    for (const r of all<{ key: string; value: string }>(`SELECT key, value FROM settings WHERE key IN (${SETTING_KEYS.map(() => '?').join(',')})`, ...SETTING_KEYS)) raw[r.key] = r.value;
  } catch { /* unreadable DB: nothing is tracked */ }
  const id = (k: string) => trustedId(k, raw[trackKey(k)]);
  return {
    ga4: id('ga4'), gtm: id('gtm'), ads: id('ads'), ads_label: id('ads_label'), meta: id('meta'), linkedin: id('linkedin'), tiktok: id('tiktok'), clarity: id('clarity'),
    skipUsers: raw.track_skip_users !== '0',
    css: cleanCss(raw.code_css),
    head: cleanRawHtml(raw.code_head),
    body: cleanRawHtml(raw.code_body),
    footer: cleanRawHtml(raw.code_footer),
  };
}

export const hasTrackers = (t: Tracking) => !!(t.ga4 || t.gtm || t.ads || t.meta || t.linkedin || t.tiktok || t.clarity);
