import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import '../../css/pages.css';
import { activateTemplate, createTemplate, deleteTemplate, duplicateTemplate, renameTemplate } from '@/app/admin/templates/actions';
import ConfirmButton from '@/components/admin/ConfirmButton';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { requireUser } from '@/lib/auth';
import { all } from '@/lib/db';
import { stamp } from '@/lib/format';
import { can } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Templates' };

type Kind = 'header' | 'footer' | 'section' | 'page';
const TABS: { kind: Kind; label: string; one: string; cap: 'manage_site' | 'edit_pages'; blurb: string }[] = [
  { kind: 'header', label: 'Header', one: 'header', cap: 'manage_site', blurb: 'The site header shown on every page with the Default layout. Exactly one header is active at a time.' },
  { kind: 'footer', label: 'Footer', one: 'footer', cap: 'manage_site', blurb: 'The site footer shown on every page with the Default layout. Exactly one footer is active at a time.' },
  { kind: 'section', label: 'Saved sections', one: 'saved section', cap: 'edit_pages', blurb: 'Reusable sections. Save one from the builder, then insert it on any page; changes apply everywhere it is used.' },
  { kind: 'page', label: 'Page layouts', one: 'page layout', cap: 'edit_pages', blurb: 'Whole-page starting points. Choose one under Pages → Add new → “A saved page layout”.' },
];

type Row = { id: number; kind: Kind; name: string; active: number; updated_at: string; author: string | null };
type SP = FlashParams & { kind?: string; msg?: string };

export default async function TemplatesAdmin({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const allowed = TABS.filter((t) => can(user, t.cap));
  if (!allowed.length) redirect('/admin?error=forbidden');
  const tab = allowed.find((t) => t.kind === sp.kind) ?? allowed[0];
  const live = tab.kind === 'header' || tab.kind === 'footer';
  const build = can(user, 'use_builder');

  const counts = Object.fromEntries(all<{ kind: string; c: number }>('SELECT kind, COUNT(*) AS c FROM templates GROUP BY kind').map((r) => [r.kind, r.c]));
  const rows = all<Row>(
    `SELECT t.id, t.kind, t.name, t.active, t.updated_at, COALESCE(NULLIF(u.name, ''), u.email) AS author
       FROM templates t LEFT JOIN users u ON u.id = t.author_id WHERE t.kind = ? ORDER BY t.active DESC, t.name`,
    tab.kind
  );
  const hasActive = rows.some((r) => r.active);

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Templates</h1>
          <p>Header, footer, reusable sections and page layouts for the page builder.</p>
        </div>
      </div>

      {sp.msg && <div className="pg-notice" role="status">{sp.msg.slice(0, 300)}</div>}
      <Flash params={{ error: sp.error, warn: sp.warn }} />

      <nav className="sc-tabs" aria-label="Template type">
        {allowed.map((t) => (
          <Link key={t.kind} href={`/admin/templates?kind=${t.kind}`} aria-current={t.kind === tab.kind ? 'true' : undefined}>
            {t.label}<span className="pg-tabcount">{counts[t.kind] ?? 0}</span>
          </Link>
        ))}
      </nav>

      <p className="sc-muted" style={{ margin: '0 0 16px' }}>{tab.blurb}</p>
      {live && !hasActive && <div className="sc-flash sc-flash-warn">No {tab.one} is active, so the site currently shows none. Activate one below.</div>}

      <details className="sc-card pg-add" style={{ marginBottom: 18 }} open={rows.length === 0}>
        <summary><span className="sc-btn sc-btn-primary">Add new {tab.one}</span></summary>
        <form action={createTemplate} className="pg-addform">
          <input type="hidden" name="kind" value={tab.kind} />
          <div className="sc-field">
            <label htmlFor="tpl-name">Name <span className="sc-req">*</span></label>
            <input className="sc-input" id="tpl-name" name="name" required maxLength={120} placeholder={live ? `${tab.label} — ${new Date().getFullYear()}` : 'Call-to-action band'} />
          </div>
          {live ? (
            <div className="sc-field">
              <label htmlFor="tpl-start">Start from</label>
              <select className="sc-select" id="tpl-start" name="start" defaultValue={hasActive ? 'active' : 'blank'}>
                <option value="blank">A blank {tab.one}</option>
                {hasActive && <option value="active">A copy of the active {tab.one}</option>}
              </select>
            </div>
          ) : <div />}
          <div className="sc-field">
            <span className="sc-help">{build ? 'Opens in the builder when created.' : 'Created empty; open it in the builder to design it.'}</span>
          </div>
          <button className="sc-btn sc-btn-primary" type="submit">Create</button>
        </form>
      </details>

      <div className="sc-tablewrap">
        {rows.length === 0 ? (
          <div className="sc-empty">No {tab.one}s yet.</div>
        ) : (
          <table className="sc-table pg-table">
            <thead>
              <tr><th>Name</th>{live && <th>Status</th>}<th>Author</th><th>Last updated</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="pg-title">
                      {build ? <Link href={`/admin/builder/tpl-${r.id}`} prefetch={false}>{r.name}</Link> : r.name}
                    </div>
                    <div className="pg-rowacts">
                      {build && <Link href={`/admin/builder/tpl-${r.id}`} prefetch={false}>Edit in builder</Link>}
                      <details className="pg-rename">
                        <summary>Rename</summary>
                        <form action={renameTemplate}>
                          <input type="hidden" name="id" value={r.id} />
                          <input className="sc-input" name="name" defaultValue={r.name} required maxLength={120} aria-label="New name" />
                          <button className="sc-btn sc-btn-sm" type="submit">Save</button>
                        </form>
                      </details>
                      <form action={duplicateTemplate} className="pg-inlineform">
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit">Duplicate</button>
                      </form>
                      {r.active ? (
                        <span className="sc-faint" title="Activate another one first">Delete</span>
                      ) : (
                        <form action={deleteTemplate} className="pg-inlineform">
                          <input type="hidden" name="id" value={r.id} />
                          <ConfirmButton className="pg-danger" message={`Delete “${r.name}”? This can’t be undone.`}>Delete</ConfirmButton>
                        </form>
                      )}
                    </div>
                  </td>
                  {live && (
                    <td>
                      {r.active ? (
                        <span className="sc-badge pg-active">Active</span>
                      ) : (
                        <form action={activateTemplate} className="pg-inlineform">
                          <input type="hidden" name="id" value={r.id} />
                          <button className="sc-btn sc-btn-sm" type="submit">Activate</button>
                        </form>
                      )}
                    </td>
                  )}
                  <td className="sc-muted">{r.author || '—'}</td>
                  <td className="sc-muted">{stamp(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
