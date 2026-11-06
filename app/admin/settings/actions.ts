'use server';

// Site settings — requires manage_settings.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { safeMediaUrl } from '@/lib/builder/url.mjs';
import { get, setSetting, transaction } from '@/lib/db';
import { isKnownMediaUrl } from '@/lib/media';
import { parsePalette } from '@/lib/palette';
import { EMAIL_RE } from '@/lib/users';

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);

/** Image settings use the media library field (`<key>__pick` holds the URL, '' = removed). The current value is always taken from the DB. */
const IMAGE_KEYS = ['site_logo', 'site_favicon', 'seo_default_og_image', 'bar_diagram_nominal', 'bar_diagram_side', 'bar_diagram_actual'] as const;

export async function saveSettings(fd: FormData) {
  const user = await requireCap('manage_settings');
  const warnings: string[] = [];
  const next: Record<string, string> = {
    site_title: clip(fd.get('site_title'), 80),
    site_tagline: clip(fd.get('site_tagline'), 160),
    contact_phone: clip(fd.get('contact_phone'), 40),
    contact_email: clip(fd.get('contact_email'), 200),
    contact_address: clip(fd.get('contact_address'), 400),
    seo_default_description: clip(fd.get('seo_default_description'), 320),
    notify_emails: clip(fd.get('notify_emails'), 300),
  };

  if (next.contact_email && !EMAIL_RE.test(next.contact_email)) redirect(`/admin/settings?error=${encodeURIComponent('The contact email is not a valid email address.')}`);
  const bad = next.notify_emails.split(/[,;\s]+/).filter(Boolean).find((e) => !EMAIL_RE.test(e));
  if (bad) redirect(`/admin/settings?error=${encodeURIComponent(`“${bad}” is not a valid email address.`)}`);

  // brand colours: JSON [["#182845","Navy"],…]; an empty list means "use the built-in palette"
  const rawPalette = String(fd.get('design_palette') ?? '').trim();
  if (rawPalette && rawPalette !== '[]') {
    const p = parsePalette(rawPalette);
    if (!p) redirect(`/admin/settings?error=${encodeURIComponent('The colour list is not valid (each colour needs a hex value like #182845).')}`);
    next.design_palette = JSON.stringify(p);
  } else next.design_palette = '';

  for (const key of IMAGE_KEYS) {
    const current = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value ?? '';
    const picked = fd.get(`${key}__pick`);
    if (typeof picked !== 'string') { next[key] = current; continue; }
    const url = safeMediaUrl(picked.trim());
    if (!url || url === current) next[key] = url;
    else if (isKnownMediaUrl(url, 'image')) next[key] = url;
    else { warnings.push('One of the chosen images is not in the media library, so it was not changed.'); next[key] = current; }
  }

  transaction(() => {
    for (const [k, v] of Object.entries(next)) setSetting(k, v);
  });
  logActivity(user, 'update', 'settings', '', 'Saved site settings');
  revalidatePath('/', 'layout'); // titles, icons and the public pages pick the change up
  const qs = new URLSearchParams({ saved: '1' });
  if (warnings.length) qs.set('warn', [...new Set(warnings)].join(' '));
  redirect(`/admin/settings?${qs}`);
}
