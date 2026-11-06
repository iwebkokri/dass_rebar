import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import '../../../css/pages.css';
import '../../../css/seo.css';
import { pagesAction, restoreRevision, savePageSettings } from '@/app/admin/pages/actions';
import ConfirmButton from '@/components/admin/ConfirmButton';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import MediaField from '@/components/admin/MediaField';
import PagesSettingsFields from '@/components/admin/PagesSettingsFields';
import SeoFields from '@/components/admin/SeoFields';
import SeoReport from '@/components/admin/SeoReport';
import { requireCap } from '@/lib/auth';
import { all, get } from '@/lib/db';
import { stamp } from '@/lib/format';
import { pageState, siteInfo, viewUrl } from '@/lib/page-admin';
import { pageDoc } from '@/lib/pages';
import { stampToLocalInput } from '@/lib/post-time';
import { can } from '@/lib/roles';
import { analyzePage } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Page settings' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<FlashParams & { msg?: string }> };
type Row = {
  id: number; path: string; title: string; status: 'draft' | 'published' | 'trash'; layout: string; seo_title: string; seo_description: string;
  og_image: string; noindex: number; published_at: string | null; created_at: string; updated_at: string; author: string | null; content: string;
  nofollow: number; focus_keyword: string; canonical_url: string; og_title: string; og_description: string; twitter_card: string; schema_type: string;
  answer_summary: string; breadcrumb_title: string; custom_jsonld: string; code_css: string; code_head: string; code_footer: string;
};

