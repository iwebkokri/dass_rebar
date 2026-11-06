'use server';

// Posts (the site's "Insights" articles). Every action starts with requireCap(): actions are public HTTP endpoints.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireCap, type AdminUser } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { get, all, run, transaction } from '@/lib/db';
import { safeMediaUrl, safeUrl } from '@/lib/builder/url.mjs';
import { localInputToStamp, nowStamp, stampToLocalInput } from '@/lib/post-time';
import { canEditPost, ensureTerm, saveRevision, syncPostTerms, uniquePostSlug, type PostRow } from '@/lib/posts';
import { can } from '@/lib/roles';
import { slugify } from '@/lib/slug.mjs';
import { cleanContentSeo, cleanCustomJsonLd } from '@/lib/seo-core.mjs';

function go(pathname: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  redirect(qs ? `${pathname}${pathname.includes('?') ? '&' : '?'}${qs}` : pathname);
}

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);
const refresh = () => {
  revalidatePath('/', 'layout'); // public pages (insights list, home, article) pick up the change
};

/** Only ever go back to a posts screen of the admin (the hidden `back` field comes from the browser). */
function safeBack(v: FormDataEntryValue | null): string {
  const s = String(v ?? '');
  return /^\/admin\/posts(\/|\?|$)/.test(s) && !s.includes('//') && !/[\r\n]/.test(s) ? s : '/admin/posts';
}

/** Strip earlier flash params from a URL before adding new ones. */
function backWith(back: string, params: Record<string, string>): never {
  const [path, qs = ''] = back.split('?');
  const q = new URLSearchParams(qs);
  for (const k of ['saved', 'error', 'warn']) q.delete(k);
  const rest = q.toString();
  return go(rest ? `${path}?${rest}` : path, params);
}

const splitList = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? '').split(/[,\n]/).map((s) => s.replace(/\s+/g, ' ').trim().slice(0, 60)).filter(Boolean).slice(0, max);

