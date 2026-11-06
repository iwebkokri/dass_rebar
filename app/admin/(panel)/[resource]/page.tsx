import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { RESOURCES, type Resource } from '@/lib/admin/resources';
import { requireCap } from '@/lib/auth';
import { parseImages } from '@/lib/content';
import { all } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ resource: string }>; searchParams: Promise<FlashParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = RESOURCES[(await params).resource];
  return { title: r?.label ?? 'Not found' };
}

function Cell({ col, row }: { col: Resource['columns'][number]; row: any }) {
  const v = row[col.key];
  switch (col.kind) {
    case 'thumb': {
      const src = col.key === 'images' ? parseImages(String(v))[0] : String(v || '');
      return src ? <img className="sc-thumb" src={src} alt="" /> : <span className="sc-thumb" />;
    }
    case 'bool':
      return <span className={v ? 'sc-strong' : 'sc-muted'}>{v ? '✓' : '—'}</span>;
    case 'badge':
      return <span className={`sc-badge ${v === 'published' ? 'sc-badge-ok' : v === 'draft' ? 'sc-badge-warn' : ''}`}>{v === 'stocked' ? 'we stock' : v === 'also' ? 'also supplied' : String(v)}</span>;
    default:
      return <>{String(v ?? '') || <span className="sc-muted">—</span>}</>;
  }
}

export default async function ResourceList({ params, searchParams }: Props) {
  const key = (await params).resource;
  await requireCap(key === 'insights' ? 'edit_others_posts' : 'manage_content');
  const r = RESOURCES[key];
  if (!r) notFound();
  const rows = all<any>(`SELECT * FROM ${r.table} ORDER BY ${r.orderBy}`);
  const titleKey = r.columns.find((c) => !c.kind || c.kind === 'text')?.key ?? 'id';

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>{r.label}</h1>
          <p>{rows.length} {rows.length === 1 ? r.singular : `${r.singular}s`}</p>
        </div>
        <div className="sc-actions">
          <Link className="sc-btn" href={r.publicPath} target="_blank" rel="noopener">View on site ↗</Link>
          <Link className="sc-btn sc-btn-primary" href={`/admin/${r.key}/new`}>New {r.singular}</Link>
        </div>
      </div>

      <Flash params={await searchParams} />

      <div className="sc-tablewrap">
        {rows.length === 0 ? (
          <div className="sc-empty">No {r.label.toLowerCase()} yet. <Link className="sc-rowlink" href={`/admin/${r.key}/new`}>Add the first one</Link>.</div>
        ) : (
          <table className="sc-table">
            <thead><tr>{r.columns.map((c) => (<th key={c.key}>{c.label}</th>))}<th /></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {r.columns.map((c) => (
                    <td key={c.key}>
                      {c.key === titleKey ? <Link className="sc-rowlink" href={`/admin/${r.key}/${row.id}`}>{String(row[c.key]) || '(untitled)'}</Link> : <Cell col={c} row={row} />}
                    </td>
                  ))}
                  <td className="sc-num"><Link className="sc-btn sc-btn-sm" href={`/admin/${r.key}/${row.id}`}>Edit</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
