'use server';

// Saving from the page builder. Every call re-checks the session and the capability, validates the whole document against the
// schema (sanitizeDoc) and detects edits made by someone else since the editor was opened.
import { all, get, run, transaction } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/roles';
import { logActivity } from '@/lib/activity';
import { sanitizeDoc } from '@/lib/builder/sanitize.mjs';
import { cloneNode, parseDoc } from '@/lib/builder/tree.mjs';
import { cleanContentSeo } from '@/lib/seo-core.mjs';
import type { BNode } from '@/lib/builder/types';

type Entry = { id: number; nodes: BNode[]; base: string };
export type SaveInput = {
  page?: Entry & { title?: string; status?: 'draft' | 'published'; seo?: { seo_title?: string; seo_description?: string; focus_keyword?: string; answer_summary?: string } };
  header?: Entry;
  footer?: Entry;
  template?: Entry;
  force?: boolean;
};
export type SaveResult = {
  ok: boolean;
  error?: string;
  conflict?: boolean;
  results: Partial<Record<'page' | 'header' | 'footer' | 'template', { updatedAt: string; dropped: number; status?: string; nodes: BNode[] }>>;
};

const MAX_REVISIONS = 30;

function addRevision(entity: 'page' | 'template', id: number, title: string, content: string, userId: number) {
  run('INSERT INTO revisions (entity, entity_id, title, content, user_id) VALUES (?, ?, ?, ?, ?)', entity, id, title, content, userId);
  run('DELETE FROM revisions WHERE entity = ? AND entity_id = ? AND id NOT IN (SELECT id FROM revisions WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT ?)', entity, id, entity, id, MAX_REVISIONS);
}

export async function saveBuilderDocs(input: SaveInput): Promise<SaveResult> {
  const user = await requireUser();
  const results: SaveResult['results'] = {};
  const isAdmin = user.role === 'administrator';
  const fail = (error: string, conflict = false): SaveResult => ({ ok: false, error, conflict, results: {} });

  try {
    // ---- permission + conflict pre-checks (nothing is written unless everything passes) ----
    const page = input.page ? get<any>('SELECT * FROM pages WHERE id = ?', input.page.id) : undefined;
    if (input.page) {
      if (!page || page.status === 'trash') return fail('This page no longer exists.');
      if (!can(user, 'use_builder') || !can(user, 'edit_pages')) return fail('You do not have permission to edit pages.');
      if (input.page.status && input.page.status !== page.status && !can(user, 'publish_pages')) return fail('You do not have permission to publish pages.');
      if (!input.force && page.updated_at !== input.page.base) return fail('This page was changed by someone else since you opened it.', true);
    }
    const tpls: Record<string, any> = {};
    for (const key of ['header', 'footer', 'template'] as const) {
      const e = input[key];
      if (!e) continue;
      const row = get<any>('SELECT * FROM templates WHERE id = ?', e.id);
      if (!row) return fail('This template no longer exists.');
      const live = row.kind === 'header' || row.kind === 'footer';
      if (!can(user, 'use_builder') || !can(user, live ? 'manage_site' : 'edit_pages')) return fail(`You do not have permission to edit this ${row.kind}.`);
      if (!input.force && row.updated_at !== e.base) return fail(`The ${row.kind} was changed by someone else since you opened it.`, true);
      tpls[key] = row;
    }

    // ---- write ----
    transaction(() => {
      if (input.page && page) {
        const { doc, dropped } = sanitizeDoc({ v: 1, nodes: input.page.nodes }, { isAdmin, prev: parseDoc(page.content) });
        const content = JSON.stringify(doc);
        const title = (input.page.title ?? page.title).trim().slice(0, 200) || page.title;
        const status = input.page.status ?? page.status;
        const publishedAt = status === 'published' && !page.published_at ? new Date().toISOString().slice(0, 19).replace('T', ' ') : page.published_at;
        run("UPDATE pages SET content = ?, title = ?, status = ?, published_at = ?, updated_at = datetime('now') WHERE id = ?", content, title, status, publishedAt, page.id);
        if (input.page.seo) {
          // the four search fields edited in the builder's "SEO & AI" tab (validated like the page settings screen)
          const s = input.page.seo;
          const clean = cleanContentSeo({ focus_keyword: s.focus_keyword, answer_summary: s.answer_summary }, { kind: 'page' }).values;
          run('UPDATE pages SET seo_title = ?, seo_description = ?, focus_keyword = ?, answer_summary = ? WHERE id = ?',
            String(s.seo_title ?? '').replace(/\u0000/g, '').trim().slice(0, 120), String(s.seo_description ?? '').replace(/\u0000/g, '').trim().slice(0, 320),
            clean.focus_keyword, clean.answer_summary, page.id);
        }
        addRevision('page', page.id, title, content, user.id);
        const updated = get<any>('SELECT updated_at FROM pages WHERE id = ?', page.id);
        results.page = { updatedAt: updated.updated_at, dropped, status, nodes: doc.nodes };
        logActivity(user, status !== page.status ? (status === 'published' ? 'publish' : 'unpublish') : 'edit', 'page', page.id, `${title} (builder)`);
      }
      for (const key of ['header', 'footer', 'template'] as const) {
        const e = input[key];
        if (!e) continue;
        const row = tpls[key];
        const { doc, dropped } = sanitizeDoc({ v: 1, nodes: e.nodes }, { isAdmin, prev: parseDoc(row.content) });
        const content = JSON.stringify(doc);
        run("UPDATE templates SET content = ?, updated_at = datetime('now') WHERE id = ?", content, row.id);
        addRevision('template', row.id, row.name, content, user.id);
        const updated = get<any>('SELECT updated_at FROM templates WHERE id = ?', row.id);
        results[key] = { updatedAt: updated.updated_at, dropped, nodes: doc.nodes };
        logActivity(user, 'edit', row.kind, row.id, `${row.name} (builder)`);
      }
    });
    return { ok: true, results };
  } catch (err: any) {
    return fail(err?.message || 'Could not save.');
  }
}

