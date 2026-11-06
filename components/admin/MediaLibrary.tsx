'use client';

// The /admin/media screen body: upload drop area, bulk selection (delete / move), grid or list, and the details modal.
import '@/app/admin/css/media.css';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { deleteMediaAction, mediaUsageAction, moveMediaAction } from '@/app/admin/media/actions';
import MediaDetails from './MediaDetails';
import { uploadMedia } from './MediaClient';
import MediaThumb from './MediaThumb';
import { acceptFor, fmtBytes, limitsText, precheckFile, type MediaItem } from '@/lib/media-types';

type Job = { key: string; name: string; pct: number; state: 'wait' | 'up' | 'done' | 'err'; error?: string };

export default function MediaLibrary({ items, view, folders, initialFolder }: { items: MediaItem[]; view: 'grid' | 'list'; folders: string[]; initialFolder: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [openId, setOpenId] = useState<number | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [over, setOver] = useState(false);
  const [upFolder, setUpFolder] = useState(initialFolder);
  const [moveTo, setMoveTo] = useState('');
  const [status, setStatus] = useState<{ text: string; err?: boolean } | null>(null);
  const [bust, setBust] = useState<Record<number, number>>({});
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const files = useRef(new Map<string, File>());

  const openIdx = openId === null ? -1 : items.findIndex((i) => i.id === openId);
  const open = openIdx >= 0 ? items[openIdx] : null;
  const picked = items.filter((i) => selected.has(i.id));
  const allOn = items.length > 0 && items.every((i) => selected.has(i.id));

  const toggle = (id: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // ---- upload ----
  async function startUploads(list: File[]) {
    if (!list.length) return;
    const fresh: Job[] = list.map((f) => {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      files.current.set(key, f);
      return { key, name: f.name, pct: 0, state: 'wait' };
    });
    setJobs((prev) => [...fresh, ...prev]);
    const patch = (key: string, p: Partial<Job>) => setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...p } : j)));
    const queue = fresh.slice();
    let okCount = 0;
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const file = files.current.get(job.key)!;
        const bad = precheckFile(file, 'any');
        if (bad) {
          patch(job.key, { state: 'err', error: bad });
          continue;
        }
        patch(job.key, { state: 'up' });
        try {
          await uploadMedia(file, { folder: upFolder.trim() || undefined, onProgress: (pct) => patch(job.key, { pct }) });
          patch(job.key, { state: 'done', pct: 100 });
          okCount++;
        } catch (e) {
          patch(job.key, { state: 'err', error: e instanceof Error ? e.message : 'Upload failed.' });
        }
        files.current.delete(job.key);
      }
    };
    await Promise.all([worker(), worker()]);
    if (okCount) {
      setStatus({ text: `${okCount} file${okCount === 1 ? '' : 's'} uploaded.` });
      router.refresh();
    }
  }

  // ---- bulk ----
  function bulkDelete() {
    const ids = picked.filter((m) => m.deletable).map((m) => m.id);
    if (!ids.length) {
      setStatus({ text: 'None of the selected files can be deleted by you.', err: true });
      return;
    }
    start(async () => {
      const usage = (await mediaUsageAction(ids)).filter((u) => u.usage.length);
      const places = usage.reduce((n, u) => n + u.usage.length, 0);
      const msg =
        `Delete ${ids.length} file${ids.length === 1 ? '' : 's'} permanently?` +
        (usage.length ? `\n\n${usage.length} of them ${usage.length === 1 ? 'is' : 'are'} used in ${places} place${places === 1 ? '' : 's'} on the site (e.g. “${usage[0].name}” in ${usage[0].usage[0].type}: ${usage[0].usage[0].label}). Deleting leaves broken images there.` : '\n\nThis can\'t be undone.');
      if (!window.confirm(msg)) return;
      const r = await deleteMediaAction(ids);
      setStatus({ text: r.message, err: !r.deleted });
      setSelected(new Set());
      router.refresh();
    });
  }

  function bulkMove() {
    const ids = picked.map((m) => m.id);
    start(async () => {
      const r = await moveMediaAction(ids, moveTo);
      setStatus({ text: r.message, err: !r.ok });
      if (r.ok) {
        setSelected(new Set());
        router.refresh();
      }
    });
  }

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

  return (
    <div className="ml">
      <div
        className={`ml-drop${over ? ' is-over' : ''}`}
        onDragOver={(e) => {
          if (hasFiles(e)) {
            e.preventDefault();
            setOver(true);
          }
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          setOver(false);
          void startUploads(Array.from(e.dataTransfer.files));
        }}
      >
        <strong>Drop files here to upload</strong>
        <span>or</span>
        <button type="button" className="mp-btn" onClick={() => fileRef.current?.click()}>Select files</button>
        <input ref={fileRef} type="file" multiple hidden accept={acceptFor('any')} onChange={(e) => { const l = Array.from(e.target.files ?? []); e.target.value = ''; void startUploads(l); }} />
        <input className="mp-input" list="ml-up-folders" placeholder="Folder (optional)" aria-label="Folder for new uploads" value={upFolder} maxLength={40} onChange={(e) => setUpFolder(e.target.value)} />
        <datalist id="ml-up-folders">{folders.map((f) => (<option key={f} value={f} />))}</datalist>
        <small>{limitsText('any')}</small>
      </div>

      {jobs.length > 0 && (
        <ul className="ml-jobs">
          {jobs.slice(0, 12).map((j) => (
            <li key={j.key} className={`is-${j.state}`}>
              <span className="mp-job-name">{j.name}</span>
              <span className="mp-job-state">{j.state === 'err' ? j.error : j.state === 'done' ? 'Uploaded' : j.state === 'wait' ? 'Waiting…' : `${j.pct}%`}</span>
              <span className="mp-bar-track"><span style={{ width: `${j.state === 'err' ? 100 : j.pct}%` }} /></span>
            </li>
          ))}
        </ul>
      )}

      {status && <p className={`ml-status ${status.err ? 'is-err' : 'is-ok'}`} role="status">{status.text}</p>}

      {items.length > 0 && (
        <div className={`ml-bulk${picked.length ? ' is-active' : ''}`}>
          <label className="mp-check-all">
            <input type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(items.map((i) => i.id)))} aria-label="Select all on this page" />
            {picked.length ? `${picked.length} selected` : 'Select all'}
          </label>
          {picked.length > 0 && (
            <>
              <button type="button" className="mp-btn mp-btn-danger mp-btn-sm" disabled={pending} onClick={bulkDelete}>Delete selected</button>
              <input className="mp-input" list="ml-move-folders" placeholder="Move to folder…" aria-label="Move to folder" value={moveTo} maxLength={40} onChange={(e) => setMoveTo(e.target.value)} />
              <datalist id="ml-move-folders">{folders.map((f) => (<option key={f} value={f} />))}</datalist>
              <button type="button" className="mp-btn mp-btn-sm" disabled={pending} onClick={bulkMove}>{moveTo.trim() ? 'Move' : 'Remove from folder'}</button>
              <button type="button" className="mp-btn mp-btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
            </>
          )}
        </div>
      )}

      {view === 'grid' ? (
        <ul className="ml-grid">
          {items.map((m) => (
            <li key={m.id} className={`ml-card${selected.has(m.id) ? ' is-sel' : ''}`}>
              <label className="ml-card-cb" title="Select">
                <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} aria-label={`Select ${m.original_name || m.filename}`} />
              </label>
              {m.storage === 'public' && <span className="ml-lock" title="Ships with the site: read-only">site</span>}
              <button type="button" className="ml-card-open" onClick={() => setOpenId(m.id)} aria-label={`Open details of ${m.original_name || m.filename}`}>
                <MediaThumb item={m} cacheBust={bust[m.id]} />
              </button>
              <div className="ml-card-meta">
                <span className="ml-card-name" title={m.original_name || m.filename}>{m.original_name || m.filename}</span>
                <span className="ml-card-sub">{fmtBytes(m.size)}{m.width && m.height ? ` · ${m.width}×${m.height}` : ''}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ml-tablewrap">
          <table className="ml-list">
            <thead>
              <tr><th style={{ width: 36 }} /><th style={{ width: 70 }} /><th>File</th><th>Type</th><th>Size</th><th>Folder</th><th>Uploaded by</th><th>Date</th></tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className={selected.has(m.id) ? 'is-sel' : ''}>
                  <td><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} aria-label={`Select ${m.original_name || m.filename}`} /></td>
                  <td><span className="ml-lt"><MediaThumb item={m} cacheBust={bust[m.id]} /></span></td>
                  <td><button type="button" className="ml-namebtn" onClick={() => setOpenId(m.id)}>{m.original_name || m.filename}</button>{m.storage === 'public' && <span className="mp-note"> · site file</span>}</td>
                  <td>{m.mime || m.kind}</td>
                  <td>{fmtBytes(m.size)}{m.width && m.height ? ` · ${m.width}×${m.height}` : ''}</td>
                  <td>{m.folder || '—'}</td>
                  <td>{m.author || '—'}</td>
                  <td>{m.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <MediaDetails
          item={open}
          folders={folders}
          bust={bust[open.id] ?? 0}
          hasPrev={openIdx > 0}
          hasNext={openIdx < items.length - 1}
          onNav={(d) => setOpenId(items[openIdx + d]?.id ?? openId)}
          onClose={() => setOpenId(null)}
          onChanged={(text, kind) => {
            setStatus({ text, err: kind === 'err' });
            router.refresh();
          }}
          onReplaced={(id) => setBust((b) => ({ ...b, [id]: Date.now() }))}
        />
      )}
    </div>
  );
}
