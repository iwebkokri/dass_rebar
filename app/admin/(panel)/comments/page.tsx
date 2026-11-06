import type { Metadata } from 'next';
import Link from 'next/link';
import '@/app/admin/css/posts.css';
import { commentsAction } from '@/app/admin/comments/actions';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import PostRowButton from '@/components/admin/PostRowButton';
import PostSelectAll from '@/components/admin/PostSelectAll';
import { requireCap } from '@/lib/auth';
import { COMMENT_LIMITS, type CommentStatus } from '@/lib/comments';
import { all, get } from '@/lib/db';
import { stamp } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Comments' };

const PAGE_SIZE = 30;
type Tab = 'all' | CommentStatus;
const TABS: Tab[] = ['all', 'pending', 'approved', 'spam', 'trash'];
const TAB_LABEL: Record<Tab, string> = { all: 'All', pending: 'Pending', approved: 'Approved', spam: 'Spam', trash: 'Trash' };

type Props = { searchParams: Promise<FlashParams & { status?: string; q?: string; post?: string; page?: string }> };

type Row = {
  id: number; post_id: number; parent_id: number | null; author_name: string; author_email: string; body: string; status: CommentStatus; created_at: string;
  post_title: string; post_slug: string; post_status: string; parent_name: string | null;
};

