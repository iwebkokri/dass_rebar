import type { Metadata } from 'next';
import Link from 'next/link';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { RedirectsBulkBar, RedirectsButton, RedirectsSelectAll } from '@/components/admin/RedirectsBulk';
import { RedirectsForm } from '@/components/admin/RedirectsForm';
import { RedirectsImport } from '@/components/admin/RedirectsImport';
import { requireCap } from '@/lib/auth';
import { stamp } from '@/lib/format';
import { getRedirect, listRedirects } from '@/lib/redirects';
import { bulkRedirects } from '../../redirects/actions';
import '../../css/redirects.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Redirects' };

type Props = { searchParams: Promise<FlashParams & { q?: string; page?: string; edit?: string }> };

export default async function RedirectsPage({ searchParams }: Props) {
  await requireCap('manage_site');
  const sp = await searchParams;
  const q = String(sp.q ?? '').slice(0, 100);
  const { rows, total, pages, page } = listRedirects({ q, page: Number(sp.page) });
  const editing = /^\d+$/.test(sp.edit ?? '') ? getRedirect(Number(sp.edit)) : undefined;

  const link = (over: Record<string, string>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...over });
    for (const [k, v] of [...p]) if (!v) p.delete(k);
    return `/admin/redirects${p.size ? `?${p}` : ''}`;
  };

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Redirects</h1>
          <p>Send visitors from an old address to a new one. {total} {total === 1 ? 'redirect' : 'redirects'}{q ? ` match “${q}”` : ''}.</p>
        </div>
      </div>

      <Flash params={sp} />

      <div className="sc-stack">
        <RedirectsForm
          key={editing?.id ?? 'new'}
          initial={editing ? { id: editing.id, from: editing.from_path, to: editing.to_url, code: editing.code, enabled: !!editing.enabled } : undefined}
        />

        <div>
          <form method="get" className="sc-redir-search">
            <input className="sc-input" type="search" name="q" defaultValue={q} placeholder="Search old or new addresses…" aria-label="Search redirects" maxLength={100} />
            <button className="sc-btn" type="submit">Search</button>
            {q && <Link className="sc-btn" href="/admin/redirects">Clear</Link>}
          </form>

          <form action={bulkRedirects}>
            <div className="sc-tablewrap">
              {rows.length === 0 ? (
                <div className="sc-empty">{q ? 'No redirects match your search.' : 'No redirects yet. Add one above, or import a CSV below.'}</div>
              ) : (
                <table className="sc-table">
                  <thead>
                    <tr><th style={{ width: 34 }}><RedirectsSelectAll /></th><th>From</th><th>To</th><th>Type</th><th className="sc-num">Hits</th><th>Status</th><th>Added</th><th /></tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td><input type="checkbox" name="ids" value={r.id} aria-label={`Select ${r.from_path}`} /></td>
                        <td className="sc-strong sc-redir-from">{r.from_path}</td>
                        <td className="sc-redir-to">{r.to_url}</td>
                        <td>{r.code}</td>
                        <td className="sc-num">{r.hits.toLocaleString('en-CA')}</td>
                        <td>{r.enabled ? <span className="sc-badge sc-badge-ok">enabled</span> : <span className="sc-badge">disabled</span>}</td>
                        <td className="sc-muted" style={{ whiteSpace: 'nowrap' }}>{stamp(r.created_at)}</td>
                        <td className="sc-num" style={{ whiteSpace: 'nowrap' }}>
                          <Link className="sc-btn sc-btn-sm" href={`${link({ edit: String(r.id) })}#redirect-form`}>Edit</Link>{' '}
                          <RedirectsButton name="row_delete" value={String(r.id)} className="sc-btn sc-btn-sm sc-btn-danger" message={`Delete the redirect from ${r.from_path}?`}>Delete</RedirectsButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {rows.length > 0 && <RedirectsBulkBar />}
          </form>

          {pages > 1 && (
            <div className="sc-pager">
              {page > 1 && <Link className="sc-btn sc-btn-sm" href={link({ page: String(page - 1) })}>← Newer</Link>}
              <span>Page {page} of {pages}</span>
              {page < pages && <Link className="sc-btn sc-btn-sm" href={link({ page: String(page + 1) })}>Older →</Link>}
            </div>
          )}
        </div>

        <RedirectsImport />
      </div>
    </>
  );
}
