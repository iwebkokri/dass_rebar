'use server';

// Custom forms: save / duplicate / delete. Every action starts with requireCap — actions are public HTTP endpoints.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCap } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { get, run } from '@/lib/db';
import { getForm, uniqueFormSlug } from '@/lib/forms';
import { normaliseFormInput } from '@/lib/forms-shared';

export type SaveFormResult = { ok: true; id: number; slug: string } | { ok: false; error: string };

/** Create (idParam 'new') or update a form from the builder's JSON. Returns the stored id/slug (the client then navigates / shows "Saved"). */
export async function saveForm(idParam: number | 'new', raw: unknown): Promise<SaveFormResult> {
  const user = await requireCap('manage_site');
  const parsed = normaliseFormInput(raw);
  if ('error' in parsed) return { ok: false, error: parsed.error };
  const v = parsed.value;

  if (idParam === 'new') {
    const slug = uniqueFormSlug(v.slug);
    const id = run('INSERT INTO forms (name, slug, fields, settings) VALUES (?, ?, ?, ?)', v.name, slug, JSON.stringify(v.fields), JSON.stringify(v.settings)).lastInsertRowid;
    logActivity(user, 'create', 'form', id, `Created form “${v.name}”`);
    revalidatePath('/', 'layout');
    return { ok: true, id, slug };
  }

  const existing = getForm(Number(idParam));
  if (!existing) return { ok: false, error: 'That form no longer exists.' };
  // The slug is fixed after creation: submissions are filed under 'form:<slug>', so changing it would split the history.
  run("UPDATE forms SET name = ?, fields = ?, settings = ?, updated_at = datetime('now') WHERE id = ?", v.name, JSON.stringify(v.fields), JSON.stringify(v.settings), existing.id);
  logActivity(user, 'update', 'form', existing.id, `Saved form “${v.name}” (${v.fields.length} fields)`);
  revalidatePath('/', 'layout');
  return { ok: true, id: existing.id, slug: existing.slug };
}

export async function duplicateForm(id: number) {
  const user = await requireCap('manage_site');
  const src = getForm(Number(id));
  if (!src) redirect(`/admin/forms?error=${encodeURIComponent('That form no longer exists.')}`);
  const name = `${src.name} (copy)`.slice(0, 120);
  const slug = uniqueFormSlug(`${src.slug}-copy`.slice(0, 80));
  const newId = run('INSERT INTO forms (name, slug, fields, settings) VALUES (?, ?, ?, ?)', name, slug, JSON.stringify(src.fields), JSON.stringify(src.settings)).lastInsertRowid;
  logActivity(user, 'create', 'form', newId, `Duplicated form “${src.name}”`);
  redirect(`/admin/forms/${newId}?saved=1`);
}

export async function deleteForm(id: number) {
  const user = await requireCap('manage_site');
  const f = get<{ id: number; name: string }>('SELECT id, name FROM forms WHERE id = ?', Number(id));
  if (!f) redirect('/admin/forms');
  // Past submissions are kept (they stay under their "form:<slug>" type in Submissions).
  run('DELETE FROM forms WHERE id = ?', f.id);
  logActivity(user, 'delete', 'form', f.id, `Deleted form “${f.name}”`);
  revalidatePath('/', 'layout');
  redirect('/admin/forms?saved=1');
}
