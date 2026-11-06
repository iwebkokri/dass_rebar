import type { Metadata } from 'next';
import Link from 'next/link';
import '../../css/pages.css';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import PagesList, { type PagesListRow } from '@/components/admin/PagesList';
import { requireCap } from '@/lib/auth';
import { stamp } from '@/lib/format';
import { PAGE_TABS, TAB_LABEL, displayPath, pageCounts, queryPages, viewUrl, type PageTab } from '@/lib/page-admin';
import { can } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pages' };

const PER_PAGE = 20;
type SP = FlashParams & { status?: string; q?: string; page?: string; msg?: string };

export default async function PagesAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireCap('edit_pages');
  const sp = await searchParams;
  const tab = (PAGE_TABS as string[]).includes(sp.status ?? '') ? (sp.status as PageTab) : 'all';
  const q = (sp.q ?? '').trim().slice(0, 100);
  const pageNo = Math.max(1, Math.trunc(Number(sp.page)) || 1);

  const counts = pageCounts();
  const { rows, total } = queryPages(tab, q, pageNo, PER_PAGE);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));

  const href = (over: { status?: string; page?: number }) => {
    const p = new URLSearchParams();
    const status = over.status ?? tab;
    if (status !== 'all') p.set('status', status);
    if (q) p.set('q', q);
    if ((over.page ?? 1) > 1) p.set('page', String(over.page));
    const s = p.toString();
    return s ? `/admin/pages?${s}` : '/admin/pages';
  };

  const list: PagesListRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    path: r.path,
    displayPath: displayPath(r.path),
    isHome: r.path === '',
    state: r.state,
    stateNote: r.state === 'scheduled' && r.published_at ? `Goes live ${stamp(r.published_at)}` : '',
    layout: r.layout,
    noindex: !!r.noindex,
    author: r.author ?? '',
    updated: stamp(r.updated_at),
    viewHref: viewUrl(r.path, r.state),
  }));

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Pages</h1>
          <p>{counts.all} {counts.all === 1 ? 'page' : 'pages'}. Edit the content visually with the page builder; page settings (title, path, SEO, status) are under “Settings”.</p>
        </div>
        <div className="sc-actions">
          <Link className="sc-btn sc-btn-primary" href="/admin/pages/new">Add new page</Link>
        </div>
      </div>

      {sp.msg && <div className="pg-notice" role="status">{sp.msg.slice(0, 300)}</div>}
      <Flash params={{ error: sp.error, warn: sp.warn }} />

      <div className="pg-toolbar">
        <nav className="sc-tabs" aria-label="Page status">
          {PAGE_TABS.map((t) => (
            <Link key={t} href={href({ status: t })} aria-current={t === tab ? 'true' : undefined}>
              {TAB_LABEL[t]}<span className="pg-tabcount">{counts[t]}</span>
            </Link>
          ))}
        </nav>
        <form className="pg-search" action="/admin/pages" role="search">
          {tab !== 'all' && <input type="hidden" name="status" value={tab} />}
          <input className="sc-input" type="search" name="q" defaultValue={q} placeholder="Search pages…" aria-label="Search pages" />
          <button className="sc-btn" type="submit">Search</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="sc-tablewrap">
          <div className="sc-empty">
            {q ? <>No pages match “{q}”. <Link className="sc-rowlink" href={href({})}>Clear the search</Link>.</> : tab === 'trash' ? 'The trash is empty.' : <>Nothing here yet. <Link className="sc-rowlink" href="/admin/pages/new">Add a page</Link>.</>}
          </div>
        </div>
      ) : (
        <PagesList rows={list} tab={tab} back={href({ page: pageNo })} canBuild={can(user, 'use_builder')} canPublish={can(user, 'publish_pages')} canDelete={can(user, 'delete_pages')} />
      )}

      {pages > 1 && (
        <div className="sc-pager">
          <span>{total} items · page {pageNo} of {pages}</span>
          {pageNo > 1 && <Link className="sc-btn sc-btn-sm" href={href({ page: pageNo - 1 })}>← Previous</Link>}
          {pageNo < pages && <Link className="sc-btn sc-btn-sm" href={href({ page: pageNo + 1 })}>Next →</Link>}
        </div>
      )}
    </>
  );
}
