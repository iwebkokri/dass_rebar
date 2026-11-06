'use server';

// Templates admin: header / footer (manage_site) and saved sections / page layouts (edit_pages).
// The content of a template is edited in the builder (/admin/builder/tpl-<id>); here we only manage the records.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap, requireUser } from '@/lib/auth';
import { sanitizeDoc } from '@/lib/builder/sanitize.mjs';
import { cloneNode, parseDoc } from '@/lib/builder/tree.mjs';
import { get, run, transaction } from '@/lib/db';
import { can, type Cap } from '@/lib/roles';

type Kind = 'header' | 'footer' | 'section' | 'page';
const KINDS: Kind[] = ['header', 'footer', 'section', 'page'];
const KIND_CAP: Record<Kind, Cap> = { header: 'manage_site', footer: 'manage_site', section: 'edit_pages', page: 'edit_pages' };
const KIND_LABEL: Record<Kind, string> = { header: 'header', footer: 'footer', section: 'saved section', page: 'page layout' };
const EMPTY = '{"v":1,"nodes":[]}';

type Row = { id: number; kind: Kind; name: string; content: string; active: number };

function go(pathname: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  redirect(qs ? `${pathname}?${qs}` : pathname);
}
const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const listUrl = (kind: string) => `/admin/templates?kind=${kind}`;
const isKind = (v: unknown): v is Kind => typeof v === 'string' && (KINDS as string[]).includes(v);
const live = () => revalidatePath('/', 'layout');

/** The record, after checking the user may manage that kind of template. */
async function loadFor(fd: FormData): Promise<{ user: Awaited<ReturnType<typeof requireUser>>; row: Row }> {
  const user = await requireUser();
  const row = get<Row>('SELECT * FROM templates WHERE id = ?', Number(fd.get('id')));
  if (!row) go('/admin/templates', { error: 'That template no longer exists.' });
  await requireCap(KIND_CAP[(row as Row).kind]);
  return { user, row: row as Row };
}

function copyContent(content: string, isAdmin: boolean): string {
  const doc = { v: 1, nodes: parseDoc(content).nodes.map(cloneNode) };
  try {
    return JSON.stringify(sanitizeDoc(doc, { isAdmin, prev: doc }).doc);
  } catch {
    return EMPTY;
  }
}

export async function createTemplate(fd: FormData) {
  const user = await requireUser();
  const kind = clip(fd.get('kind'), 12);
  if (!isKind(kind)) go('/admin/templates', { error: 'Choose what kind of template to add.' });
  await requireCap(KIND_CAP[kind as Kind]);
  const k = kind as Kind;
  const name = clip(fd.get('name'), 120);
  if (!name) go(listUrl(k), { error: 'Give the template a name.' });

  let content = EMPTY;
  if ((k === 'header' || k === 'footer') && fd.get('start') === 'active') {
    const active = get<{ content: string }>('SELECT content FROM templates WHERE kind = ? AND active = 1 ORDER BY id DESC LIMIT 1', k);
    if (active) content = copyContent(active.content, user.role === 'administrator');
  }
  const r = run('INSERT INTO templates (kind, name, content, active, author_id) VALUES (?, ?, ?, 0, ?)', k, name, content, user.id);
  logActivity(user, 'create', k, r.lastInsertRowid, name);
  if (can(user, 'use_builder')) go(`/admin/builder/tpl-${r.lastInsertRowid}`);
  go(listUrl(k), { msg: `“${name}” was created.` });
}

export async function activateTemplate(fd: FormData) {
  const { user, row } = await loadFor(fd);
  if (row.kind !== 'header' && row.kind !== 'footer') go(listUrl(row.kind), { error: 'Only a header or footer can be activated.' });
  transaction(() => {
    run('UPDATE templates SET active = 0 WHERE kind = ? AND id <> ?', row.kind, row.id);
    run('UPDATE templates SET active = 1 WHERE id = ?', row.id);
  });
  logActivity(user, 'activate', row.kind, row.id, row.name);
  live();
  go(listUrl(row.kind), { msg: `“${row.name}” is now the site ${row.kind}.` });
}

export async function renameTemplate(fd: FormData) {
  const { user, row } = await loadFor(fd);
  const name = clip(fd.get('name'), 120);
  if (!name) go(listUrl(row.kind), { error: 'The name can’t be empty.' });
  run("UPDATE templates SET name = ?, updated_at = datetime('now') WHERE id = ?", name, row.id);
  logActivity(user, 'rename', row.kind, row.id, `${row.name} → ${name}`);
  if (row.active) live();
  go(listUrl(row.kind), { msg: 'Renamed.' });
}

export async function duplicateTemplate(fd: FormData) {
  const { user, row } = await loadFor(fd);
  const name = `${row.name} (copy)`.slice(0, 120);
  const r = run('INSERT INTO templates (kind, name, content, active, author_id) VALUES (?, ?, ?, 0, ?)', row.kind, name, copyContent(row.content, user.role === 'administrator'), user.id);
  logActivity(user, 'duplicate', row.kind, r.lastInsertRowid, `${name} (from #${row.id})`);
  go(listUrl(row.kind), { msg: `Duplicated as “${name}”${row.kind === 'header' || row.kind === 'footer' ? ' (not active yet)' : ''}.` });
}

export async function deleteTemplate(fd: FormData) {
  const { user, row } = await loadFor(fd);
  if (row.active) go(listUrl(row.kind), { error: `“${row.name}” is the active ${KIND_LABEL[row.kind]}. Activate another one first, then delete this one.` });
  transaction(() => {
    run("DELETE FROM revisions WHERE entity = 'template' AND entity_id = ?", row.id);
    run('DELETE FROM templates WHERE id = ?', row.id);
  });
  logActivity(user, 'delete', row.kind, row.id, row.name);
  live();
  go(listUrl(row.kind), { msg: `“${row.name}” was deleted.` });
}
