import type { Metadata } from 'next';
import Link from 'next/link';
import '@/app/admin/css/popups.css';
import { POPUP_PRESETS, POPUP_PRESET_ORDER } from '@/db/popup-presets.mjs';
import { createPopup, deletePopup, duplicatePopup, renamePopup, restorePopup, setPopupActive, trashPopup } from '@/app/admin/popups/actions';
import ConfirmButton from '@/components/admin/ConfirmButton';
import DbNotReady from '@/components/admin/DbNotReady';
import { requireCap } from '@/lib/auth';
import { stamp } from '@/lib/format';
import { listPopups, popupStatus, popupsReady, type PopupStatus } from '@/lib/popups';
import { rulesSummary, triggerSummary } from '@/lib/popups-shared';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Popups' };

type SP = { status?: string; q?: string; msg?: string; error?: string; new?: string };
const TABS: Array<[string, string]> = [['', 'All'], ['active', 'Active'], ['draft', 'Draft'], ['scheduled', 'Scheduled'], ['expired', 'Expired'], ['trash', 'Trash']];
const BADGE: Record<PopupStatus, string> = { active: 'sc-badge-ok', draft: '', scheduled: 'sc-badge-warn', expired: 'sc-badge-warn', trash: 'sc-badge-new' };

export default async function PopupsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireCap('manage_forms');
  const sp = await searchParams;
  const ready = popupsReady();
  const all = listPopups().map((p) => ({ p, status: popupStatus(p) }));
  const count = (s: string) => (s ? all.filter((x) => x.status === s).length : all.filter((x) => x.status !== 'trash').length);
  const tab = TABS.some(([k]) => k === (sp.status || '')) ? sp.status || '' : '';
  const q = (sp.q || '').trim().toLowerCase();
  const rows = all.filter((x) => (tab ? x.status === tab : x.status !== 'trash') && (!q || x.p.name.toLowerCase().includes(q) || x.p.settings.slug.includes(q)));
  const link = (s: string) => `/admin/popups${s ? `?status=${s}` : ''}`;

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Popups</h1>
          <p>Modals, slide-ins and bars that appear on your site — a newsletter signup, an announcement, a quote form. Build them in the page builder; they only go live when you press <strong>Activate</strong>.</p>
        </div>
      </div>

      {sp.msg && <div className="sc-flash sc-flash-ok" role="status">{sp.msg.slice(0, 400)}</div>}
      {sp.error && <div className="sc-flash sc-flash-err" role="alert">{sp.error.slice(0, 400)}</div>}
      {!ready && <DbNotReady what="Popups need" />}

      {ready && (
        <section className="sc-card" aria-labelledby="pu-new">
          <h2 id="pu-new">New popup</h2>
          <div className="pu-presets">
            {POPUP_PRESET_ORDER.map((id) => {
              const pr = (POPUP_PRESETS as Record<string, any>)[id];
              return (
                <form key={id} action={createPopup} className="pu-preset">
                  <input type="hidden" name="preset" value={id} />
                  <strong>{pr.label}</strong>
                  <span className="sc-muted">{pr.description}</span>
                  <button type="submit" className="sc-btn sc-btn-sm" data-preset={id}>Create &amp; edit</button>
                </form>
              );
            })}
          </div>
        </section>
      )}

      <nav className="sc-tabs" aria-label="Filter popups" style={{ marginTop: 18 }}>
        {TABS.map(([k, label]) => <Link key={k} href={link(k)} aria-current={tab === k ? 'true' : undefined}>{label} <span className="sc-faint">({count(k)})</span></Link>)}
        <form action="/admin/popups" method="get" className="pu-search" role="search">
          {tab ? <input type="hidden" name="status" value={tab} /> : null}
          <input className="sc-input" type="search" name="q" defaultValue={sp.q || ''} placeholder="Search popups" aria-label="Search popups" />
        </form>
      </nav>

      <div className="sc-tablewrap">
        {rows.length === 0 ? (
          <div className="sc-empty">{all.length === 0 ? 'No popups yet — pick a starting point above.' : 'No popups here.'}</div>
        ) : (
          <table className="sc-table pu-table">
            <thead><tr><th>Name</th><th>Status</th><th>Appears</th><th>Where</th><th>Updated</th><th /></tr></thead>
            <tbody>
              {rows.map(({ p, status }) => (
                <tr key={p.id} data-popup-id={p.id}>
                  <td>
                    <Link className="sc-rowlink" href={`/admin/builder/tpl-${p.id}`}>{p.name}</Link>
                    <div className="sc-faint" style={{ fontSize: 12 }}>link: <code>#popup:{p.settings.slug}</code></div>
                  </td>
                  <td>
                    <span className={`sc-badge ${BADGE[status]}`}>{status}</span>
                    {status === 'scheduled' && p.settings.start ? <div className="sc-faint" style={{ fontSize: 12 }}>from {p.settings.start} UTC</div> : null}
                    {status === 'expired' && p.settings.end ? <div className="sc-faint" style={{ fontSize: 12 }}>ended {p.settings.end} UTC</div> : null}
                  </td>
                  <td className="sc-muted" style={{ maxWidth: 260 }}>{triggerSummary(p.settings)}</td>
                  <td className="sc-muted" style={{ maxWidth: 220 }}>{rulesSummary(p.settings)}</td>
                  <td className="sc-muted" style={{ whiteSpace: 'nowrap' }}>{stamp(p.updated_at)}</td>
                  <td className="sc-num">
                    <span className="pu-actions">
                      {status !== 'trash' && <Link className="sc-btn sc-btn-sm" href={`/admin/builder/tpl-${p.id}`}>Edit</Link>}
                      {status !== 'trash' && <Link className="sc-btn sc-btn-sm" href={`/?popup-preview=${p.id}`} target="_blank" rel="noopener">Preview</Link>}
                      {status !== 'trash' && (
                        <form action={setPopupActive}>
                          <input type="hidden" name="id" value={p.id} /><input type="hidden" name="on" value={p.active ? '0' : '1'} />
                          <button type="submit" className={`sc-btn sc-btn-sm ${p.active ? '' : 'sc-btn-primary'}`}>{p.active ? 'Deactivate' : 'Activate'}</button>
                        </form>
                      )}
                      {status !== 'trash' && <form action={duplicatePopup}><input type="hidden" name="id" value={p.id} /><button type="submit" className="sc-btn sc-btn-sm">Duplicate</button></form>}
                      {status !== 'trash' && (
                        <form action={trashPopup}><input type="hidden" name="id" value={p.id} /><button type="submit" className="sc-btn sc-btn-sm sc-btn-danger">Trash</button></form>
                      )}
                      {status === 'trash' && <form action={restorePopup}><input type="hidden" name="id" value={p.id} /><button type="submit" className="sc-btn sc-btn-sm">Restore</button></form>}
                      {status === 'trash' && (
                        <form action={deletePopup}><input type="hidden" name="id" value={p.id} /><ConfirmButton className="sc-btn sc-btn-sm sc-btn-danger" message={`Delete “${p.name}” forever? This can't be undone.`}>Delete forever</ConfirmButton></form>
                      )}
                    </span>
                    <form action={renamePopup} className="pu-rename">
                      <input type="hidden" name="id" value={p.id} />
                      <input className="sc-input" name="name" defaultValue={p.name} maxLength={120} aria-label={`Rename ${p.name}`} />
                      <button type="submit" className="sc-btn sc-btn-sm">Rename</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
