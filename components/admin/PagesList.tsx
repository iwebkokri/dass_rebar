'use client';

// The pages table: select rows, bulk actions, per-row actions (all submit to the pagesAction server action).
import Link from 'next/link';
import { useState } from 'react';
import { pagesAction } from '@/app/admin/pages/actions';
import { band } from '@/lib/builder/seo-analysis.mjs';

export type PagesListRow = {
  id: number;
  title: string;
  path: string;
  displayPath: string;
  isHome: boolean;
  state: 'published' | 'draft' | 'scheduled' | 'trash';
  stateNote: string; // "Last modified …" / "Scheduled for …"
  layout: string;
  noindex: boolean;
  author: string;
  updated: string;
  viewHref: string;
  /** SEO / AI-readiness scores 0–100 (null for trashed pages) */
  seo: number | null;
  ai: number | null;
};

type Props = {
  rows: PagesListRow[];
  tab: string;
  back: string; // where to return after an action (keeps the tab / search / page)
  canBuild: boolean;
  canPublish: boolean;
  canDelete: boolean;
};

const BADGE: Record<PagesListRow['state'], string> = { published: 'sc-badge sc-badge-ok', draft: 'sc-badge sc-badge-warn', scheduled: 'sc-badge', trash: 'sc-badge pg-badge-trash' };
const LABEL: Record<PagesListRow['state'], string> = { published: 'Published', draft: 'Draft', scheduled: 'Scheduled', trash: 'In trash' };

export default function PagesList({ rows, tab, back, canBuild, canPublish, canDelete }: Props) {
  const [sel, setSel] = useState<number[]>([]);
  const [op, setOp] = useState('');
  const allOn = rows.length > 0 && sel.length === rows.length;
  const toggle = (id: number) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const ops: [string, string][] =
    tab === 'trash'
      ? [['restore', 'Restore'], ...(canDelete ? ([['delete', 'Delete permanently']] as [string, string][]) : [])]
      : [...(canDelete ? ([['trash', 'Move to Trash']] as [string, string][]) : []), ...(canPublish ? ([['publish', 'Publish'], ['draft', 'Set to draft']] as [string, string][]) : [])];

  const confirmDelete = (e: React.MouseEvent, msg: string) => {
    if (!window.confirm(msg)) e.preventDefault();
  };

  return (
    <form action={pagesAction}>
      <input type="hidden" name="back" value={back} />
      {ops.length > 0 && (
        <div className="pg-bulk">
          <select className="sc-select" name="op" value={op} onChange={(e) => setOp(e.target.value)} aria-label="Bulk action">
            <option value="">Bulk actions</option>
            {ops.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
          </select>
          <button
            className="sc-btn sc-btn-sm"
            type="submit"
            disabled={!op || sel.length === 0}
            onClick={(e) => op === 'delete' && confirmDelete(e, `Permanently delete ${sel.length} page${sel.length === 1 ? '' : 's'}? This can’t be undone.`)}
          >
            Apply
          </button>
          <span className="pg-selcount">{sel.length ? `${sel.length} selected` : ''}</span>
        </div>
      )}

      <div className="sc-tablewrap">
        <table className="sc-table pg-table">
          <thead>
            <tr>
              <th className="pg-check">
                <input type="checkbox" aria-label="Select all" checked={allOn} onChange={() => setSel(allOn ? [] : rows.map((r) => r.id))} />
              </th>
              <th>Title</th>
              <th>Path</th>
              <th>Status</th>
              <th title="Search-engine score">SEO</th>
              <th title="AI-readiness score (GEO / AEO / AIO)">AI</th>
              <th>Layout</th>
              <th>Author</th>
              <th>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const main = canBuild && r.state !== 'trash' ? `/admin/builder/page-${r.id}` : `/admin/pages/${r.id}`;
              return (
                <tr key={r.id}>
                  <td className="pg-check">
                    <input type="checkbox" name="ids" value={r.id} checked={sel.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.title}`} />
                  </td>
                  <td>
                    <div className="pg-title">
                      <Link href={main} prefetch={false}>{r.title || '(untitled)'}</Link>
                      {r.isHome && <span className="pg-home">Home</span>}
                    </div>
                    <div className="pg-rowacts">
                      {r.state !== 'trash' && canBuild && <Link href={`/admin/builder/page-${r.id}`} prefetch={false}>Edit with builder</Link>}
                      <Link href={`/admin/pages/${r.id}`}>Settings</Link>
                      <Link href={r.viewHref} target="_blank" rel="noopener" prefetch={false}>{r.state === 'published' ? 'View' : 'Preview'}</Link>
                      {r.state !== 'trash' && <button type="submit" name="row" value={`duplicate:${r.id}`}>Duplicate</button>}
                      {r.state !== 'trash' && canDelete && !r.isHome && <button type="submit" name="row" value={`trash:${r.id}`} className="pg-danger">Trash</button>}
                      {r.state === 'trash' && <button type="submit" name="row" value={`restore:${r.id}`}>Restore</button>}
                      {r.state === 'trash' && canDelete && !r.isHome && (
                        <button type="submit" name="row" value={`delete:${r.id}`} className="pg-danger" onClick={(e) => confirmDelete(e, `Permanently delete “${r.title}”? This can’t be undone.`)}>
                          Delete permanently
                        </button>
                      )}
                    </div>
                  </td>
                  <td><span className="pg-path">{r.displayPath}</span></td>
                  <td>
                    <span className={BADGE[r.state]}>{LABEL[r.state]}</span>
                    {r.noindex && <span className="pg-sub">noindex</span>}
                    {r.state === 'scheduled' && <span className="pg-sub">{r.stateNote}</span>}
                  </td>
                  <td>{r.seo === null ? <span className="sc-faint">—</span> : <span className="se-score-cell" data-band={band(r.seo)} aria-label={`SEO score ${r.seo} out of 100`}>{r.seo}</span>}</td>
                  <td>{r.ai === null ? <span className="sc-faint">—</span> : <span className="se-score-cell" data-band={band(r.ai)} aria-label={`AI-readiness score ${r.ai} out of 100`}>{r.ai}</span>}</td>
                  <td className="sc-muted">{r.layout === 'canvas' ? 'Canvas' : 'Default'}</td>
                  <td className="sc-muted">{r.author || '—'}</td>
                  <td className="sc-muted">{r.updated}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </form>
  );
}
