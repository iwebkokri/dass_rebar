'use server';

// Pages admin: create, settings (never the content tree — that is the builder's), bulk / row actions, revision restore.
// Every action re-checks the session and the capability (actions are public endpoints).
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { sanitizeDoc } from '@/lib/builder/sanitize.mjs';
import { cleanCss, cleanRawHtml } from '@/lib/html-snippet.mjs';
import { cleanContentSeo, cleanCustomJsonLd } from '@/lib/seo-core.mjs';
import { cloneNode, parseDoc } from '@/lib/builder/tree.mjs';
import { safeMediaUrl } from '@/lib/builder/url.mjs';
import { get, run, transaction } from '@/lib/db';
import { cleanPath, nowUtc, pageSlug, pathProblem, pathTaken, uniquePath } from '@/lib/page-admin';
import { localInputToStamp } from '@/lib/post-time';
import { createRedirect } from '@/lib/redirects';
import { can } from '@/lib/roles';

function go(pathname: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  redirect(qs ? `${pathname}?${qs}` : pathname);
}

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const live = () => revalidatePath('/', 'layout'); // public pages, menus and the sitemap pick up the change
const EMPTY = '{"v":1,"nodes":[]}';
const MAX_REVISIONS = 30;

/** Only ever send people back to somewhere inside the pages admin. */
const backTo = (v: FormDataEntryValue | null, fallback = '/admin/pages') => {
  const s = String(v ?? '');
  return /^\/admin\/pages(?:[/?][\w\-/?=&%.+]*)?$/.test(s) ? s : fallback;
};
const withParams = (url: string, params: Record<string, string>) => {
  const [p, q = ''] = url.split('?');
  const sp = new URLSearchParams(q);
  for (const k of ['msg', 'saved', 'error', 'warn']) sp.delete(k);
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${p}?${qs}` : p;
};

/** Redirect to a URL that may already carry a query string (the list keeps its tab / search / page). */
function goBack(url: string, params: Record<string, string>): never {
  redirect(withParams(url, params));
}

type PageRow = { id: number; path: string; title: string; status: 'draft' | 'published' | 'trash'; layout: string; content: string; published_at: string | null };

/** A copy of a stored document with fresh node ids, validated again before it is stored. */
function copyContent(content: string, isAdmin: boolean): string {
  const nodes = parseDoc(content).nodes.map(cloneNode);
  const doc = { v: 1, nodes };
  try {
    return JSON.stringify(sanitizeDoc(doc, { isAdmin, prev: doc }).doc);
  } catch {
    return EMPTY;
  }
}

function addRevision(pageId: number, title: string, content: string, userId: number, note = '') {
  run('INSERT INTO revisions (entity, entity_id, title, content, user_id, note) VALUES (?, ?, ?, ?, ?, ?)', 'page', pageId, title, content, userId, note);
  run('DELETE FROM revisions WHERE entity = ? AND entity_id = ? AND id NOT IN (SELECT id FROM revisions WHERE entity = ? AND entity_id = ? ORDER BY id DESC LIMIT ?)', 'page', pageId, 'page', pageId, MAX_REVISIONS);
}

// ------------------------------------------------------------------ create
export async function createPage(fd: FormData) {
  const user = await requireCap('edit_pages');
  const title = clip(fd.get('title'), 200);
  const layout = fd.get('layout') === 'canvas' ? 'canvas' : 'default';
  const source = ['page', 'template'].includes(String(fd.get('source'))) ? String(fd.get('source')) : 'blank';
  const sourcePage = Number(fd.get('source_page')) || 0;
  const sourceTemplate = Number(fd.get('source_template')) || 0;
  const rawPath = clip(fd.get('path'), 200);
  const auto = fd.get('path_auto') === '1' || !rawPath;

  const back = (error: string): never =>
    go('/admin/pages/new', { error, title, path: rawPath, layout, source, sp: String(sourcePage || ''), st: String(sourceTemplate || '') });

  if (!title) back('Give the page a title.');
  let path: string;
  if (!rawPath) path = uniquePath(pageSlug(title));
  else if (rawPath === '/') path = ''; // the home page (only possible while it doesn’t exist)
  else {
    path = cleanPath(rawPath);
    if (auto) path = uniquePath(path); // untouched, auto-generated slug: make it unique instead of failing
  }
  const problem = pathProblem(path) || pathTaken(path);
  if (problem) back(problem);

  let content = EMPTY;
  const isAdmin = user.role === 'administrator';
  if (source === 'page') {
    const src = get<PageRow>("SELECT * FROM pages WHERE id = ? AND status <> 'trash'", sourcePage);
    if (!src) back('Pick the page to duplicate.');
    content = copyContent(src!.content, isAdmin);
  } else if (source === 'template') {
    const src = get<{ content: string }>("SELECT content FROM templates WHERE id = ? AND kind = 'page'", sourceTemplate);
    if (!src) back('Pick a page template.');
    content = copyContent(src!.content, isAdmin);
  }

  let id = 0;
  try {
    id = run("INSERT INTO pages (path, title, status, layout, content, author_id) VALUES (?, ?, 'draft', ?, ?, ?)", path, title, layout, content, user.id).lastInsertRowid;
  } catch {
    back('That path is already in use.');
  }
  logActivity(user, 'create', 'page', id, `${title} (/${path})`);
  if (can(user, 'use_builder')) go(`/admin/builder/page-${id}`);
  go(`/admin/pages/${id}`, { saved: '1' });
}

// ------------------------------------------------------------------ settings
export async function savePageSettings(fd: FormData) {
  const user = await requireCap('edit_pages');
  const id = Number(fd.get('id'));
  const page = get<PageRow & { seo_title: string }>('SELECT * FROM pages WHERE id = ?', id);
  if (!page) go('/admin/pages', { error: 'That page no longer exists.' });
  const here = `/admin/pages/${id}`;
  const p = page as PageRow;

  const title = clip(fd.get('title'), 200);
  if (!title) go(here, { error: 'The title can’t be empty.' });

  // path (the home page keeps '')
  let path = p.path;
  if (p.path !== '') {
    path = cleanPath(fd.get('path'));
    if (!path) go(here, { error: 'The path can’t be empty. Only the home page has an empty path.' });
    const problem = pathProblem(path) || pathTaken(path, id);
    if (problem) go(here, { error: problem });
  }

  const layout = fd.get('layout') === 'canvas' ? 'canvas' : 'default';
  const noindex = fd.get('noindex') === 'on' ? 1 : 0;
  const seoTitle = clip(fd.get('seo_title'), 120);
  const seoDescription = clip(fd.get('seo_description'), 320);
  const ogRaw = clip(fd.get('og_image'), 500);
  const og = safeMediaUrl(ogRaw);
  if (ogRaw && !og) go(here, { error: 'The social image must be an image URL (https://… or a path starting with /).' });

  // status + schedule (only people who may publish can change them; for everyone else the fields are read-only)
  const now = nowUtc();
  let status = p.status;
  let publishedAt = p.published_at;
  if (p.status !== 'trash' && can(user, 'publish_pages')) {
    status = fd.get('status') === 'published' ? 'published' : 'draft';
    const schedRaw = clip(fd.get('published_at_local'), 20);
    const sched = schedRaw ? localInputToStamp(schedRaw) : null;
    if (schedRaw && !sched) go(here, { error: 'That publish date isn’t valid.' });
    if (status === 'published') publishedAt = sched ?? (p.published_at && p.published_at <= now ? p.published_at : now);
    else publishedAt = sched; // kept for when it is published; empty means "publish immediately"
  }

  // search + AI fields (editors may change these); custom JSON-LD and page code need their own capability, checked on the server
  const seo = cleanContentSeo({
    focus_keyword: fd.get('focus_keyword'), canonical_url: fd.get('canonical_url'), nofollow: fd.get('nofollow'), og_title: fd.get('og_title'),
    og_description: fd.get('og_description'), twitter_card: fd.get('twitter_card'), schema_type: fd.get('schema_type'),
    answer_summary: fd.get('answer_summary'), breadcrumb_title: fd.get('breadcrumb_title'),
  }, { kind: 'page' });
  if (seo.error) go(here, { error: seo.error });
  const extra: Record<string, string> = {};
  if (can(user, 'manage_seo') && fd.has('custom_jsonld')) {
    const j = cleanCustomJsonLd(String(fd.get('custom_jsonld') ?? ''));
    if (j.error) go(here, { error: j.error });
    extra.custom_jsonld = j.value;
  }
  if (can(user, 'manage_code') && fd.has('code_css')) {
    extra.code_css = cleanCss(String(fd.get('code_css') ?? ''));
    extra.code_head = cleanRawHtml(String(fd.get('code_head') ?? ''));
    extra.code_footer = cleanRawHtml(String(fd.get('code_footer') ?? ''));
  }
  const extraCols = Object.keys(extra);

  transaction(() => {
    run(
      `UPDATE pages SET title = ?, path = ?, layout = ?, noindex = ?, seo_title = ?, seo_description = ?, og_image = ?, status = ?, published_at = ?,
         focus_keyword = ?, canonical_url = ?, nofollow = ?, og_title = ?, og_description = ?, twitter_card = ?, schema_type = ?, answer_summary = ?, breadcrumb_title = ?
         ${extraCols.map((c) => `, ${c} = ?`).join('')}, updated_at = datetime('now') WHERE id = ?`,
      title, path, layout, noindex, seoTitle, seoDescription, og, status, publishedAt,
      seo.values.focus_keyword, seo.values.canonical_url, seo.values.nofollow, seo.values.og_title, seo.values.og_description, seo.values.twitter_card,
      seo.values.schema_type, seo.values.answer_summary, seo.values.breadcrumb_title,
      ...extraCols.map((c) => extra[c]),
      id
    );
    if (path !== p.path && p.path !== '' && fd.get('redirect_old') === 'on') {
      run('DELETE FROM redirects WHERE from_path = ?', '/' + path); // a stale redirect away from the new path would loop
      createRedirect('/' + p.path, '/' + path, 301);
    }
  });

  const moved = path !== p.path ? ` (path /${p.path} → /${path})` : '';
  const verb = status !== p.status ? (status === 'published' ? 'publish' : 'unpublish') : 'settings';
  logActivity(user, verb, 'page', id, `${title}${moved}`);
  live();
  const scheduled = status === 'published' && publishedAt && publishedAt > now;
  go(here, { saved: '1', msg: scheduled ? 'This page is scheduled and will go live at the set time.' : '' });
}

// ------------------------------------------------------------------ bulk + row actions
const OPS = ['trash', 'restore', 'publish', 'draft', 'delete', 'duplicate'] as const;
type Op = (typeof OPS)[number];
const OP_CAP = { trash: 'delete_pages', restore: 'edit_pages', publish: 'publish_pages', draft: 'publish_pages', delete: 'delete_pages', duplicate: 'edit_pages' } as const;

export async function pagesAction(fd: FormData) {
  const user = await requireCap('edit_pages');
  const back = backTo(fd.get('back'));
  const row = clip(fd.get('row'), 40); // "trash:5" — a button in a row
  let op = '';
  let ids: number[] = [];
  if (row) {
    const [o, n] = row.split(':');
    op = o;
    ids = [Number(n)];
  } else {
    op = clip(fd.get('op'), 20);
    ids = fd.getAll('ids').map((v) => Number(v));
  }
  ids = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200);
  if (!(OPS as readonly string[]).includes(op)) goBack(back, { error: 'Choose an action first.' });
  if (!ids.length) goBack(back, { error: 'Select at least one page.' });
  const doing = op as Op;
  await requireCap(OP_CAP[doing]);

  const isAdmin = user.role === 'administrator';
  const now = nowUtc();
  let done = 0;
  let skippedHome = 0;
  let lastId = 0;

  transaction(() => {
    for (const id of ids) {
      const p = get<PageRow>('SELECT * FROM pages WHERE id = ?', id);
      if (!p) continue;
      switch (doing) {
        case 'trash':
          if (p.path === '') { skippedHome++; break; }
          if (p.status === 'trash') break;
          run("UPDATE pages SET status = 'trash', updated_at = datetime('now') WHERE id = ?", id);
          logActivity(user, 'trash', 'page', id, p.title);
          done++;
          break;
        case 'restore':
          if (p.status !== 'trash') break;
          run("UPDATE pages SET status = 'draft', updated_at = datetime('now') WHERE id = ?", id);
          logActivity(user, 'restore', 'page', id, p.title);
          done++;
          break;
        case 'publish':
          if (p.status === 'trash') break;
          run("UPDATE pages SET status = 'published', published_at = ?, updated_at = datetime('now') WHERE id = ?", p.published_at && p.published_at <= now ? p.published_at : now, id);
          logActivity(user, 'publish', 'page', id, p.title);
          done++;
          break;
        case 'draft':
          if (p.status === 'trash' || p.status === 'draft') break;
          run("UPDATE pages SET status = 'draft', updated_at = datetime('now') WHERE id = ?", id);
          logActivity(user, 'unpublish', 'page', id, p.title);
          done++;
          break;
        case 'delete':
          if (p.status !== 'trash') break; // only from the Trash
          if (p.path === '') { skippedHome++; break; }
          run("DELETE FROM revisions WHERE entity = 'page' AND entity_id = ?", id);
          run('DELETE FROM pages WHERE id = ?', id);
          logActivity(user, 'delete', 'page', id, p.title);
          done++;
          break;
        case 'duplicate': {
          if (p.status === 'trash') break;
          const title = `${p.title} (copy)`.slice(0, 200);
          const path = uniquePath((p.path || 'home') + '-copy');
          const copy = run("INSERT INTO pages (path, title, status, layout, content, author_id) VALUES (?, ?, 'draft', ?, ?, ?)", path, title, p.layout, copyContent(p.content, isAdmin), user.id);
          lastId = copy.lastInsertRowid;
          logActivity(user, 'duplicate', 'page', lastId, `${title} (from #${id})`);
          done++;
          break;
        }
      }
    }
  });

  if (doing !== 'duplicate' || done) live();
  const n = (word: string) => `${done} page${done === 1 ? '' : 's'} ${word}.`;
  const messages: Record<Op, string> = {
    trash: n('moved to the Trash'),
    restore: n('restored as drafts'),
    publish: n('published'),
    draft: n('set to draft'),
    delete: n('permanently deleted'),
    duplicate: done === 1 ? 'Page duplicated. The copy is a draft.' : n('duplicated'),
  };
  const notes = skippedHome ? ' The home page can’t be trashed or deleted.' : '';
  if (!done) goBack(back, { error: skippedHome ? 'The home page can’t be trashed or deleted.' : 'Nothing to do for the selected pages.' });
  // after trashing / deleting from a settings screen the page is gone from there: land on the list
  const dest = /^\/admin\/pages\/\d+/.test(back) && (doing === 'trash' || doing === 'delete') ? '/admin/pages' : back;
  goBack(dest, { msg: messages[doing] + notes });
}