/** Turn a section (or several) into a reusable saved section. */
export async function saveSectionAsTemplate(name: string, nodes: BNode[]): Promise<{ ok: boolean; error?: string; id?: number; name?: string }> {
  const user = await requireUser();
  if (!can(user, 'use_builder') || !can(user, 'edit_pages')) return { ok: false, error: 'Not allowed.' };
  const clean = name.trim().slice(0, 120);
  if (!clean) return { ok: false, error: 'Give the saved section a name.' };
  try {
    const { doc } = sanitizeDoc({ v: 1, nodes: nodes.map(cloneNode) }, { isAdmin: user.role === 'administrator' });
    if (!doc.nodes.length) return { ok: false, error: 'Nothing to save.' };
    const r = run("INSERT INTO templates (kind, name, content, author_id) VALUES ('section', ?, ?, ?)", clean, JSON.stringify(doc), user.id);
    logActivity(user, 'create', 'section', r.lastInsertRowid, clean);
    return { ok: true, id: r.lastInsertRowid, name: clean };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Could not save.' };
  }
}

export async function listRevisions(entity: 'page' | 'template', id: number) {
  const user = await requireUser();
  if (!can(user, 'use_builder')) return [];
  return all<{ id: number; created_at: string; email: string | null }>(
    `SELECT r.id, r.created_at, u.email FROM revisions r LEFT JOIN users u ON u.id = r.user_id WHERE r.entity = ? AND r.entity_id = ? ORDER BY r.id DESC LIMIT 30`,
    entity,
    id
  );
}

export async function loadRevision(revisionId: number): Promise<{ ok: boolean; nodes?: BNode[] }> {
  const user = await requireUser();
  if (!can(user, 'use_builder')) return { ok: false };
  const row = get<{ content: string }>('SELECT content FROM revisions WHERE id = ?', revisionId);
  if (!row) return { ok: false };
  return { ok: true, nodes: parseDoc(row.content).nodes };
}
