'use server';

// Tracking IDs + custom CSS / JavaScript / HTML. Requires manage_code (administrators only): the code is output raw on every
// public page, so it is as powerful as the server itself. Tracking IDs are strictly validated and never accepted if malformed.
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { setSetting, transaction } from '@/lib/db';
import { cleanCss, cleanRawHtml, parseHeadSnippet } from '@/lib/html-snippet.mjs';
import { TRACKER_FIELDS, trackKey, validateTracking } from '@/lib/tracking-core.mjs';

export type TrackingState = {
  ok: boolean;
  saved?: boolean;
  /** one message per rejected tracking ID, keyed by field */
  errors: Record<string, string>;
  warnings: string[];
};

export async function saveTracking(_prev: TrackingState, fd: FormData): Promise<TrackingState> {
  const user = await requireCap('manage_code');

  const { values, errors } = validateTracking(Object.fromEntries(TRACKER_FIELDS.map((f: { key: string }) => [f.key, fd.get(trackKey(f.key))]))) as { values: Record<string, string>; errors: Record<string, string> };
  if (Object.keys(errors).length) return { ok: false, errors, warnings: [] }; // nothing is saved while any ID is invalid

  const css = cleanCss(String(fd.get('code_css') ?? ''));
  const head = cleanRawHtml(String(fd.get('code_head') ?? ''));
  const body = cleanRawHtml(String(fd.get('code_body') ?? ''));
  const footer = cleanRawHtml(String(fd.get('code_footer') ?? ''));
  const skip = fd.get('track_skip_users') === 'on';

  const warnings: string[] = [];
  const ignored = parseHeadSnippet(head).ignored;
  if (ignored.length) warnings.push(`Header code: ${ignored.slice(0, 4).join(', ')}${ignored.length > 4 ? '…' : ''} can’t go inside <head> and will be ignored. Put it in “Body-open code” instead.`);
  if (values.gtm && values.ga4) warnings.push('Both Google Tag Manager and Google Analytics 4 are set. If GA4 is already configured inside your GTM container, remove the GA4 ID here or its page views will be counted twice.');

  transaction(() => {
    for (const f of TRACKER_FIELDS as { key: string }[]) setSetting(trackKey(f.key), values[f.key]);
    setSetting('track_skip_users', skip ? '1' : '0');
    setSetting('code_css', css);
    setSetting('code_head', head);
    setSetting('code_body', body);
    setSetting('code_footer', footer);
  });
  logActivity(user, 'update', 'tracking', '', 'Saved tracking IDs and custom code');
  revalidatePath('/', 'layout');
  return { ok: true, saved: true, errors: {}, warnings };
}