export default async function PageSettings({ params, searchParams }: Props) {
  const user = await requireCap('edit_pages');
  const id = Number((await params).id);
  const sp = await searchParams;
  const page = Number.isInteger(id)
    ? get<Row>(
        `SELECT p.*, COALESCE(NULLIF(u.name, ''), u.email) AS author FROM pages p LEFT JOIN users u ON u.id = p.author_id WHERE p.id = ?`,
        id
      )
    : undefined;
  if (!page) notFound();
  const p = page as Row;

  const isHome = p.path === '';
  const state = pageState(p);
  const trashed = p.status === 'trash';
  const mayPublish = can(user, 'publish_pages');
  const site = siteInfo();
  const analysis = trashed ? null : analyzePage(p, pageDoc(p).nodes);
  const revisions = all<{ id: number; created_at: string; note: string; who: string | null; is_current: number }>(
    `SELECT r.id, r.created_at, r.note, COALESCE(NULLIF(u.name, ''), u.email) AS who, (r.content = p.content) AS is_current
       FROM revisions r JOIN pages p ON p.id = r.entity_id LEFT JOIN users u ON u.id = r.user_id
      WHERE r.entity = 'page' AND r.entity_id = ? ORDER BY r.id DESC LIMIT 20`,
    id
  );

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>{p.title || 'Page settings'}</h1>
          <p>Page settings. The content itself is edited in the page builder.</p>
        </div>
        <div className="sc-actions">
          <Link className="sc-btn" href="/admin/pages">← All pages</Link>
          {!trashed && <Link className="sc-btn" href={viewUrl(p.path, state)} target="_blank" rel="noopener" prefetch={false}>{state === 'published' ? 'View' : 'Preview'} ↗</Link>}
          {!trashed && can(user, 'use_builder') && <Link className="sc-btn sc-btn-primary" href={`/admin/builder/page-${p.id}`} prefetch={false}>Edit with builder</Link>}
        </div>
      </div>

      {sp.msg && <div className="pg-notice" role="status">{sp.msg.slice(0, 300)}</div>}
      <Flash params={{ saved: sp.saved, error: sp.error, warn: sp.warn }} />
      {trashed && <div className="sc-flash sc-flash-warn">This page is in the Trash. Restore it to change its status or edit it in the builder.</div>}

      <form action={savePageSettings} className="pg-edit">
        <input type="hidden" name="id" value={p.id} />

        <div className="pg-main">
          <PagesSettingsFields title={p.title} path={p.path} isHome={isHome} seoTitle={p.seo_title} seoDescription={p.seo_description} siteName={site.name} siteHost={site.host} />
          <div className="sc-card pg-stack">
            <div className="pg-card-h"><h2>Social image</h2></div>
            <MediaField name="og_image" defaultValue={p.og_image} kind="image" label="Image shown when the page is shared" help="Recommended 1200 × 630 px. Empty uses the site default." />
          </div>
          <SeoFields
            kind="page"
            canJsonLd={can(user, 'manage_seo')}
            canCode={can(user, 'manage_code')}
            values={{
              focus_keyword: p.focus_keyword, canonical_url: p.canonical_url, nofollow: p.nofollow, og_title: p.og_title, og_description: p.og_description,
              twitter_card: p.twitter_card, schema_type: p.schema_type, answer_summary: p.answer_summary, breadcrumb_title: p.breadcrumb_title,
              custom_jsonld: p.custom_jsonld, code_css: p.code_css, code_head: p.code_head, code_footer: p.code_footer,
            }}
          />
        </div>

        <aside className="pg-side">
          <div className="sc-card pg-stack">
            <div className="pg-card-h">
              <h2>Publish</h2>
              <span className={`sc-badge ${state === 'published' ? 'sc-badge-ok' : state === 'draft' ? 'sc-badge-warn' : state === 'trash' ? 'pg-badge-trash' : ''}`}>{state === 'trash' ? 'In trash' : state}</span>
            </div>

            <div className="sc-field">
              <label htmlFor="pg-status">Status</label>
              <select className="sc-select" id="pg-status" name="status" defaultValue={p.status === 'published' ? 'published' : 'draft'} disabled={trashed || !mayPublish}>
                <option value="draft">Draft (hidden)</option>
                <option value="published">Published</option>
              </select>
              {!mayPublish && !trashed && <span className="sc-help">You don’t have permission to publish pages.</span>}
            </div>

            <div className="sc-field">
              <label htmlFor="pg-when">Publish date</label>
              <input className="sc-input" id="pg-when" type="datetime-local" name="published_at_local" defaultValue={p.published_at ? stampToLocalInput(p.published_at) : ''} disabled={trashed || !mayPublish} style={{ maxWidth: 'none' }} />
              <span className="sc-help">
                Site time (Toronto). Leave empty to publish immediately. A date in the future schedules the page: it goes live by itself at that time.
                {state === 'scheduled' && p.published_at ? ` Currently scheduled for ${stamp(p.published_at)}.` : ''}
              </span>
            </div>

            <div className="sc-field">
              <label htmlFor="pg-layout">Layout</label>
              <select className="sc-select" id="pg-layout" name="layout" defaultValue={p.layout}>
                <option value="default">Default (header + footer)</option>
                <option value="canvas">Canvas (no header or footer)</option>
              </select>
            </div>

            <div className="sc-field">
              <label className="sc-check"><input type="checkbox" name="noindex" defaultChecked={!!p.noindex} /> Hide from search engines</label>
              <span className="sc-help">Adds “noindex” and leaves the page out of the sitemap.</span>
            </div>

            <div className="sc-form-actions" style={{ marginTop: 0 }}>
              <button className="sc-btn sc-btn-primary" type="submit">Save settings</button>
            </div>

            <dl className="sc-dl" style={{ gridTemplateColumns: '90px minmax(0,1fr)', fontSize: 12.5, gap: '4px 12px' }}>
              <dt>Author</dt><dd>{p.author || '—'}</dd>
              <dt>Created</dt><dd>{stamp(p.created_at)}</dd>
              <dt>Updated</dt><dd>{stamp(p.updated_at)}</dd>
            </dl>
          </div>

          {analysis && (
            <div className="sc-card pg-stack" id="seo-report">
              <div className="pg-card-h"><h2>SEO &amp; AI check</h2></div>
              <SeoReport result={analysis} />
              <p className="se-note" style={{ margin: 0 }}>Based on the last saved version. The page builder’s “SEO &amp; AI” tab shows the same checks live while you edit.</p>
            </div>
          )}
        </aside>
      </form>

      <div className="pg-below">
        <div className="sc-card">
          <div className="pg-card-h"><h2>Revisions</h2><span className="sc-faint">{revisions.length ? `latest ${revisions.length}` : ''}</span></div>
          {revisions.length === 0 ? (
            <p className="sc-muted" style={{ margin: 0 }}>No revisions yet. One is saved every time the page is saved in the builder.</p>
          ) : (
            <ul className="pg-revs">
              {revisions.map((r) => (
                <li key={r.id}>
                  <span>
                    {stamp(r.created_at)}
                    <small>{r.who || 'Unknown user'}{r.note ? ` · ${r.note}` : ''}</small>
                  </span>
                  {r.is_current ? (
                    <span className="sc-badge sc-badge-ok">Current</span>
                  ) : trashed ? null : (
                    <form action={restoreRevision} className="pg-inlineform">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="revision" value={r.id} />
                      <ConfirmButton className="sc-btn sc-btn-sm" message="Restore this version? What is live now is kept as a revision, so you can come back to it.">Restore</ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sc-card pg-danger-card">
          <div className="pg-card-h"><h2>Danger zone</h2></div>
          {isHome ? (
            <p>The home page can’t be moved to the Trash or deleted, and its path can’t change.</p>
          ) : trashed ? (
            <>
              <p>This page is in the Trash and is not visible on the site.</p>
              <div className="pg-btnrow">
                <form action={pagesAction} className="pg-inlineform">
                  <input type="hidden" name="back" value={`/admin/pages/${p.id}`} />
                  <input type="hidden" name="row" value={`restore:${p.id}`} />
                  <button className="sc-btn" type="submit">Restore as draft</button>
                </form>
                {can(user, 'delete_pages') && (
                  <form action={pagesAction} className="pg-inlineform">
                    <input type="hidden" name="back" value={`/admin/pages/${p.id}`} />
                    <input type="hidden" name="row" value={`delete:${p.id}`} />
                    <ConfirmButton className="sc-btn sc-btn-danger" message={`Permanently delete “${p.title}” and its revisions? This can’t be undone.`}>Delete permanently</ConfirmButton>
                  </form>
                )}
              </div>
            </>
          ) : can(user, 'delete_pages') ? (
            <>
              <p>Moving a page to the Trash takes it off the site. You can restore it later from the Trash tab.</p>
              <form action={pagesAction} className="pg-inlineform">
                <input type="hidden" name="back" value={`/admin/pages/${p.id}`} />
                <input type="hidden" name="row" value={`trash:${p.id}`} />
                <ConfirmButton className="sc-btn sc-btn-danger" message="Move this page to the Trash?">Move to Trash</ConfirmButton>
              </form>
            </>
          ) : (
            <p>You don’t have permission to delete pages.</p>
          )}
        </div>
      </div>
    </>
  );
}