// ------------------------------------------------------------------ save (create / update)
export async function savePost(idParam: string, fd: FormData) {
  const user = await requireCap('edit_posts');
  const isNew = idParam === 'new';
  const id = isNew ? 0 : Number(idParam);
  const existing = isNew ? undefined : get<PostRow>('SELECT * FROM posts WHERE id = ?', id);
  if (!isNew && !existing) go('/admin/posts', { error: 'That post no longer exists.' });
  if (existing && !canEditPost(user, existing)) go('/admin/posts', { error: 'You can only edit your own posts.' });
  const here = isNew ? '/admin/posts/new' : `/admin/posts/${id}`;
  if (existing?.status === 'trash') go(here, { error: 'Restore this post from the Trash before editing it.' });

  const title = clip(fd.get('title'), 200);
  if (!title) go(here, { error: 'The title is required.' });

  const slug = uniquePostSlug(slugify(clip(fd.get('slug'), 120) || title), id);
  const excerpt = clip(fd.get('excerpt'), 600);
  const body = String(fd.get('body') ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').slice(0, 200_000);

  const cover = clip(fd.get('cover_image'), 500);
  if (cover && !safeMediaUrl(cover)) go(here, { error: 'The cover image must be an uploaded image or a link starting with https:// or /.' });
  const og = clip(fd.get('og_image'), 500);
  if (og && !safeMediaUrl(og)) go(here, { error: 'The social image must be an uploaded image or a link starting with https:// or /.' });
  const external = clip(fd.get('external_url'), 500);
  if (external && (!/^(https?:\/\/|\/(?!\/))/i.test(external) || !safeUrl(external))) go(here, { error: 'The external link must start with https:// (or /).' });

  // status + publish date ---------------------------------------------------------------------
  let status: 'draft' | 'published' = clip(fd.get('status'), 12) === 'published' ? 'published' : 'draft';
  if (status === 'published' && !can(user, 'publish_posts')) status = 'draft';
  const submitted = clip(fd.get('published_at'), 20);
  const untouched = !!existing && submitted === stampToLocalInput(existing.published_at);
  let publishedAt: string;
  if (existing && untouched) {
    publishedAt = existing.published_at;
    // a draft keeps its creation date until it is published: then "now" (unless it was deliberately scheduled ahead)
    if (status === 'published' && existing.status !== 'published' && publishedAt <= nowStamp()) publishedAt = nowStamp();
  } else if (submitted) {
    const st = localInputToStamp(submitted);
    if (!st) go(here, { error: 'That publish date is not valid.' });
    publishedAt = st!;
  } else {
    publishedAt = existing && existing.status === 'published' ? existing.published_at : nowStamp();
  }

  const featured = fd.get('featured') === 'on' ? 1 : 0;
  const commentsEnabled = fd.get('comments_enabled') === 'on' ? 1 : 0;

  // author: only people who can edit others' posts may change it
  let authorId: number | null = existing ? existing.author_id : user.id;
  if (can(user, 'edit_others_posts')) {
    const wanted = Number(fd.get('author_id'));
    if (Number.isInteger(wanted) && wanted > 0 && get('SELECT 1 AS x FROM users WHERE id = ?', wanted)) authorId = wanted;
    else if (!existing) authorId = user.id;
  }

  const seoTitle = clip(fd.get('seo_title'), 200);
  const seoDescription = clip(fd.get('seo_description'), 400);
  // advanced search + AI fields (custom JSON-LD only for people with manage_seo; otherwise the stored value is kept)
  const seo = cleanContentSeo({
    focus_keyword: fd.get('focus_keyword'), canonical_url: fd.get('canonical_url'), nofollow: fd.get('nofollow'), og_title: fd.get('og_title'),
    og_description: fd.get('og_description'), twitter_card: fd.get('twitter_card'), schema_type: fd.get('schema_type'),
    answer_summary: fd.get('answer_summary'), breadcrumb_title: fd.get('breadcrumb_title'),
  }, { kind: 'post' });
  if (seo.error) go(here, { error: seo.error });
  const noindex = fd.get('noindex') === 'on' ? 1 : 0;
  let customJsonLd = existing?.custom_jsonld ?? '';
  if (can(user, 'manage_seo') && fd.has('custom_jsonld')) {
    const j = cleanCustomJsonLd(String(fd.get('custom_jsonld') ?? ''));
    if (j.error) go(here, { error: j.error });
    customJsonLd = j.value;
  }
  const v = seo.values;

  // taxonomy ------------------------------------------------------------------------------------
  const canAddCategories = can(user, 'manage_terms');
  const pickedIds = fd.getAll('categories').map((v) => Math.trunc(Number(v))).filter((n) => Number.isInteger(n) && n > 0);
  const validIds = new Set(pickedIds.length ? all<{ id: number }>(`SELECT id FROM terms WHERE taxonomy = 'category' AND id IN (${pickedIds.map(() => '?').join(',')})`, ...pickedIds).map((r) => r.id) : []);
  const primaryRaw = clip(fd.get('primary_category'), 80);

  const warnings: string[] = [];
  const newCategoryNames = canAddCategories ? fd.getAll('new_categories').flatMap((v) => splitList(v, 10)) : [];
  if (!canAddCategories && fd.getAll('new_categories').length) warnings.push('You are not allowed to create categories, so the new one was skipped.');

  const postId = transaction(() => {
    const catIds = pickedIds.filter((n) => validIds.has(n));
    const newIdByName = new Map<string, number>();
    for (const name of newCategoryNames) {
      const tid = ensureTerm('category', name);
      if (tid) { newIdByName.set(name, tid); catIds.push(tid); }
    }
    let primary = 0;
    if (primaryRaw.startsWith('new:')) primary = newIdByName.get(primaryRaw.slice(4)) ?? 0;
    else primary = Number(primaryRaw) || 0;
    const categoryIds = [...new Set([...(catIds.includes(primary) ? [primary] : []), ...catIds])]; // primary first, else the order picked

    const tagIds = splitList(fd.get('tags'), 30).map((n) => ensureTerm('tag', n)).filter((n): n is number => !!n);

    let pid = id;
    if (existing) {
      if (existing.title !== title || existing.body !== body) saveRevision(existing.id, user.id, existing.title, existing.body, `Replaced by ${user.name || user.email}`);
      run(
        `UPDATE posts SET title = ?, slug = ?, excerpt = ?, body = ?, cover_image = ?, external_url = ?, status = ?, published_at = ?, featured = ?,
           comments_enabled = ?, author_id = ?, seo_title = ?, seo_description = ?, og_image = ?,
           focus_keyword = ?, canonical_url = ?, noindex = ?, nofollow = ?, og_title = ?, og_description = ?, twitter_card = ?, schema_type = ?,
           answer_summary = ?, breadcrumb_title = ?, custom_jsonld = ?, updated_at = datetime('now') WHERE id = ?`,
        title, slug, excerpt, body, cover, external, status, publishedAt, featured, commentsEnabled, authorId, seoTitle, seoDescription, og,
        v.focus_keyword, v.canonical_url, noindex, v.nofollow, v.og_title, v.og_description, v.twitter_card, v.schema_type, v.answer_summary, v.breadcrumb_title, customJsonLd,
        existing.id
      );
    } else {
      pid = run(
        `INSERT INTO posts (title, slug, excerpt, body, cover_image, external_url, status, published_at, featured, comments_enabled, author_id, seo_title, seo_description, og_image,
           focus_keyword, canonical_url, noindex, nofollow, og_title, og_description, twitter_card, schema_type, answer_summary, breadcrumb_title, custom_jsonld)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        title, slug, excerpt, body, cover, external, status, publishedAt, featured, commentsEnabled, authorId, seoTitle, seoDescription, og,
        v.focus_keyword, v.canonical_url, noindex, v.nofollow, v.og_title, v.og_description, v.twitter_card, v.schema_type, v.answer_summary, v.breadcrumb_title, customJsonLd
      ).lastInsertRowid;
    }
    syncPostTerms(pid, categoryIds, tagIds);
    return pid;
  });

  logActivity(user, isNew ? 'create' : 'update', 'post', postId, `${status === 'published' ? (publishedAt > nowStamp() ? 'Scheduled' : 'Published') : 'Draft'}: ${title}`);
  refresh();
  go(`/admin/posts/${postId}`, { saved: '1', warn: warnings.join(' ') });
}

// ------------------------------------------------------------------ list actions (bulk + per-row buttons)
type Op = 'trash' | 'publish' | 'draft' | 'restore' | 'delete' | 'quick' | 'empty';
const OPS: Op[] = ['trash', 'publish', 'draft', 'restore', 'delete', 'quick', 'empty'];

function fetchPosts(user: AdminUser, ids: number[]): PostRow[] {
  if (!ids.length) return [];
  const rows = all<PostRow>(`SELECT * FROM posts WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids);
  return rows.filter((p) => canEditPost(user, p)); // authors never see or change other people's posts
}

/** Used by the bulk-actions bar (<select name="bulk"> + ids[]) and by single-row buttons (name="op" value="trash:12"). */
export async function postsAction(fd: FormData) {
  const user = await requireCap('edit_posts');
  const back = safeBack(fd.get('back'));

  let op = '' as Op | '';
  let ids: number[] = [];
  const single = /^(\w+):(\d+)$/.exec(String(fd.get('op') ?? ''));
  if (single) {
    op = single[1] as Op;
    ids = [Number(single[2])];
  } else {
    op = clip(fd.get('bulk'), 12) as Op;
    ids = [...new Set(fd.getAll('ids').map((v) => Math.trunc(Number(v))).filter((n) => Number.isInteger(n) && n > 0))];
    if (!op) backWith(back, { error: 'Choose a bulk action first.' });
    if (!ids.length && op !== 'empty') backWith(back, { error: 'Select at least one post.' });
  }
  if (!OPS.includes(op as Op)) backWith(back, { error: 'Unknown action.' });

  if (op === 'empty') {
    ids = all<{ id: number }>("SELECT id FROM posts WHERE status = 'trash'").map((r) => r.id);
    op = 'delete';
  }
  const posts = fetchPosts(user, ids);
  if (!posts.length) backWith(back, { error: 'Nothing to do — those posts are not available to you.' });

  if ((op === 'trash' || op === 'delete') && !can(user, 'delete_posts')) backWith(back, { error: 'You are not allowed to delete posts.' });
  if (op === 'publish' && !can(user, 'publish_posts')) backWith(back, { error: 'You are not allowed to publish posts.' });

  let done = 0;
  let message = '';
  transaction(() => {
    for (const p of posts) {
      switch (op) {
        case 'trash':
          if (p.status === 'trash') break;
          run("UPDATE posts SET status = 'trash', updated_at = datetime('now') WHERE id = ?", p.id);
          done++;
          break;
        case 'restore':
          if (p.status !== 'trash') break;
          run("UPDATE posts SET status = 'draft', updated_at = datetime('now') WHERE id = ?", p.id); // like WordPress: restored posts come back as drafts
          done++;
          break;
        case 'draft':
          if (p.status === 'trash') break;
          run("UPDATE posts SET status = 'draft', updated_at = datetime('now') WHERE id = ?", p.id);
          done++;
          break;
        case 'publish': {
          if (p.status === 'published' || p.status === 'trash') break;
          const at = p.published_at > nowStamp() ? p.published_at : nowStamp(); // a draft goes live now; one dated ahead stays scheduled
          run("UPDATE posts SET status = 'published', published_at = ?, updated_at = datetime('now') WHERE id = ?", at, p.id);
          done++;
          break;
        }
        case 'delete':
          if (p.status !== 'trash') break; // permanent deletion only from the Trash
          run("DELETE FROM revisions WHERE entity = 'post' AND entity_id = ?", p.id);
          run('DELETE FROM posts WHERE id = ?', p.id); // comments and term links go with it (ON DELETE CASCADE)
          done++;
          break;
        case 'quick':
          message = quickEdit(user, p, fd) ?? '';
          if (!message) done++;
          break;
      }
    }
  });

  if (message) backWith(back, { error: message });
  const label: Record<string, string> = { trash: 'Moved to Trash', restore: 'Restored', draft: 'Moved to draft', publish: 'Published', delete: 'Deleted permanently', quick: 'Updated' };
  if (op !== 'quick') logActivity(user, op, 'post', posts.map((p) => p.id).join(','), `${label[op]}: ${posts.map((p) => p.title).join(', ')}`);
  refresh();
  backWith(back, done ? { saved: '1' } : { warn: 'No post needed that change.' });
}

/** Quick edit: title, slug, status, primary category. Returns an error message, or null when it worked. */
function quickEdit(user: AdminUser, p: PostRow, fd: FormData): string | null {
  const title = clip(fd.get(`qe_title_${p.id}`), 200);
  if (!title) return 'The title is required.';
  const slug = uniquePostSlug(slugify(clip(fd.get(`qe_slug_${p.id}`), 120) || title), p.id);

  let status: 'draft' | 'published' = clip(fd.get(`qe_status_${p.id}`), 12) === 'published' ? 'published' : 'draft';
  if (status === 'published' && !can(user, 'publish_posts')) status = 'draft';
  let at = p.published_at;
  if (status === 'published' && p.status !== 'published' && at <= nowStamp()) at = nowStamp();

  const newCat = Math.trunc(Number(fd.get(`qe_cat_${p.id}`))) || 0;
  const oldCat = Math.trunc(Number(fd.get(`qe_cat0_${p.id}`))) || 0;

  if (p.title !== title) saveRevision(p.id, user.id, p.title, p.body, `Quick edit by ${user.name || user.email}`);
  run("UPDATE posts SET title = ?, slug = ?, status = ?, published_at = ?, updated_at = datetime('now') WHERE id = ?", title, slug, status, at, p.id);

  if (newCat !== oldCat) { // category select changed: it replaces the category set (the untouched case keeps multi-category posts intact)
    const tagIds = all<{ id: number }>("SELECT t.id FROM post_terms pt JOIN terms t ON t.id = pt.term_id WHERE pt.post_id = ? AND t.taxonomy = 'tag'", p.id).map((r) => r.id);
    const valid = newCat && get("SELECT 1 AS x FROM terms WHERE id = ? AND taxonomy = 'category'", newCat);
    syncPostTerms(p.id, valid ? [newCat] : [], tagIds);
  }
  return null;
}

// ------------------------------------------------------------------ revisions
export async function restoreRevision(postId: number, revisionId: number) {
  const user = await requireCap('edit_posts');
  const post = get<PostRow>('SELECT * FROM posts WHERE id = ?', postId);
  if (!post || !canEditPost(user, post)) go('/admin/posts', { error: 'That post is not available to you.' });
  const rev = get<{ title: string; content: string }>("SELECT title, content FROM revisions WHERE id = ? AND entity = 'post' AND entity_id = ?", revisionId, postId);
  if (!rev) go(`/admin/posts/${postId}`, { error: 'That revision no longer exists.' });
  transaction(() => {
    saveRevision(postId, user.id, post!.title, post!.body, `Before restoring a revision (${user.name || user.email})`);
    run("UPDATE posts SET title = ?, body = ?, updated_at = datetime('now') WHERE id = ?", rev!.title || post!.title, rev!.content, postId);
  });
  logActivity(user, 'restore-revision', 'post', postId, post!.title);
  refresh();
  go(`/admin/posts/${postId}`, { saved: '1' });
}
