import type { Metadata } from 'next';
import Link from 'next/link';
import Flash from '@/components/admin/Flash';
import { requireCap } from '@/lib/auth';
import { all, get } from '@/lib/db';
import { stamp } from '@/lib/format';
import { hasColumn } from '@/lib/schema-ready';
import { FORM_TYPES, customTypeList, isKnownType, typeLabel } from '@/lib/submissions';
import { markAllRead } from '../../actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Submissions' };

const PAGE_SIZE = 30;
const STATUSES = ['new', 'read', 'archived'];

type Props = { searchParams: Promise<{ status?: string; type?: string; page?: string; saved?: string; error?: string; warn?: string }> };

export default async function Submissions({ searchParams }: Props) {
  await requireCap('view_submissions');
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? '') ? sp.status! : '';
  const type = isKnownType(sp.type ?? '') ? sp.type! : '';
  const customs = customTypeList();
  const labels = Object.fromEntries(customs.map((c) => [c.type, c.label]));
  const page = Math.max(1, Math.trunc(Number(sp.page)) || 1);

  const where: string[] = [];
  const args: string[] = [];
  if (status) { where.push('status = ?'); args.push(status); }
  if (type) { where.push('type = ?'); args.push(type); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const total = get<{ c: number }>(`SELECT COUNT(*) AS c FROM submissions ${clause}`, ...args)?.c ?? 0;
  const rows = all<any>(
    `SELECT id, type, name, email, phone, company, message, status, attachments, created_at${hasColumn('submissions', 'source_url') && hasColumn('submissions', 'source_label') ? ', source_url, source_label' : ''} FROM submissions ${clause} ORDER BY id DESC LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}`,
    ...args
  );
  const counts = Object.fromEntries(all<{ status: string; c: number }>('SELECT status, COUNT(*) AS c FROM submissions GROUP BY status').map((r) => [r.status, r.c]));
  const all_ = Object.values(counts).reduce((a: number, b) => a + (b as number), 0);

  const link = (over: Record<string, string>) => {
    const q = new URLSearchParams({ ...(status && { status }), ...(type && { type }), ...over });
    for (const [k, v] of [...q]) if (!v) q.delete(k);
    return `/admin/submissions${q.size ? `?${q}` : ''}`;
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportQs = new URLSearchParams({ ...(status && { status }), ...(type && { type }) }).toString();

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Submissions</h1>
          <p>Contact, quote, calculator, newsletter and custom-form entries from the website.</p>
        </div>
        <div className="sc-actions">
          <a className="sc-btn" href={`/admin/submissions/export${exportQs ? `?${exportQs}` : ''}`}>Export CSV</a>
          {(counts.new ?? 0) > 0 && (<form action={markAllRead}><button className="sc-btn" type="submit">Mark all read</button></form>)}
        </div>
      </div>

      <Flash params={sp} />

      <div className="sc-tabs" role="navigation" aria-label="Filter by status">
        <Link href={link({ status: '', page: '' })} aria-current={!status}>All ({all_})</Link>
        {STATUSES.map((s) => (<Link key={s} href={link({ status: s, page: '' })} aria-current={status === s}>{s[0].toUpperCase() + s.slice(1)} ({counts[s] ?? 0})</Link>))}
      </div>
      <div className="sc-tabs" role="navigation" aria-label="Filter by form">
        <Link href={link({ type: '', page: '' })} aria-current={!type}>Every form</Link>
        {FORM_TYPES.map((t) => (<Link key={t} href={link({ type: t, page: '' })} aria-current={type === t}>{t[0].toUpperCase() + t.slice(1)}</Link>))}
        {customs.map((c) => (<Link key={c.type} href={link({ type: c.type, page: '' })} aria-current={type === c.type}>{c.label}</Link>))}
      </div>

      <div className="sc-tablewrap">
        {rows.length === 0 ? (
          <div className="sc-empty">No submissions {status || type ? 'match these filters' : 'yet'}.</div>
        ) : (
          <table className="sc-table">
            <thead><tr><th>Received</th><th>Form</th><th>From</th><th>Contact</th><th>Message</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((s) => {
                const files = JSON.parse(s.attachments || '[]').length;
                return (
                  <tr key={s.id}>
                    <td className="sc-muted" style={{ whiteSpace: 'nowrap' }}>{stamp(s.created_at)}</td>
                    <td><span className="sc-badge">{typeLabel(s.type, labels)}</span>{(s.source_label || s.source_url) && <div className="sc-muted" style={{ fontSize: 12, marginTop: 4 }} title="Where the visitor was">{s.source_label || s.source_url}</div>}</td>
                    <td><Link className="sc-rowlink" href={`/admin/submissions/${s.id}`}>{s.name || s.email || `#${s.id}`}</Link>{s.company && <div className="sc-muted">{s.company}</div>}</td>
                    <td>{s.email}{s.phone && <div className="sc-muted">{s.phone}</div>}</td>
                    <td className="sc-muted" style={{ maxWidth: 280 }}>{s.message.slice(0, 90)}{s.message.length > 90 ? '…' : ''}{files > 0 && <div>{files} attachment{files > 1 ? 's' : ''}</div>}</td>
                    <td><span className={`sc-badge ${s.status === 'new' ? 'sc-badge-new' : ''}`}>{s.status}</span></td>
                  </tr>
                );
              })}
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
