'use server';

// Popups admin actions. Administrators and editors (manage_forms). Every action starts with requireCap; content always goes through
// sanitizeDoc; settings through normalisePopupSettings. Popups are templates of kind 'popup' (the builder edits their content).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { POPUP_PRESETS } from '@/db/popup-presets.mjs';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { sanitizeDoc } from '@/lib/builder/sanitize.mjs';
import { cloneNode, parseDoc } from '@/lib/builder/tree.mjs';
import { get, run, transaction } from '@/lib/db';
import { FORM_TEMPLATES } from '@/lib/form-templates';
import { normaliseFormInput } from '@/lib/forms-shared';
import { getPopup, popupsReady, uniquePopupSlug } from '@/lib/popups';
import { normalisePopupSettings, type PopupSettings } from '@/lib/popups-shared';
import { NOT_READY_MESSAGE } from '@/lib/schema-ready';
import { slugify } from '@/lib/slug.mjs';

const EMPTY = '{"v":1,"nodes":[]}';
const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const live = () => revalidatePath('/', 'layout');

function go(params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  redirect(qs ? `/admin/popups?${qs}` : '/admin/popups');
}
function ready() {
  if (!popupsReady()) go({ error: NOT_READY_MESSAGE });
}
const cleanDoc = (content: string, isAdmin: boolean): string => {
  const doc = { v: 1, nodes: parseDoc(content).nodes.map(cloneNode) };
  try {
    return JSON.stringify(sanitizeDoc(doc, { isAdmin, prev: doc }).doc);
  } catch {
    return EMPTY;
  }
};

/** The "Get a quote" popup needs a form: reuse "Quote request" if it exists, else create it from the Quote template. */
function ensureQuoteForm(): number {
  const found = get<{ id: number }>("SELECT id FROM forms WHERE slug = 'quote-request' OR name = 'Quote request' ORDER BY id LIMIT 1");
  if (found) return found.id;
  const tpl = FORM_TEMPLATES.find((t) => t.id === 'quote')!;
  const parsed = normaliseFormInput({ name: tpl.name, slug: 'quote-request', fields: tpl.fields, settings: tpl.settings });
  if ('error' in parsed) throw new Error(parsed.error);
  const v = parsed.value;
  let slug = v.slug;
  for (let n = 2; get('SELECT 1 AS x FROM forms WHERE slug = ?', slug); n++) slug = `${v.slug}-${n}`;
  return run('INSERT INTO forms (name, slug, fields, settings) VALUES (?, ?, ?, ?)', v.name, slug, JSON.stringify(v.fields), JSON.stringify(v.settings)).lastInsertRowid;
}

export async function createPopup(fd: FormData) {
  const user = await requireCap('manage_forms');
  ready();
  const id = clip(fd.get('preset'), 30);
  const preset = (POPUP_PRESETS as Record<string, any>)[id];
  if (!preset) go({ error: 'Choose a starting point for the popup.' });
  const name = clip(fd.get('name'), 120) || preset.name;
  const formId = preset.needsForm === 'quote' ? ensureQuoteForm() : 0;
  const content = cleanDoc(JSON.stringify({ v: 1, nodes: preset.content({ formId }) }), user.role === 'administrator');
  const settings = normalisePopupSettings({ ...preset.settings, slug: uniquePopupSlug(slugify(name)) }, name);
  const r = run("INSERT INTO templates (kind, name, content, active, author_id, settings) VALUES ('popup', ?, ?, 0, ?, ?)", name, content, user.id, JSON.stringify(settings));
  logActivity(user, 'create', 'popup', r.lastInsertRowid, name);
  redirect(`/admin/builder/tpl-${r.lastInsertRowid}`);
}

export async function duplicatePopup(fd: FormData) {
  const user = await requireCap('manage_forms');
  ready();
  const src = getPopup(Number(fd.get('id')));
  if (!src) go({ error: 'That popup no longer exists.' });
  const name = `${src!.name} (copy)`.slice(0, 120);
  const settings: PopupSettings = { ...src!.settings, trashed: false, slug: uniquePopupSlug(`${src!.settings.slug}-copy`) };
  const r = run("INSERT INTO templates (kind, name, content, active, author_id, settings) VALUES ('popup', ?, ?, 0, ?, ?)", name, cleanDoc(src!.content, user.role === 'administrator'), user.id, JSON.stringify(settings));
  logActivity(user, 'duplicate', 'popup', r.lastInsertRowid, `${name} (from #${src!.id})`);
  go({ msg: `Duplicated as “${name}” (switched off).` });
}