export default async function CommentsPage({ searchParams }: Props) {
  await requireCap('moderate_comments');
  const sp = await searchParams;
  const tab: Tab = TABS.includes(sp.status as Tab) ? (sp.status as Tab) : 'all';
  const q = (sp.q ?? '').trim().slice(0, 100);
  const postId = Math.trunc(Number(sp.post)) || 0;
  const page = Math.max(1, Math.trunc(Number(sp.page)) || 1);

  const where: string[] = [];
  const args: (string | number)[] = [];
  if (tab === 'all') where.push("c.status IN ('pending', 'approved')");
  else { where.push('c.status = ?'); args.push(tab); }
  if (postId) { where.push('c.post_id = ?'); args.push(postId); }
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(c.body LIKE ? ESCAPE '\\' OR c.author_name LIKE ? ESCAPE '\\' OR c.author_email LIKE ? ESCAPE '\\')");
    args.push(like, like, like);
  }
  const clause = where.join(' AND ');
  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM comments c WHERE ${clause}`, ...args)?.c ?? 0;
  const rows = all<Row>(
    `SELECT c.id, c.post_id, c.parent_id, c.author_name, c.author_email, c.body, c.status, c.created_at,
            p.title AS post_title, p.slug AS post_slug, p.status AS post_status, pc.author_name AS parent_name
     FROM comments c JOIN posts p ON p.id = c.post_id LEFT JOIN comments pc ON pc.id = c.parent_id
     WHERE ${clause} ORDER BY c.id DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    ...args
  );
  const byStatus = Object.fromEntries(all<{ status: string; c: number }>('SELECT status, COUNT(*) AS c FROM comments GROUP BY status').map((r) => [r.status, r.c]));
  const counts: Record<Tab, number> = {
    all: (byStatus.pending ?? 0) + (byStatus.approved ?? 0), pending: byStatus.pending ?? 0, approved: byStatus.approved ?? 0, spam: byStatus.spam ?? 0, trash: byStatus.trash ?? 0,
  };
  const postFilter = postId ? get<{ title: string }>('SELECT title FROM posts WHERE id = ?', postId) : undefined;

  const link = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(tab !== 'all' && { status: tab }), ...(q && { q }), ...(postId && { post: String(postId) }), ...over });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/admin/comments${p.size ? `?${p}` : ''}`;
  };
  const back = link({ page: page > 1 ? String(page) : '' });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Comments</h1>
          <p>{counts.pending > 0 ? `${counts.pending} waiting for moderation.` : 'Nothing is waiting for moderation.'} Comments appear on the site only after you approve them.</p>
        </div>
      </div>

      <Flash params={sp} />

      <div className="sc-tabs" role="navigation" aria-label="Filter by status">
        {TABS.map((t) => (<Link key={t} href={link({ status: t === 'all' ? '' : t, page: '' })} aria-current={tab === t}>{TAB_LABEL[t]} ({counts[t]})</Link>))}
      </div>

      <div className="po-toolbar">
        <form id="bulk-form" action={commentsAction} className="po-bulk">
          <input type="hidden" name="back" value={back} />
          <select className="sc-select" name="bulk" aria-label="Bulk action" defaultValue="">
            <option value="">Bulk actions</option>
            {tab === 'trash' ? (
              <>
                <option value="restore">Restore</option>
                <option value="delete">Delete permanently</option>
              </>
            ) : tab === 'spam' ? (
              <>
                <option value="notspam">Not spam</option>
                <option value="trash">Move to Trash</option>
                <option value="delete">Delete permanently</option>
              </>
            ) : (
              <>
                <option value="approve">Approve</option>
                <option value="unapprove">Unapprove</option>
                <option value="spam">Mark as spam</option>
                <option value="trash">Move to Trash</option>
              </>
            )}
          </select>
          <button className="sc-btn sc-btn-sm" type="submit">Apply</button>
          {tab === 'spam' && counts.spam > 0 && <PostRowButton op="emptyspam:0" confirm="Permanently delete all spam comments?" className="po-act-danger">Delete all spam</PostRowButton>}
          {tab === 'trash' && counts.trash > 0 && <PostRowButton op="emptytrash:0" confirm="Permanently delete everything in the Trash?" className="po-act-danger">Empty Trash</PostRowButton>}
        </form>

        <form method="get" action="/admin/comments" className="po-filter">
          {tab !== 'all' && <input type="hidden" name="status" value={tab} />}
          {postId > 0 && <input type="hidden" name="post" value={postId} />}
          <input className="sc-input" type="search" name="q" defaultValue={q} placeholder="Search comments" aria-label="Search comments" />
          <button className="sc-btn sc-btn-sm" type="submit">Search</button>
          {(q || postId > 0) && <Link className="sc-btn sc-btn-sm" href={link({ q: '', post: '', page: '' })}>Reset</Link>}
        </form>
      </div>
      {postFilter && <p className="sc-muted" style={{ margin: '0 0 12px' }}>Showing comments on <strong>{postFilter.title}</strong>.</p>}

      <div className="sc-tablewrap">
        {rows.length === 0 ? (
          <div className="sc-empty">{q || postId ? 'No comments match your search.' : tab === 'all' ? 'No comments yet. Visitors can comment on articles that have comments switched on.' : `No ${tab} comments.`}</div>
        ) : (
          <table className="sc-table po-table">
            <thead>
              <tr>
                <th className="po-check"><PostSelectAll form="bulk-form" /></th>
                <th>Author</th>
                <th>Comment</th>
                <th>In response to</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className={c.status === 'pending' ? 'po-pending' : undefined}>
                  <td className="po-check"><input type="checkbox" name="ids" value={c.id} form="bulk-form" aria-label={`Select comment by ${c.author_name}`} /></td>
                  <td className="po-author">
                    <strong>{c.author_name}</strong>
                    {c.author_email && <div className="sc-muted">{c.author_email}</div>}
                  </td>
                  <td className="po-title-cell po-comment-cell">
                    <form action={commentsAction}>
                      <input type="hidden" name="back" value={back} />
                      <div className="po-meta-line">
                        <span className={`sc-badge ${c.status === 'approved' ? 'sc-badge-ok' : c.status === 'pending' ? 'sc-badge-warn' : ''}`}>{c.status}</span>
                        {c.parent_name && <span className="sc-faint">in reply to {c.parent_name}</span>}
                      </div>
                      {/* plain text only; line breaks kept */}
                      <p className="po-comment">{c.body}</p>
                      <div className="po-actions">
                        {c.status === 'pending' && <PostRowButton op={`approve:${c.id}`}>Approve</PostRowButton>}
                        {c.status === 'approved' && <PostRowButton op={`unapprove:${c.id}`}>Unapprove</PostRowButton>}
                        {(c.status === 'pending' || c.status === 'approved') && (
                          <>
                            <input type="checkbox" id={`rp-${c.id}`} className="po-t-reply" hidden />
                            <label htmlFor={`rp-${c.id}`} className="po-act" role="button" tabIndex={0}>Reply</label>
                          </>
                        )}
                        {c.status !== 'trash' && c.status !== 'spam' && (
                          <>
                            <input type="checkbox" id={`ed-${c.id}`} className="po-t-edit" hidden />
                            <label htmlFor={`ed-${c.id}`} className="po-act" role="button" tabIndex={0}>Edit</label>
                          </>
                        )}
                        {c.status === 'spam' && <PostRowButton op={`notspam:${c.id}`}>Not spam</PostRowButton>}
                        {c.status === 'trash' && <PostRowButton op={`restore:${c.id}`}>Restore</PostRowButton>}
                        {(c.status === 'pending' || c.status === 'approved') && <PostRowButton op={`spam:${c.id}`} className="po-act-danger">Spam</PostRowButton>}
                        {c.status !== 'trash' && c.status !== 'spam' && <PostRowButton op={`trash:${c.id}`} className="po-act-danger">Trash</PostRowButton>}
                        {(c.status === 'trash' || c.status === 'spam') && <PostRowButton op={`delete:${c.id}`} confirm="Delete this comment permanently?" className="po-act-danger">Delete permanently</PostRowButton>}

                        <div className="po-panel po-p-reply">
                          <label htmlFor={`rt-${c.id}`} className="sc-label">Reply as you ({c.status === 'pending' ? 'this also approves the comment' : 'published straight away'})</label>
                          <textarea className="sc-textarea" id={`rt-${c.id}`} name={`reply_${c.id}`} rows={3} maxLength={COMMENT_LIMITS.body} />
                          <div className="po-qe-buttons">
                            <button type="submit" name="op" value={`reply:${c.id}`} className="sc-btn sc-btn-sm sc-btn-primary">{c.status === 'pending' ? 'Approve and reply' : 'Reply'}</button>
                            <label htmlFor={`rp-${c.id}`} className="sc-btn sc-btn-sm" role="button">Cancel</label>
                          </div>
                        </div>
                        <div className="po-panel po-p-edit">
                          <label htmlFor={`et-${c.id}`} className="sc-label">Edit comment text</label>
                          <textarea className="sc-textarea" id={`et-${c.id}`} name={`edit_${c.id}`} rows={4} maxLength={COMMENT_LIMITS.body} defaultValue={c.body} />
                          <div className="po-qe-buttons">
                            <button type="submit" name="op" value={`edit:${c.id}`} className="sc-btn sc-btn-sm sc-btn-primary">Save</button>
                            <label htmlFor={`ed-${c.id}`} className="sc-btn sc-btn-sm" role="button">Cancel</label>
                          </div>
                        </div>
                      </div>
                    </form>
                  </td>
                  <td>
                    <Link className="sc-rowlink" href={`/admin/posts/${c.post_id}`}>{c.post_title}</Link>
                    {c.post_status === 'published' && <div><a className="po-link" href={`/insights/${c.post_slug}#comment-${c.id}`} target="_blank" rel="noopener">View on site ↗</a></div>}
                  </td>
                  <td className="po-date">{stamp(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="sc-pager">
          {page > 1 && <Link className="sc-btn sc-btn-sm" href={link({ page: String(page - 1) })}>← Newer</Link>}
          <span>Page {page} of {pages}</span>
          {page < pages && <Link className="sc-btn sc-btn-sm" href={link({ page: String(page + 1) })}>Older →</Link>}
        </div>
      )}
    </>
  );
}
