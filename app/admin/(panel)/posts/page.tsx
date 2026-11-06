import type { Metadata } from 'next';
import Link from 'next/link';
import '@/app/admin/css/posts.css';
import { postsAction } from '@/app/admin/posts/actions';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import PostRowButton from '@/components/admin/PostRowButton';
import PostSelectAll from '@/components/admin/PostSelectAll';
import { requireCap } from '@/lib/auth';
import { approvedCounts, pendingCounts } from '@/lib/comments';
import { termsFor } from '@/lib/content';
import { all } from '@/lib/db';
import { stampToLocalInput } from '@/lib/post-time';
import { PAGE_SIZE, TABS, allTerms, listPosts, postState, type Tab } from '@/lib/posts';
import { can } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Posts' };

type Props = { searchParams: Promise<FlashParams & { tab?: string; q?: string; cat?: string; author?: string; page?: string }> };

const TAB_LABEL: Record<Tab, string> = { all: 'All', published: 'Published', draft: 'Drafts', scheduled: 'Scheduled', trash: 'Trash' };
const when = (v: string) => (v.length <= 10 ? v : stampToLocalInput(v).replace('T', ' '));

export default async function PostsPage({ searchParams }: Props) {
  const user = await requireCap('edit_posts');
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : 'all';
  const filters = {
    tab,
    q: (sp.q ?? '').trim().slice(0, 100),
    cat: (sp.cat ?? '').slice(0, 80),
    author: Math.trunc(Number(sp.author)) || 0,
    page: Math.max(1, Math.trunc(Number(sp.page)) || 1),
  };
  const canOthers = can(user, 'edit_others_posts');
  const canDelete = can(user, 'delete_posts');
  const canPublish = can(user, 'publish_posts');
  const canModerate = can(user, 'moderate_comments');

  const { rows, total, counts } = listPosts(user, filters);
  const ids = rows.map((r) => r.id);
  const terms = termsFor(ids);
  const approved = approvedCounts(ids);
  const pending = pendingCounts(ids);
  const categories = allTerms('category');
  const authors = canOthers
    ? all<{ id: number; name: string }>("SELECT DISTINCT u.id, COALESCE(NULLIF(u.name, ''), u.email) AS name FROM users u JOIN posts p ON p.author_id = u.id ORDER BY name COLLATE NOCASE")
    : [];
  const catIdBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  const link = (over: Record<string, string>) => {
    const q = new URLSearchParams({ ...(filters.tab !== 'all' && { tab: filters.tab }), ...(filters.q && { q: filters.q }), ...(filters.cat && { cat: filters.cat }), ...(filters.author && { author: String(filters.author) }), ...over });
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    return `/admin/posts${q.size ? `?${q}` : ''}`;
  };
  const back = link({ page: filters.page > 1 ? String(filters.page) : '' });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(filters.q || filters.cat || filters.author);

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Posts</h1>
          <p>Articles for the Insights page.{!canOthers && ' You see and edit your own posts.'}</p>
        </div>
        <div className="sc-actions">
          <Link className="sc-btn" href="/insights" target="_blank" rel="noopener">View on site ↗</Link>
          <Link className="sc-btn sc-btn-primary" href="/admin/posts/new">Add new post</Link>
        </div>
      </div>

      <Flash params={sp} />

      <div className="sc-tabs" role="navigation" aria-label="Filter by status">
        {TABS.filter((t) => t === 'all' || t === tab || counts[t] > 0).map((t) => (
          <Link key={t} href={link({ tab: t === 'all' ? '' : t, page: '' })} aria-current={tab === t}>{TAB_LABEL[t]} ({counts[t]})</Link>
        ))}
      </div>

      <div className="po-toolbar">
        <form id="bulk-form" action={postsAction} className="po-bulk">
          <input type="hidden" name="back" value={back} />
          <select className="sc-select" name="bulk" aria-label="Bulk action" defaultValue="">
            <option value="">Bulk actions</option>
            {tab === 'trash' ? (
              <>
                <option value="restore">Restore</option>
                {canDelete && <option value="delete">Delete permanently</option>}
              </>
            ) : (
              <>
                {canPublish && <option value="publish">Publish</option>}
                <option value="draft">Move to draft</option>
                {canDelete && <option value="trash">Move to Trash</option>}
              </>
            )}
          </select>
          <button className="sc-btn sc-btn-sm" type="submit">Apply</button>
          {tab === 'trash' && counts.trash > 0 && canDelete && (
            <PostRowButton op="empty:0" confirm="Permanently delete everything in the Trash? This can’t be undone." className="po-act-danger">Empty Trash</PostRowButton>
          )}
        </form>

        <form method="get" action="/admin/posts" className="po-filter">
          {tab !== 'all' && <input type="hidden" name="tab" value={tab} />}
          <input className="sc-input" type="search" name="q" defaultValue={filters.q} placeholder="Search posts" aria-label="Search posts" />
          <select className="sc-select" name="cat" defaultValue={filters.cat} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((c) => (<option key={c.id} value={c.slug}>{c.name}</option>))}
          </select>
          {canOthers && (
            <select className="sc-select" name="author" defaultValue={filters.author ? String(filters.author) : ''} aria-label="Filter by author">
              <option value="">All authors</option>
              {authors.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>
          )}
          <button className="sc-btn sc-btn-sm" type="submit">Filter</button>
          {filtered && <Link className="sc-btn sc-btn-sm" href={link({ q: '', cat: '', author: '', page: '' })}>Reset</Link>}
        </form>
      </div>

      <div className="sc-tablewrap">
        {rows.length === 0 ? (
          <div className="sc-empty">
            {filtered ? 'No posts match these filters.' : tab === 'trash' ? 'The Trash is empty.' : <>No posts yet. <Link className="sc-rowlink" href="/admin/posts/new">Write the first one</Link>.</>}
          </div>
        ) : (
          <table className="sc-table po-table">
            <thead>
              <tr>
                <th className="po-check"><PostSelectAll form="bulk-form" /></th>
                <th>Title</th>
                <th>Author</th>
                <th>Categories</th>
                <th>Tags</th>
                <th className="po-num" title="Approved comments">Comments</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const state = postState(p);
                const t = terms.get(p.id) ?? { categories: [], tags: [] };
                const primary = t.categories.find((c) => c.name === p.category) ?? t.categories[0];
                const viewUrl = p.external_url || (state === 'published' ? `/insights/${p.slug}` : `/insights/${p.slug}?preview=1`);
                const ok = approved.get(p.id) ?? 0;
                const wait = pending.get(p.id) ?? 0;
                return (
                  <tr key={p.id}>
                    <td className="po-check"><input type="checkbox" name="ids" value={p.id} form="bulk-form" aria-label={`Select ${p.title}`} /></td>
                    <td className="po-title-cell">
                      <form action={postsAction}>
                        <input type="hidden" name="back" value={back} />
                        <button type="submit" name="op" value={`quick:${p.id}`} hidden tabIndex={-1} aria-hidden="true" />
                        <div className="po-title-line">
                          {state === 'trash' ? <strong>{p.title}</strong> : <Link className="sc-rowlink" href={`/admin/posts/${p.id}`}>{p.title || '(untitled)'}</Link>}
                          {state === 'draft' && <span className="sc-badge sc-badge-warn">Draft</span>}
                          {state === 'scheduled' && <span className="sc-badge">Scheduled</span>}
                          {p.featured ? <span className="sc-badge sc-badge-ok" title="Featured on the Insights page">Featured</span> : null}
                          {p.external_url ? <span className="sc-badge" title={p.external_url}>Link ↗</span> : null}
                        </div>
                        <div className="po-actions">
                          {state === 'trash' ? (
                            <>
                              <PostRowButton op={`restore:${p.id}`}>Restore</PostRowButton>
                              {canDelete && <PostRowButton op={`delete:${p.id}`} confirm="Delete this post permanently? This can’t be undone." className="po-act-danger">Delete permanently</PostRowButton>}
                            </>
                          ) : (
                            <>
                              <Link className="po-act" href={`/admin/posts/${p.id}`}>Edit</Link>
                              <input type="checkbox" id={`qe-${p.id}`} className="po-qe-toggle" hidden />
                              <label htmlFor={`qe-${p.id}`} className="po-act" role="button" tabIndex={0}>Quick edit</label>
                              <a className="po-act" href={viewUrl} target="_blank" rel="noopener">{state === 'published' || p.external_url ? 'View' : 'Preview'}</a>
                              {canDelete && <PostRowButton op={`trash:${p.id}`} className="po-act-danger">Trash</PostRowButton>}
                              <div className="po-qe-panel">
                                <div className="sc-field"><label htmlFor={`qt-${p.id}`}>Title</label><input className="sc-input" id={`qt-${p.id}`} name={`qe_title_${p.id}`} defaultValue={p.title} maxLength={200} /></div>
                                <div className="sc-field"><label htmlFor={`qs-${p.id}`}>Slug</label><input className="sc-input" id={`qs-${p.id}`} name={`qe_slug_${p.id}`} defaultValue={p.slug} maxLength={120} /></div>
                                <div className="sc-field">
                                  <label htmlFor={`qst-${p.id}`}>Status</label>
                                  <select className="sc-select" id={`qst-${p.id}`} name={`qe_status_${p.id}`} defaultValue={p.status}>
                                    <option value="draft">Draft</option>
                                    {(canPublish || p.status === 'published') && <option value="published">Published</option>}
                                  </select>
                                </div>
                                <div className="sc-field">
                                  <label htmlFor={`qc-${p.id}`}>Category</label>
                                  <input type="hidden" name={`qe_cat0_${p.id}`} value={primary ? catIdBySlug.get(primary.slug) ?? 0 : 0} />
                                  <select className="sc-select" id={`qc-${p.id}`} name={`qe_cat_${p.id}`} defaultValue={primary ? String(catIdBySlug.get(primary.slug) ?? 0) : '0'}>
                                    <option value="0">— none —</option>
                                    {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                                  </select>
                                  {t.categories.length > 1 && <span className="sc-help">Changing this replaces all {t.categories.length} categories.</span>}
                                </div>
                                <div className="po-qe-buttons">
                                  <button type="submit" name="op" value={`quick:${p.id}`} className="sc-btn sc-btn-sm sc-btn-primary">Update</button>
                                  <label htmlFor={`qe-${p.id}`} className="sc-btn sc-btn-sm" role="button">Cancel</label>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </form>
                    </td>
                    <td>{p.author_name ? (canOthers && p.author_id ? <Link className="po-link" href={link({ author: String(p.author_id), page: '' })}>{p.author_name}</Link> : p.author_name) : <span className="sc-muted">—</span>}</td>
                    <td>{t.categories.length ? t.categories.map((c, i) => (<span key={c.slug}>{i > 0 && ', '}<Link className="po-link" href={link({ cat: c.slug, page: '' })}>{c.name}</Link></span>)) : <span className="sc-muted">—</span>}</td>
                    <td className="sc-muted">{t.tags.length ? t.tags.map((x) => x.name).join(', ') : '—'}</td>
                    <td className="po-num">
                      {canModerate ? <Link className="po-link" href={`/admin/comments?post=${p.id}`}>{ok}</Link> : ok}
                      {wait > 0 && canModerate && <Link className="po-bubble" href={`/admin/comments?post=${p.id}&status=pending`} title={`${wait} awaiting moderation`}>{wait}</Link>}
                    </td>
                    <td className="po-date">
                      <span className="sc-muted">{state === 'published' ? 'Published' : state === 'scheduled' ? 'Scheduled' : state === 'draft' ? 'Last modified' : 'Trashed'}</span>
                      <div>{when(state === 'draft' || state === 'trash' ? p.updated_at : p.published_at)}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="sc-pager">
          {filters.page > 1 && <Link className="sc-btn sc-btn-sm" href={link({ page: String(filters.page - 1) })}>← Newer</Link>}
          <span>Page {filters.page} of {pages}</span>
          {filters.page < pages && <Link className="sc-btn sc-btn-sm" href={link({ page: String(filters.page + 1) })}>Older →</Link>}
        </div>
      )}
    </>
  );
}
