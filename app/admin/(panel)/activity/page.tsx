import type { Metadata } from 'next';
import Link from 'next/link';
import { requireCap } from '@/lib/auth';
import { all, get } from '@/lib/db';
import { stamp } from '@/lib/format';
import '../../css/activity.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Activity log' };

const PAGE_SIZE = 50;
type Row = { id: number; user_label: string; action: string; entity: string; entity_id: string; summary: string; created_at: string };
type Props = { searchParams: Promise<{ user?: string; entity?: string; action?: string; from?: string; to?: string; page?: string }> };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const distinct = (col: 'user_label' | 'entity' | 'action') =>
  all<{ v: string }>(`SELECT DISTINCT ${col} AS v FROM activity WHERE ${col} != '' ORDER BY ${col} COLLATE NOCASE LIMIT 200`).map((r) => r.v);

export default async function ActivityPage({ searchParams }: Props) {
  await requireCap('manage_site');
  const sp = await searchParams;
  const user = String(sp.user ?? '').slice(0, 200);
  const entity = String(sp.entity ?? '').slice(0, 60);
  const action = String(sp.action ?? '').slice(0, 60);
  const from = DATE.test(sp.from ?? '') ? sp.from! : '';
  const to = DATE.test(sp.to ?? '') ? sp.to! : '';
  const page = Math.max(1, Math.trunc(Number(sp.page)) || 1);

  const where: string[] = [];
  const args: string[] = [];
  if (user) { where.push('user_label = ?'); args.push(user); }
  if (entity) { where.push('entity = ?'); args.push(entity); }
  if (action) { where.push('action = ?'); args.push(action); }
  // created_at is stored in UTC as "YYYY-MM-DD HH:MM:SS"
  if (from) { where.push('created_at >= ?'); args.push(`${from} 00:00:00`); }
  if (to) { where.push('created_at <= ?'); args.push(`${to} 23:59:59`); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM activity ${clause}`, ...args)?.c ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const cur = Math.min(page, pages);
  const rows = all<Row>(`SELECT * FROM activity ${clause} ORDER BY id DESC LIMIT ${PAGE_SIZE} OFFSET ${(cur - 1) * PAGE_SIZE}`, ...args);

  const link = (over: Record<string, string>) => {
    const q = new URLSearchParams({ ...(user && { user }), ...(entity && { entity }), ...(action && { action }), ...(from && { from }), ...(to && { to }), ...over });
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    return `/admin/activity${q.size ? `?${q}` : ''}`;
  };
  const filtered = !!(user || entity || action || from || to);

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Activity log</h1>
          <p>{total.toLocaleString('en-CA')} {total === 1 ? 'entry' : 'entries'}{filtered ? ' match these filters' : ''} — who changed what, newest first.</p>
        </div>
      </div>

      <form method="get" className="sc-card sc-activity-filters">
        <div className="sc-field">
          <label htmlFor="f-user">User</label>
          <select className="sc-select" id="f-user" name="user" defaultValue={user}>
            <option value="">Everyone</option>
            {distinct('user_label').map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
        </div>
        <div className="sc-field">
          <label htmlFor="f-entity">Entity</label>
          <select className="sc-select" id="f-entity" name="entity" defaultValue={entity}>
            <option value="">Anything</option>
            {distinct('entity').map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
        </div>
        <div className="sc-field">
          <label htmlFor="f-action">Action</label>
          <select className="sc-select" id="f-action" name="action" defaultValue={action}>
            <option value="">Any action</option>
            {distinct('action').map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
        </div>
        <div className="sc-field">
          <label htmlFor="f-from">From</label>
          <input className="sc-input" id="f-from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="sc-field">
          <label htmlFor="f-to">To</label>
          <input className="sc-input" id="f-to" name="to" type="date" defaultValue={to} />
        </div>
        <div className="sc-activity-buttons">
          <button className="sc-btn sc-btn-primary" type="submit">Filter</button>
          {filtered && <Link className="sc-btn" href="/admin/activity">Clear</Link>}
        </div>
      </form>

      <div className="sc-tablewrap">
        {rows.length === 0 ? (
          <div className="sc-empty">{filtered ? 'No activity matches these filters.' : 'Nothing has been logged yet. Changes made in the CMS will appear here.'}</div>
        ) : (
          <table className="sc-table">
            <thead><tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Summary</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="sc-muted" style={{ whiteSpace: 'nowrap' }}>{stamp(r.created_at)}</td>
                  <td>{r.user_label || <span className="sc-muted">system</span>}</td>
                  <td><span className="sc-badge">{r.action}</span></td>
                  <td>{r.entity || <span className="sc-muted">—</span>}{r.entity_id && <span className="sc-muted"> #{r.entity_id}</span>}</td>
                  <td className="sc-activity-summary">{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <div className="sc-pager">
          {cur > 1 && <Link className="sc-btn sc-btn-sm" href={link({ page: String(cur - 1) })}>← Newer</Link>}
          <span>Page {cur} of {pages}</span>
          {cur < pages && <Link className="sc-btn sc-btn-sm" href={link({ page: String(cur + 1) })}>Older →</Link>}
        </div>
      )}
    </>
  );
}
