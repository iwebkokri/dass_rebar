import type { Metadata } from 'next';
import Link from 'next/link';
import '../css/pages.css';
import { quickDraft } from '@/app/admin/dashboard/actions';
import Flash from '@/components/admin/Flash';
import LeadForwardStatus from '@/components/admin/LeadForwardStatus';
import MailStatus from '@/components/admin/MailStatus';
import { requireUser } from '@/lib/auth';
import { all, get } from '@/lib/db';
import { stamp } from '@/lib/format';
import { nowUtc, pageState, viewUrl } from '@/lib/page-admin';
import { can } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Dashboard' };

/** Tables may be empty or (on a half-migrated copy) missing: a failing query must never break the dashboard. */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
const count = (sql: string, ...params: (string | number)[]) => safe(() => get<{ c: number }>(sql, ...params)?.c ?? 0, 0);

type SP = { error?: string; draft?: string };

export default async function Dashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = nowUtc();

  const may = {
    pages: can(user, 'edit_pages'),
    posts: can(user, 'edit_posts'),
    media: can(user, 'upload_media'),
    comments: can(user, 'moderate_comments'),
    subs: can(user, 'view_submissions'),
    build: can(user, 'use_builder'),
    menus: can(user, 'manage_menus'),
    site: can(user, 'manage_site'),
  };

  // ---- at a glance ----
  const ownOnly = !can(user, 'edit_others_posts');
  const postScope = ownOnly ? ' AND author_id = ' + Number(user.id) : '';
  const glance = {
    pages: may.pages ? count("SELECT COUNT(*) AS c FROM pages WHERE status <> 'trash'") : 0,
    pagesLive: may.pages ? count("SELECT COUNT(*) AS c FROM pages WHERE status = 'published' AND (published_at IS NULL OR published_at <= ?)", now) : 0,
    posts: may.posts ? count(`SELECT COUNT(*) AS c FROM posts WHERE status <> 'trash'${postScope}`) : 0,
    postsDraft: may.posts ? count(`SELECT COUNT(*) AS c FROM posts WHERE status = 'draft'${postScope}`) : 0,
    media: may.media ? count('SELECT COUNT(*) AS c FROM media') : 0,
    pending: may.comments ? count("SELECT COUNT(*) AS c FROM comments WHERE status = 'pending'") : 0,
    fresh: may.subs ? count("SELECT COUNT(*) AS c FROM submissions WHERE status = 'new'") : 0,
  };

  // ---- lists ----
  const pages = may.pages
    ? safe(() => all<{ id: number; title: string; path: string; status: 'draft' | 'published' | 'trash'; published_at: string | null; updated_at: string; author: string | null }>(
        `SELECT p.id, p.title, p.path, p.status, p.published_at, p.updated_at, COALESCE(NULLIF(u.name, ''), u.email) AS author
           FROM pages p LEFT JOIN users u ON u.id = p.author_id WHERE p.status <> 'trash' ORDER BY p.updated_at DESC, p.id DESC LIMIT 6`
      ), [])
    : [];
  const subs = may.subs
    ? safe(() => all<{ id: number; type: string; name: string; email: string; status: string; created_at: string }>('SELECT id, type, name, email, status, created_at FROM submissions ORDER BY id DESC LIMIT 5'), [])
    : [];
  const activity = safe(
    () =>
      may.site
        ? all<{ id: number; user_label: string; action: string; entity: string; summary: string; created_at: string }>('SELECT id, user_label, action, entity, summary, created_at FROM activity ORDER BY id DESC LIMIT 8')
        : all<{ id: number; user_label: string; action: string; entity: string; summary: string; created_at: string }>('SELECT id, user_label, action, entity, summary, created_at FROM activity WHERE user_id = ? ORDER BY id DESC LIMIT 8', user.id),
    []
  );

  const draftId = Number(sp.draft) || 0;
  const error = sp.error === 'forbidden' ? 'You don’t have permission to open that page.' : sp.error;

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {user.name || user.email}.</p>
        </div>
        <div className="sc-actions">
          {may.pages && <Link className="sc-btn sc-btn-primary" href="/admin/pages/new">New page</Link>}
          {may.posts && <Link className="sc-btn" href="/admin/posts/new">New post</Link>}
        </div>
      </div>

      <Flash params={{ error }} />
      {(can(user, 'manage_email') || may.subs) && <MailStatus canManage={can(user, 'manage_email')} />}
      {can(user, 'manage_integrations') && <LeadForwardStatus />}
      {draftId > 0 && (
        <div className="pg-notice" role="status">
          Draft saved. <Link href={`/admin/posts/${draftId}`}>Keep writing it</Link>.
        </div>
      )}

      <div className="sc-stats">
        {may.pages && <Link className="sc-stat" href="/admin/pages"><b>{glance.pages}</b><span>Pages{glance.pages ? ` · ${glance.pagesLive} live` : ''}</span></Link>}
        {may.posts && <Link className="sc-stat" href="/admin/posts"><b>{glance.posts}</b><span>{ownOnly ? 'Your posts' : 'Posts'}{glance.postsDraft ? ` · ${glance.postsDraft} draft${glance.postsDraft === 1 ? '' : 's'}` : ''}</span></Link>}
        {may.media && <Link className="sc-stat" href="/admin/media"><b>{glance.media}</b><span>Media files</span></Link>}
        {may.comments && <Link className="sc-stat" href="/admin/comments?status=pending"><b>{glance.pending}</b><span>Comments awaiting moderation</span></Link>}
        {may.subs && <Link className="sc-stat" href="/admin/submissions?status=new"><b>{glance.fresh}</b><span>New form submissions</span></Link>}
      </div>

      <div className="pg-dash">
        <div className="pg-dash-col">
          {may.pages && (
            <div className="sc-card">
              <h2>Recently edited pages <Link className="pg-cardlink" href="/admin/pages">All pages →</Link></h2>
              {pages.length === 0 ? (
                <p className="sc-muted" style={{ margin: 0 }}>No pages yet. <Link className="sc-rowlink" href="/admin/pages/new">Add the first one</Link>.</p>
              ) : (
                <ul className="pg-list">
                  {pages.map((p) => {
                    const st = pageState(p);
                    return (
                      <li key={p.id}>
                        <div className="pg-li-main">
                          <Link href={may.build ? `/admin/builder/page-${p.id}` : `/admin/pages/${p.id}`} prefetch={false}>{p.title || '(untitled)'}</Link>
                          <small>{p.path === '' ? '/' : '/' + p.path} · {stamp(p.updated_at)}{p.author ? ` · ${p.author}` : ''}</small>
                        </div>
                        <div className="pg-li-end">
                          <span className={`sc-badge ${st === 'published' ? 'sc-badge-ok' : st === 'draft' ? 'sc-badge-warn' : ''}`}>{st}</span>
                          {may.build && <Link className="sc-btn sc-btn-sm" href={`/admin/builder/page-${p.id}`} prefetch={false}>Edit with builder</Link>}
                          <Link className="sc-btn sc-btn-sm" href={viewUrl(p.path, st)} target="_blank" rel="noopener" prefetch={false}>{st === 'published' ? 'View' : 'Preview'}</Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {may.subs && (
            <div className="sc-card">
              <h2>Latest submissions <Link className="pg-cardlink" href="/admin/submissions">All submissions →</Link></h2>
              {subs.length === 0 ? (
                <p className="sc-muted" style={{ margin: 0 }}>Nothing yet. Contact, quote, calculator, newsletter and custom form entries will appear here.</p>
              ) : (
                <ul className="pg-list">
                  {subs.map((s) => (
                    <li key={s.id}>
                      <div className="pg-li-main">
                        <Link href={`/admin/submissions/${s.id}`}>{s.name || s.email || '—'}</Link>
                        <small>{s.type.startsWith('form:') ? s.type.slice(5) : s.type} · {stamp(s.created_at)}</small>
                      </div>
                      <span className={`sc-badge ${s.status === 'new' ? 'sc-badge-new' : ''}`}>{s.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="pg-dash-col">
          {may.posts && (
            <div className="sc-card">
              <h2>Quick draft</h2>
              <form action={quickDraft} className="pg-draftform">
                <input className="sc-input" name="title" placeholder="Title" maxLength={200} aria-label="Title" />
                <textarea className="sc-textarea" name="body" placeholder="What’s on your mind?" maxLength={20000} aria-label="Content" />
                <div><button className="sc-btn sc-btn-primary" type="submit">Save draft</button></div>
              </form>
            </div>
          )}

          <div className="sc-card">
            <h2>Quick links</h2>
            <div className="pg-quick">
              {may.pages && <Link className="sc-btn" href="/admin/pages/new">New page</Link>}
              {may.posts && <Link className="sc-btn" href="/admin/posts/new">New post</Link>}
              {may.media && <Link className="sc-btn" href="/admin/media">Media library</Link>}
              {may.menus && <Link className="sc-btn" href="/admin/menus">Menus</Link>}
              {may.site && <Link className="sc-btn" href="/admin/templates">Header &amp; footer</Link>}
              {can(user, 'manage_settings') && <Link className="sc-btn" href="/admin/settings">Settings</Link>}
              <Link className="sc-btn" href="/" target="_blank" rel="noopener">View site ↗</Link>
            </div>
          </div>

          <div className="sc-card">
            <h2>{may.site ? 'Recent activity' : 'Your recent activity'} {may.site && <Link className="pg-cardlink" href="/admin/activity">Activity log →</Link>}</h2>
            {activity.length === 0 ? (
              <p className="sc-muted" style={{ margin: 0 }}>No activity recorded yet.</p>
            ) : (
              <ul className="pg-activity">
                {activity.map((a) => (
                  <li key={a.id}>
                    <b>{a.user_label || 'System'}</b> {a.action}{a.entity ? ` ${a.entity}` : ''}{a.summary ? <> — {a.summary}</> : null}
                    <time>{stamp(a.created_at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
