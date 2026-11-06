import type { Metadata } from 'next';
import Link from 'next/link';
import '@/app/admin/css/media.css';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import MediaLibrary from '@/components/admin/MediaLibrary';
import { requireCap } from '@/lib/auth';
import { listFolders, listMedia, listMonths } from '@/lib/media';
import { can } from '@/lib/roles';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Media library' };

type SP = FlashParams & { kind?: string; q?: string; folder?: string; date?: string; view?: string; page?: string };

const KIND_TABS: Array<[value: string, label: string]> = [['', 'All'], ['image', 'Images'], ['video', 'Videos'], ['file,audio', 'Documents']];
const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default async function MediaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireCap('upload_media');
  const sp = await searchParams;
  const view = sp.view === 'list' ? 'list' : 'grid';
  const kind = KIND_TABS.some(([v]) => v === (sp.kind ?? '')) ? sp.kind ?? '' : '';
  const data = listMedia(user, { kind, q: sp.q, folder: sp.folder, date: sp.date, page: Number(sp.page) || 1, per: 40 });
  const months = listMonths(user);
  const folders = listFolders(user);

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged: Record<string, string | undefined> = { kind, q: sp.q, folder: sp.folder, date: sp.date, view: view === 'list' ? 'list' : '', ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  const filtered = !!(kind || sp.q || sp.folder || sp.date);

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Media library</h1>
          <p>
            {data.total} file{data.total === 1 ? '' : 's'}
            {filtered ? ' match the filters' : ''}
            {can(user, 'edit_others_media') ? '' : ' (your uploads)'}
          </p>
        </div>
      </div>

      <Flash params={sp} />

      <div className="ml">
        <div className="sc-tabs" style={{ marginBottom: 0 }}>
          {KIND_TABS.map(([v, label]) => (
            <Link key={v} href={`/admin/media${qs({ kind: v, page: '' })}`} aria-current={kind === v}>{label}</Link>
          ))}
        </div>
        <form className="ml-filters" method="get" action="/admin/media">
          {kind && <input type="hidden" name="kind" value={kind} />}
          {view === 'list' && <input type="hidden" name="view" value="list" />}
          <input className="mp-input" type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Search by name, title, alt text…" aria-label="Search media" />
          <select className="mp-input" name="date" defaultValue={sp.date ?? ''} aria-label="Date">
            <option value="">All dates</option>
            {months.map((m) => (<option key={m} value={m}>{monthLabel(m)}</option>))}
          </select>
          <select className="mp-input" name="folder" defaultValue={sp.folder ?? ''} aria-label="Folder">
            <option value="">All folders</option>
            {folders.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>
          <button className="mp-btn" type="submit">Filter</button>
          {filtered && <Link className="mp-btn" href={`/admin/media${view === 'list' ? '?view=list' : ''}`}>Reset</Link>}
          <span className="ml-view" role="group" aria-label="View">
            <Link href={`/admin/media${qs({ view: '' })}`} aria-current={view === 'grid'}>Grid</Link>
            <Link href={`/admin/media${qs({ view: 'list' })}`} aria-current={view === 'list'}>List</Link>
          </span>
        </form>
      </div>

      <div style={{ marginTop: 16 }}>
        <MediaLibrary key={`${kind}|${sp.q}|${sp.folder}|${sp.date}|${data.page}|${view}`} items={data.items} view={view} folders={folders} initialFolder={sp.folder ?? ''} />
        {data.items.length === 0 && <div className="sc-empty">{filtered ? 'No files match those filters.' : 'No media yet — drop some files above.'}</div>}
      </div>

      {data.pages > 1 && (
        <div className="sc-pager">
          {data.page > 1 && <Link className="sc-btn sc-btn-sm" href={`/admin/media${qs({ page: String(data.page - 1) })}`}>← Newer</Link>}
          <span>Page {data.page} of {data.pages}</span>
          {data.page < data.pages && <Link className="sc-btn sc-btn-sm" href={`/admin/media${qs({ page: String(data.page + 1) })}`}>Older →</Link>}
        </div>
      )}
    </>
  );
}
