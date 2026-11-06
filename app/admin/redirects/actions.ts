'use server';

// Redirects — every action requires manage_site.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { checkRedirect, deleteRedirects, getRedirect, importRedirects, parseRedirectsCsv, saveRedirect, setRedirectsEnabled, type CsvResult } from '@/lib/redirects';

export type RedirectFormState = { error?: string; needsConfirm?: boolean };
export type CsvState = { error?: string; results?: CsvResult[]; committed?: boolean; csv?: string };

const touch = () => revalidatePath('/admin/redirects');
const ids = (fd: FormData) => fd.getAll('ids').map((v) => Math.trunc(Number(v))).filter((n) => Number.isInteger(n) && n > 0);

export async function saveRedirectAction(id: number, _prev: RedirectFormState, fd: FormData): Promise<RedirectFormState> {
  const user = await requireCap('manage_site');
  const existing = id ? getRedirect(id) : undefined;
  if (id && !existing) return { error: 'That redirect no longer exists.' };

  const checked = checkRedirect(
    { from: String(fd.get('from') ?? ''), to: String(fd.get('to') ?? ''), code: String(fd.get('code') ?? '301') },
    { selfId: existing?.id, allowPage: fd.get('allow_page') === 'on' }
  );
  if (!checked.ok) return { error: checked.error, needsConfirm: checked.needsConfirm };

  const rid = saveRedirect(checked, fd.get('enabled') === 'on', existing?.id);
  logActivity(user, existing ? 'update' : 'create', 'redirect', rid, `${checked.from} → ${checked.to} (${checked.code})`);
  touch();
  redirect('/admin/redirects?saved=1');
}

/** Bulk operations and single-row delete from the list (`op` = delete | enable | disable, or `row_delete` = <id>). */
export async function bulkRedirects(fd: FormData) {
  const user = await requireCap('manage_site');
  const one = Math.trunc(Number(fd.get('row_delete')));
  const op = Number.isInteger(one) && one > 0 ? 'delete' : String(fd.get('op') ?? '');
  const list = op === 'delete' && one > 0 ? [one] : ids(fd);
  if (!list.length) redirect('/admin/redirects?error=' + encodeURIComponent('Tick at least one redirect first.'));

  if (op === 'delete') {
    const n = deleteRedirects(list);
    logActivity(user, 'delete', 'redirect', list.join(','), `Deleted ${n} redirect${n === 1 ? '' : 's'}`);
  } else if (op === 'enable' || op === 'disable') {
    const n = setRedirectsEnabled(list, op === 'enable');
    logActivity(user, op, 'redirect', list.join(','), `${op === 'enable' ? 'Enabled' : 'Disabled'} ${n} redirect${n === 1 ? '' : 's'}`);
    if (op === 'enable' && n < list.length) {
      touch();
      redirect('/admin/redirects?warn=' + encodeURIComponent(`${list.length - n} redirect${list.length - n === 1 ? ' was' : 's were'} left disabled because enabling would create a loop.`));
    }
  } else {
    redirect('/admin/redirects?error=' + encodeURIComponent('Unknown bulk action.'));
  }
  touch();
  redirect('/admin/redirects?saved=1');
}

/** CSV import. `intent` = preview (validate only) or import (store the valid rows). */
export async function csvRedirects(_prev: CsvState, fd: FormData): Promise<CsvState> {
  const user = await requireCap('manage_site');
  const csv = String(fd.get('csv') ?? '');
  if (!csv.trim()) return { error: 'Choose a CSV file (or paste rows) first.' };
  if (csv.length > 1_000_000) return { error: 'That file is too large (1 MB at most).' };
  const parsed = parseRedirectsCsv(csv);
  if (parsed.error) return { error: parsed.error };
  if (!parsed.rows.length) return { error: 'No rows found. Each line needs: from,to,code (the code is optional and defaults to 301).' };

  const commit = fd.get('intent') === 'import';
  const results = importRedirects(parsed.rows, { allowPages: fd.get('allow_pages') === 'on', commit });
  if (commit) {
    const ok = results.filter((r) => r.status !== 'error').length;
    logActivity(user, 'import', 'redirect', '', `Imported ${ok} redirect${ok === 1 ? '' : 's'} from CSV (${results.length - ok} skipped)`);
    touch();
  }
  return { results, committed: commit, csv };
}
