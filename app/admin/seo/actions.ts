'use server';

// SEO & AI settings (site-wide) and the 404 monitor. Requires manage_seo (administrators). Every action re-checks it:
// server actions are public HTTP endpoints.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { safeMediaUrl } from '@/lib/builder/url.mjs';
import { get, setSetting } from '@/lib/db';
import { isKnownMediaUrl } from '@/lib/media';
import { checkRedirect, saveRedirect } from '@/lib/redirects';
import { clear404, get404, remove404, setIgnored } from '@/lib/seo-log';
import { AI_BOTS, cleanEntity, cleanGeneral, cleanLlms, cleanRobots } from '@/lib/seo-core.mjs';

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const done = (tab: string, params: Record<string, string> = {}): never => {
  const qs = new URLSearchParams({ tab, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v)) });
  redirect(`/admin/seo?${qs}`);
};
const live = () => revalidatePath('/', 'layout');

// ------------------------------------------------------------------ general
export async function saveSeoGeneral(fd: FormData) {
  const user = await requireCap('manage_seo');
  const general = cleanGeneral({
    sep: fd.get('sep'), template: fd.get('template'), twitter: fd.get('twitter'), locale: fd.get('locale'), noindexSite: fd.get('noindexSite') === 'on',
    verify: { google: fd.get('v_google'), bing: fd.get('v_bing'), yandex: fd.get('v_yandex'), pinterest: fd.get('v_pinterest'), facebook: fd.get('v_facebook') },
  });
  const warn: string[] = [];
  for (const [field, key, label] of [['v_google', 'google', 'Google'], ['v_bing', 'bing', 'Bing'], ['v_yandex', 'yandex', 'Yandex'], ['v_pinterest', 'pinterest', 'Pinterest'], ['v_facebook', 'facebook', 'Facebook']] as const) {
    if (clip(fd.get(field), 400) && !general.verify[key]) warn.push(`The ${label} verification code wasn’t valid, so it was not saved.`);
  }
  if (clip(fd.get('twitter'), 40) && !general.twitter) warn.push('The Twitter / X handle wasn’t valid (letters, digits and underscore, up to 15).');

  setSetting('seo_general', JSON.stringify(general));
  setSetting('seo_default_description', clip(fd.get('seo_default_description'), 320));
  const current = get<{ value: string }>('SELECT value FROM settings WHERE key = ?', 'seo_default_og_image')?.value ?? '';
  const picked = fd.get('seo_default_og_image__pick');
  if (typeof picked === 'string') {
    const url = safeMediaUrl(picked.trim());
    if (!url || url === current || isKnownMediaUrl(url, 'image')) setSetting('seo_default_og_image', url);
    else warn.push('The chosen social image is not in the media library, so it was not changed.');
  }
  logActivity(user, 'update', 'seo', '', `Saved SEO general settings${general.noindexSite ? ' (site hidden from search engines)' : ''}`);
  live();
  done('general', { saved: '1', warn: warn.join(' ') });
}

// ------------------------------------------------------------------ business
export async function saveSeoEntity(fd: FormData) {
  const user = await requireCap('manage_seo');
  const get_ = (k: string) => fd.get(k);
  const { entity, droppedHours } = cleanEntity({
    type: get_('type'), name: get_('name'), legal: get_('legal'), logo: get_('logo__pick') ?? '', description: get_('description'), founded: get_('founded'),
    email: get_('email'), phone: get_('phone'), street: get_('street'), city: get_('city'), region: get_('region'), postal: get_('postal'), country: get_('country'),
    lat: get_('lat'), lng: get_('lng'), hours: get_('hours'), areas: get_('areas'), sameAs: get_('sameAs'),
  });
  const warn: string[] = [];
  if (droppedHours) warn.push(`${droppedHours} opening-hours line${droppedHours > 1 ? 's were' : ' was'} not in the format “Mo-Fr 07:00-17:00” and ${droppedHours > 1 ? 'were' : 'was'} skipped.`);
  if (entity.logo && !isKnownMediaUrl(entity.logo, 'image') && !/^https?:\/\//i.test(entity.logo)) { entity.logo = ''; warn.push('The logo is not in the media library, so it was not saved.'); }
  setSetting('seo_entity', JSON.stringify(entity));
  logActivity(user, 'update', 'seo', '', 'Saved business profile');
  live();
  done('business', { saved: '1', warn: warn.join(' ') });
}

// ------------------------------------------------------------------ robots
export async function saveSeoRobots(fd: FormData) {
  const user = await requireCap('manage_seo');
  const bots: Record<string, string> = {};
  for (const b of AI_BOTS as { ua: string }[]) bots[b.ua] = fd.get(`bot_${b.ua}`) === 'disallow' ? 'disallow' : 'allow';
  const robots = cleanRobots({ bots, extra: String(fd.get('extra') ?? '') });
  setSetting('seo_robots', JSON.stringify(robots));
  const blocked = Object.entries(robots.bots).filter(([, v]) => v === 'disallow').map(([k]) => k);
  logActivity(user, 'update', 'seo', '', blocked.length ? `Saved crawler rules (blocked: ${blocked.join(', ')})` : 'Saved crawler rules (all allowed)');
  live();
  done('robots', { saved: '1' });
}

// ------------------------------------------------------------------ llms.txt
export async function saveSeoLlms(fd: FormData) {
  const user = await requireCap('manage_seo');
  const llms = cleanLlms({ enabled: fd.get('enabled') === 'on', intro: String(fd.get('intro') ?? '') });
  setSetting('seo_llms', JSON.stringify(llms));
  logActivity(user, 'update', 'seo', '', `llms.txt ${llms.enabled ? 'on' : 'off'}`);
  live();
  done('ai', { saved: '1' });
}

// ------------------------------------------------------------------ 404 monitor
export async function create404Redirect(fd: FormData) {
  const user = await requireCap('manage_seo');
  await requireCap('manage_site'); // redirects are a site-management feature
  const id = Number(fd.get('id'));
  const row = get404(id);
  if (!row) done('404', { error: 'That entry no longer exists.' });
  const checked = checkRedirect({ from: row!.path, to: clip(fd.get('to'), 2000), code: 301 });
  if (!checked.ok) done('404', { error: checked.error ?? 'Could not create the redirect.' });
  saveRedirect(checked, true);
  remove404(id);
  logActivity(user, 'create', 'redirect', '', `${checked.from} → ${checked.to} (from the 404 monitor)`);
  live();
  done('404', { saved: '1' });
}

export async function set404Ignored(fd: FormData) {
  await requireCap('manage_seo');
  setIgnored(Number(fd.get('id')), fd.get('ignored') === '1');
  done('404', { show: fd.get('ignored') === '1' ? '' : 'ignored', saved: '1' }); // un-ignoring happens from the "ignored" list: stay there
}

export async function delete404(fd: FormData) {
  await requireCap('manage_seo');
  remove404(Number(fd.get('id')));
  done('404', { saved: '1', show: fd.get('show') === 'ignored' ? 'ignored' : '' });
}

export async function clear404Log() {
  const user = await requireCap('manage_seo');
  const n = clear404(false);
  logActivity(user, 'delete', 'seo', '', `Cleared the 404 monitor (${n} entries)`);
  done('404', { saved: '1' });
}