// ------------------------------------------------------------------ revisions
export async function restoreRevision(fd: FormData) {
  const user = await requireCap('edit_pages');
  const pageId = Number(fd.get('id'));
  const revId = Number(fd.get('revision'));
  const here = `/admin/pages/${pageId}`;
  const page = get<PageRow>('SELECT * FROM pages WHERE id = ?', pageId);
  if (!page || page.status === 'trash') go('/admin/pages', { error: 'That page is not available.' });
  const rev = get<{ id: number; content: string; created_at: string }>("SELECT id, content, created_at FROM revisions WHERE id = ? AND entity = 'page' AND entity_id = ?", revId, pageId);
  if (!rev) go(here, { error: 'That revision no longer exists.' });
  const p = page as PageRow;

  let content: string;
  try {
    content = JSON.stringify(sanitizeDoc(parseDoc(rev!.content), { isAdmin: user.role === 'administrator', prev: parseDoc(p.content) }).doc);
  } catch (err) {
    go(here, { error: err instanceof Error ? err.message : 'That revision could not be restored.' });
  }

  transaction(() => {
    const latest = get<{ content: string }>("SELECT content FROM revisions WHERE entity = 'page' AND entity_id = ? ORDER BY id DESC LIMIT 1", pageId);
    if (latest?.content !== p.content) addRevision(pageId, p.title, p.content, user.id, 'Before restore'); // never lose what is live right now
    addRevision(pageId, p.title, content!, user.id, `Restored from revision #${revId}`);
    run("UPDATE pages SET content = ?, updated_at = datetime('now') WHERE id = ?", content!, pageId);
  });
  logActivity(user, 'restore', 'page', pageId, `${p.title} — revision #${revId}`);
  live();
  go(here, { saved: '1', msg: `Restored the version from ${rev!.created_at} UTC.` });
}
