'use server';

// Categories and tags (one set of actions, the taxonomy comes from the route).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { all, get, run, transaction } from '@/lib/db';
import { refreshPrimaryCategory, uniqueTermSlug } from '@/lib/posts';
import { slugify } from '@/lib/slug.mjs';

type Taxonomy = 'category' | 'tag';
const page = (t: Taxonomy) => (t === 'category' ? '/admin/categories' : '/admin/tags');
const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\u0000/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, max);

function go(pathname: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  redirect(qs ? `${pathname}?${qs}` : pathname);
}

const refresh = () => revalidatePath('/', 'layout');

/** Add (no `id` field) or edit (`id`) a category / tag. */
export async function saveTerm(taxonomy: Taxonomy, fd: FormData) {
  const user = await requireCap('manage_terms');
  if (taxonomy !== 'category' && taxonomy !== 'tag') go('/admin');
  const id = Math.trunc(Number(fd.get('id'))) || 0;
  const existing = id ? get<{ id: number; name: string }>('SELECT id, name FROM terms WHERE id = ? AND taxonomy = ?', id, taxonomy) : undefined;
  const here = id ? `${page(taxonomy)}?edit=${id}` : page(taxonomy);
  if (id && !existing) go(page(taxonomy), { error: 'That item no longer exists.' });

  const name = clip(fd.get('name'), 60);
  if (!name) go(here, { error: 'The name is required.' });
  if (get('SELECT 1 AS x FROM terms WHERE taxonomy = ? AND name = ? COLLATE NOCASE AND id != ?', taxonomy, name, id)) {
    go(here, { error: `A ${taxonomy} named “${name}” already exists.` });
  }
  const slug = uniqueTermSlug(taxonomy, slugify(clip(fd.get('slug'), 80) || name), id);
  const description = clip(fd.get('description'), 400);

  transaction(() => {
    if (existing) {
      run('UPDATE terms SET name = ?, slug = ?, description = ? WHERE id = ?', name, slug, description, id);
      if (taxonomy === 'category' && existing.name !== name) {
        // posts.category keeps the primary category's name as text: follow the rename
        run('UPDATE posts SET category = ? WHERE category = ? AND id IN (SELECT post_id FROM post_terms WHERE term_id = ?)', name, existing.name, id);
      }
    } else {
      run('INSERT INTO terms (taxonomy, name, slug, description) VALUES (?, ?, ?, ?)', taxonomy, name, slug, description);
    }
  });
  logActivity(user, existing ? 'update' : 'create', taxonomy, id, name);
  refresh();
  go(page(taxonomy), { saved: '1' });
}

/** Bulk delete (<select name="bulk" value="delete"> + ids[]) and the per-row Delete button (name="op" value="delete:12"). */
export async function termsAction(taxonomy: Taxonomy, fd: FormData) {
  const user = await requireCap('manage_terms');
  if (taxonomy !== 'category' && taxonomy !== 'tag') go('/admin');
  let ids: number[];
  const single = /^delete:(\d+)$/.exec(String(fd.get('op') ?? ''));
  if (single) ids = [Number(single[1])];
  else {
    if (clip(fd.get('bulk'), 12) !== 'delete') go(page(taxonomy), { error: 'Choose an action first.' });
    ids = [...new Set(fd.getAll('ids').map((v) => Math.trunc(Number(v))).filter((n) => Number.isInteger(n) && n > 0))];
  }
  if (!ids.length) go(page(taxonomy), { error: 'Select at least one item.' });

  const terms = all<{ id: number; name: string }>(`SELECT id, name FROM terms WHERE taxonomy = ? AND id IN (${ids.map(() => '?').join(',')})`, taxonomy, ...ids);
  if (!terms.length) go(page(taxonomy), { error: 'Nothing to delete.' });
  const marks = terms.map(() => '?').join(',');
  const termIds = terms.map((t) => t.id);

  transaction(() => {
    const affected = taxonomy === 'category'
      ? all<{ post_id: number }>(`SELECT DISTINCT post_id FROM post_terms WHERE term_id IN (${marks})`, ...termIds).map((r) => r.post_id)
      : [];
    run(`DELETE FROM terms WHERE id IN (${marks})`, ...termIds); // links in post_terms go with it (ON DELETE CASCADE)
    refreshPrimaryCategory(affected); // posts that lose their primary category fall back to another one, or to none
  });
  logActivity(user, 'delete', taxonomy, termIds.join(','), terms.map((t) => t.name).join(', '));
  refresh();
  go(page(taxonomy), { saved: '1' });
}
