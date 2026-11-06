'use server';

// Menus: create / delete / save. Every action starts with requireCap — actions are public HTTP endpoints.
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCap } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { safeUrl } from '@/lib/builder/url.mjs';
import type { MenuItem } from '@/lib/builder/types';
import { get, run } from '@/lib/db';
import { slugify } from '@/lib/slug.mjs';

const MAX_ITEMS = 100;
const MAX_DEPTH = 2; // top level + one level of children (the navigation widget renders no more)
const ID = /^[\w-]{1,40}$/;

const clip = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '');
const flag = (v: unknown) => v === true || v === 'true' || v === 1;

class Bad extends Error {}

function cleanList(list: unknown, depth: number, st: { count: number; ids: Set<string> }): MenuItem[] {
  if (!Array.isArray(list)) return [];
  const out: MenuItem[] = [];
  for (const r of list) {
    if (!r || typeof r !== 'object') continue;
    if (++st.count > MAX_ITEMS) throw new Bad(`A menu can have at most ${MAX_ITEMS} items.`);

    const label = clip((r as any).label, 120);
    if (!label) throw new Bad('Every menu item needs a label.');

    let children: MenuItem[] = [];
    if (Array.isArray((r as any).children) && (r as any).children.length) {
      if (depth + 1 >= MAX_DEPTH) throw new Bad('Menus can only be nested two levels deep.');
      children = cleanList((r as any).children, depth + 1, st);
    }

    let url = clip((r as any).url, 2000);
    if (url) {
      const safe = safeUrl(url);
      if (!safe) throw new Bad(`“${label}”: the link must start with https://, http://, mailto:, tel:, / or #.`);
      url = safe;
    } else if (!children.length) {
      throw new Bad(`“${label}” needs a link (only items with sub-items can go without).`);
    }

    let id = typeof (r as any).id === 'string' ? (r as any).id : '';
    if (!ID.test(id) || st.ids.has(id)) id = `m${randomBytes(5).toString('hex')}`;
    st.ids.add(id);

    const item: MenuItem = { id, label, url };
    const description = clip((r as any).description, 200);
    if (description) item.description = description;
    if (flag((r as any).newTab)) item.newTab = true;
    if (flag((r as any).cta)) item.cta = true;
    if (flag((r as any).dark)) item.dark = true;
    if (flag((r as any).sepBefore)) item.sepBefore = true;
    if (children.length) item.children = children;
    out.push(item);
  }
  return out;
}

export type SaveMenuResult = { ok: true; name: string; items: MenuItem[] } | { ok: false; error: string };

/** Validate + normalise the editor's tree and store it. Returns the cleaned tree so the editor can sync its ids. */
export async function saveMenu(id: number, name: string, rawItems: unknown): Promise<SaveMenuResult> {
  const user = await requireCap('manage_menus');
  const menu = get<{ id: number; slug: string; name: string }>('SELECT id, slug, name FROM menus WHERE id = ?', Number(id));
  if (!menu) return { ok: false, error: 'That menu no longer exists.' };
  const title = clip(name, 80) || menu.name;
  try {
    const items = cleanList(rawItems, 0, { count: 0, ids: new Set() });
    run("UPDATE menus SET name = ?, items = ?, updated_at = datetime('now') WHERE id = ?", title, JSON.stringify(items), menu.id);
    logActivity(user, 'update', 'menu', menu.id, `Saved menu “${title}” (${items.length} top-level items)`);
    revalidatePath('/', 'layout'); // the public site and every cached page pick up the new menu
    return { ok: true, name: title, items };
  } catch (err) {
    if (err instanceof Bad) return { ok: false, error: err.message };
    throw err;
  }
}

export async function createMenu(fd: FormData) {
  const user = await requireCap('manage_menus');
  const name = clip(fd.get('name'), 80);
  if (!name) redirect(`/admin/menus?error=${encodeURIComponent('Give the menu a name.')}`);
  const base = slugify(name);
  let slug = base;
  for (let n = 2; get('SELECT 1 AS x FROM menus WHERE slug = ?', slug); n++) slug = `${base}-${n}`;
  run('INSERT INTO menus (name, slug, items) VALUES (?, ?, ?)', name, slug, '[]');
  logActivity(user, 'create', 'menu', slug, `Created menu “${name}”`);
  redirect(`/admin/menus?menu=${encodeURIComponent(slug)}&saved=1`);
}

export async function deleteMenu(id: number) {
  const user = await requireCap('manage_menus');
  const menu = get<{ id: number; slug: string; name: string }>('SELECT id, slug, name FROM menus WHERE id = ?', Number(id));
  if (!menu) redirect('/admin/menus');
  if (menu.slug === 'primary') redirect(`/admin/menus?menu=primary&error=${encodeURIComponent('The primary menu can’t be deleted — the site header uses it.')}`);
  run('DELETE FROM menus WHERE id = ?', menu.id);
  logActivity(user, 'delete', 'menu', menu.slug, `Deleted menu “${menu.name}”`);
  revalidatePath('/', 'layout');
  redirect('/admin/menus?saved=1');
}