export async function setPopupActive(fd: FormData) {
  const user = await requireCap('manage_forms');
  ready();
  const p = getPopup(Number(fd.get('id')));
  if (!p) go({ error: 'That popup no longer exists.' });
  const on = fd.get('on') === '1';
  if (on && p!.settings.trashed) go({ error: 'Restore the popup from the trash first.' });
  run("UPDATE templates SET active = ? WHERE id = ? AND kind = 'popup'", on ? 1 : 0, p!.id);
  logActivity(user, on ? 'activate' : 'deactivate', 'popup', p!.id, p!.name);
  live();
  go({ msg: on ? `“${p!.name}” is now live${p!.settings.start ? ' (it appears from its start date)' : ''}.` : `“${p!.name}” is switched off.` });
}

export async function renamePopup(fd: FormData) {
  const user = await requireCap('manage_forms');
  ready();
  const p = getPopup(Number(fd.get('id')));
  const name = clip(fd.get('name'), 120);
  if (!p) go({ error: 'That popup no longer exists.' });
  if (!name) go({ error: 'The name can’t be empty.' });
  run("UPDATE templates SET name = ? WHERE id = ? AND kind = 'popup'", name, p!.id);
  logActivity(user, 'rename', 'popup', p!.id, `${p!.name} → ${name}`);
  live();
  go({ msg: 'Renamed.' });
}

function setTrashed(id: number, trashed: boolean) {
  const p = getPopup(id);
  if (!p) go({ error: 'That popup no longer exists.' });
  run("UPDATE templates SET settings = ?, active = ? WHERE id = ? AND kind = 'popup'", JSON.stringify({ ...p!.settings, trashed }), trashed ? 0 : p!.active, p!.id);
  return p!;
}

export async function trashPopup(fd: FormData) {
  const user = await requireCap('manage_forms');
  ready();
  const p = setTrashed(Number(fd.get('id')), true);
  logActivity(user, 'trash', 'popup', p.id, p.name);
  live();
  go({ msg: `“${p.name}” moved to the trash.` });
}

export async function restorePopup(fd: FormData) {
  const user = await requireCap('manage_forms');
  ready();
  const p = setTrashed(Number(fd.get('id')), false);
  logActivity(user, 'restore', 'popup', p.id, p.name);
  go({ msg: `“${p.name}” restored (switched off).` });
}

export async function deletePopup(fd: FormData) {
  const user = await requireCap('manage_forms');
  ready();
  const p = getPopup(Number(fd.get('id')));
  if (!p) go({ error: 'That popup no longer exists.' });
  if (!p!.settings.trashed) go({ error: 'Move the popup to the trash before deleting it.' });
  transaction(() => {
    run("DELETE FROM revisions WHERE entity = 'template' AND entity_id = ?", p!.id);
    run("DELETE FROM templates WHERE id = ? AND kind = 'popup'", p!.id);
  });
  logActivity(user, 'delete', 'popup', p!.id, p!.name);
  live();
  go({ msg: `“${p!.name}” was deleted.` });
}

/** From the builder's Popup tab. Settings are validated + clamped here; "trashed" can't be changed from the browser. */
export async function savePopupSettings(id: number, raw: unknown): Promise<{ ok: boolean; error?: string; settings?: PopupSettings }> {
  const user = await requireCap('manage_forms');
  if (!popupsReady()) return { ok: false, error: NOT_READY_MESSAGE };
  const p = getPopup(Number(id));
  if (!p) return { ok: false, error: 'That popup no longer exists.' };
  const next = normalisePopupSettings({ ...(raw as object), trashed: p.settings.trashed }, p.name);
  if (!next.slug) return { ok: false, error: 'The popup needs a link name (slug), e.g. “newsletter”.' };
  if (uniquePopupSlug(next.slug, p.id) !== next.slug) return { ok: false, error: `Another popup already uses the link name “${next.slug}”. Choose a different one.` };
  // (does not touch updated_at: that is the builder's version stamp for the content)
  run("UPDATE templates SET settings = ? WHERE id = ? AND kind = 'popup'", JSON.stringify(next), p.id);
  logActivity(user, 'edit', 'popup', p.id, `${p.name} (popup settings)`);
  live();
  return { ok: true, settings: next };
}
