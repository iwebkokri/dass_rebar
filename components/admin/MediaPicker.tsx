'use client';

// Media picker modal: Library (search, type + folder filters, infinite scroll, details sidebar) and Upload (drag & drop, multi-file, progress).
// Self-contained: works in any client tree (the page builder embeds it) — it renders into document.body and brings its own CSS.
// The CALLER closes it: onPick(media) is called with the chosen item, then the caller sets open=false.
import '@/app/admin/css/media.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { absoluteUrl, fetchMedia, patchMedia, uploadMedia } from './MediaClient';
import MediaThumb from './MediaThumb';
import { acceptFor, fmtBytes, limitsText, precheckFile, toPicked, type MediaItem, type PickKind, type PickedMedia } from '@/lib/media-types';

export type { PickedMedia, PickKind } from '@/lib/media-types';

type Props = {
  open: boolean;
  kind?: PickKind;
  /** Single pick (default). The caller closes the picker. */
  onPick: (m: PickedMedia) => void;
  onClose: () => void;
  title?: string;
  /** Let the user tick several items; they arrive together in onPickMany (falls back to onPick once per item). */
  multiple?: boolean;
  onPickMany?: (items: PickedMedia[]) => void;
};

type Job = { key: string; name: string; pct: number; state: 'wait' | 'up' | 'done' | 'err'; error?: string };

const PER = 36;

export default function MediaPicker(props: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!props.open || !mounted) return null;
  return createPortal(<PickerModal {...props} />, document.body);
}

function PickerModal({ kind = 'any', onPick, onClose, title, multiple = false, onPickMany }: Props) {
  const [tab, setTab] = useState<'library' | 'upload'>('library');
  const [q, setQ] = useState('');
  const [typeSel, setTypeSel] = useState('');
  const [folder, setFolder] = useState('');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [folders, setFolders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selId, setSelId] = useState<number | null>(null);
  const [checked, setChecked] = useState<number[]>([]); // multiple mode: ticked ids, in the order they were ticked
  const [jobs, setJobs] = useState<Job[]>([]);
  const [upFolder, setUpFolder] = useState('');
  const [dragging, setDragging] = useState(false);
  const [alt, setAlt] = useState('');
  const [mtitle, setMtitle] = useState('');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reqRef = useRef(0);
  const filesRef = useRef(new Map<string, File>());

  const kindParam = kind === 'image' ? 'image' : kind === 'video' ? 'video' : typeSel;
  const sel = items.find((i) => i.id === selId) ?? null;
  const isOn = (id: number) => (multiple ? checked.includes(id) : id === selId);
  const chosenCount = multiple ? checked.length : sel ? 1 : 0;

  // ---- loading -------------------------------------------------------------
  const load = useCallback(
    async (pageNo: number, replace: boolean) => {
      const id = ++reqRef.current;
      setLoading(true);
      setError('');
      try {
        const r = await fetchMedia({ kind: kindParam, q, folder, page: pageNo, per: PER });
        if (id !== reqRef.current) return;
        setItems((prev) => (replace ? r.items : [...prev, ...r.items.filter((n) => !prev.some((p) => p.id === n.id))]));
        setPage(r.page);
        setPages(r.pages);
        setTotal(r.total);
        if (r.folders) setFolders(r.folders);
      } catch (e) {
        if (id === reqRef.current) setError(e instanceof Error ? e.message : 'Could not load the library.');
      } finally {
        if (id === reqRef.current) setLoading(false);
      }
    },
    [kindParam, q, folder]
  );

  useEffect(() => {
    const t = setTimeout(() => void load(1, true), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || tab !== 'library') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loading && page < pages) void load(page + 1, false);
      },
      { root: scrollRef.current, rootMargin: '240px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tab, loading, page, pages, load]);

  // sidebar fields follow the selection
  useEffect(() => {
    setAlt(sel?.alt ?? '');
    setMtitle(sel?.title ?? '');
    setCaption(sel?.caption ?? '');
    setNote('');
    setCopied(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId]);

  // ---- modal behaviour -----------------------------------------------------
  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key === 'Tab' && dialogRef.current) {
      const f = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // ---- uploads -------------------------------------------------------------
  async function startUploads(list: File[]) {
    if (!list.length) return;
    const fresh: Job[] = list.map((f) => {
      const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      filesRef.current.set(key, f);
      return { key, name: f.name, pct: 0, state: 'wait' };
    });
    setTab('upload');
    setJobs((prev) => [...fresh, ...prev]);
    const patch = (key: string, p: Partial<Job>) => setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...p } : j)));
    const queue = fresh.slice();
    let last = null as MediaItem | null;
    const added: number[] = [];
    const worker = async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const file = filesRef.current.get(job.key)!;
        const bad = precheckFile(file, kind);
        if (bad) {
          patch(job.key, { state: 'err', error: bad });
          continue;
        }
        patch(job.key, { state: 'up' });
        try {
          const item = await uploadMedia(file, { folder: upFolder.trim() || undefined, onProgress: (pct) => patch(job.key, { pct }) });
          patch(job.key, { state: 'done', pct: 100 });
          setItems((prev) => [item, ...prev.filter((p) => p.id !== item.id)]);
          setTotal((t) => t + 1);
          if (item.folder) setFolders((fs) => (fs.includes(item.folder) ? fs : [...fs, item.folder].sort()));
          last = item;
          added.push(item.id);
        } catch (e) {
          patch(job.key, { state: 'err', error: e instanceof Error ? e.message : 'Upload failed.' });
        }
        filesRef.current.delete(job.key);
      }
    };
    await Promise.all([worker(), worker()]);
    if (last) {
      setSelId(last.id);
      if (multiple) setChecked((c) => [...c, ...added.filter((id) => !c.includes(id))]);
      setTab('library');
    }
  }

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

  // ---- actions -------------------------------------------------------------
  const dirty = !!sel && sel.editable && (alt !== sel.alt || mtitle !== sel.title || caption !== sel.caption);

  async function saveDetails(): Promise<MediaItem | null> {
    if (!sel) return null;
    if (!dirty) return sel;
    setBusy(true);
    setNote('');
    try {
      const next = await patchMedia(sel.id, { alt, title: mtitle, caption });
      setItems((prev) => prev.map((p) => (p.id === next.id ? { ...p, ...next } : p)));
      setNote('Saved.');
      return next;
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not save.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function confirmPick() {
    if (multiple) {
      if (!checked.length) return;
      let current: MediaItem | null = sel;
      if (sel && dirty) current = await saveDetails();
      const list = checked
        .map((id) => (current && current.id === id ? current : items.find((i) => i.id === id)))
        .filter((i): i is MediaItem => !!i)
        .map(toPicked);
      if (onPickMany) onPickMany(list);
      else list.forEach((m) => onPick(m));
      return;
    }
    if (!sel) return;
    const item = await saveDetails();
    if (item) onPick(toPicked(item));
  }

  async function copyUrl() {
    if (!sel) return;
    try {
      await navigator.clipboard.writeText(absoluteUrl(sel.url));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setNote('Copy failed — select the URL and copy it manually.');
    }
  }

  const noun = kind === 'image' ? 'image' : kind === 'video' ? 'video' : 'file';
  const heading = title ?? (kind === 'image' ? 'Choose an image' : kind === 'video' ? 'Choose a video' : 'Media library');

  return (
    <div className="mp-root" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="mp-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={onKeyDown}
        onDragEnter={(e) => hasFiles(e) && setDragging(true)}
        onDragOver={(e) => {
          if (hasFiles(e)) {
            e.preventDefault();
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          if (!hasFiles(e)) return;
          e.preventDefault();
          setDragging(false);
          void startUploads(Array.from(e.dataTransfer.files));
        }}
      >
        <header className="mp-head">
          <h2>{heading}</h2>
          <div className="mp-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={tab === 'library'} className={tab === 'library' ? 'is-on' : ''} onClick={() => setTab('library')}>Library</button>
            <button type="button" role="tab" aria-selected={tab === 'upload'} className={tab === 'upload' ? 'is-on' : ''} onClick={() => setTab('upload')}>Upload</button>
          </div>
          <button type="button" className="mp-x" aria-label="Close" onClick={onClose}>×</button>
        </header>

        {tab === 'library' ? (
          <div className="mp-body">
            <div className="mp-main">
              <div className="mp-bar">
                <input className="mp-input" type="search" placeholder="Search media…" aria-label="Search media" value={q} onChange={(e) => setQ(e.target.value)} />
                {kind === 'any' && (
                  <select className="mp-input" aria-label="Type" value={typeSel} onChange={(e) => setTypeSel(e.target.value)}>
                    <option value="">All types</option>
                    <option value="image">Images</option>
                    <option value="video">Videos</option>
                    <option value="file,audio">Documents</option>
                  </select>
                )}
                {folders.length > 0 && (
                  <select className="mp-input" aria-label="Folder" value={folder} onChange={(e) => setFolder(e.target.value)}>
                    <option value="">All folders</option>
                    {folders.map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                )}
              </div>
              <div className="mp-scroll" ref={scrollRef}>
                {error && <div className="mp-msg mp-msg-err" role="alert">{error} <button type="button" className="mp-link" onClick={() => void load(1, true)}>Retry</button></div>}
                {!error && !loading && items.length === 0 && (
                  <div className="mp-empty">
                    <p>{q || folder || typeSel ? 'Nothing matches those filters.' : `No ${kind === 'any' ? 'media' : noun + 's'} yet.`}</p>
                    <button type="button" className="mp-btn" onClick={() => setTab('upload')}>Upload files</button>
                  </div>
                )}
                <ul className="mp-grid">
                  {items.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        className={`mp-item${isOn(m.id) ? ' is-sel' : ''}`}
                        aria-pressed={isOn(m.id)}
                        title={m.original_name || m.filename}
                        onClick={() => {
                          if (multiple) {
                            const on = checked.includes(m.id);
                            setChecked((c) => (on ? c.filter((x) => x !== m.id) : [...c, m.id]));
                            setSelId(on && selId === m.id ? null : m.id);
                          } else setSelId(m.id === selId ? null : m.id);
                        }}
                        onDoubleClick={() => {
                          if (multiple) return;
                          setSelId(m.id);
                          onPick(toPicked(m));
                        }}
                      >
                        <MediaThumb item={m} />
                        <span className="mp-item-name">{m.original_name || m.filename}</span>
                        {isOn(m.id) && <span className="mp-check" aria-hidden="true">✓</span>}
                      </button>
                    </li>
                  ))}
                </ul>
                <div ref={sentinelRef} className="mp-sentinel" aria-hidden="true" />
                {loading && <div className="mp-msg" role="status">Loading…</div>}
                {!loading && page < pages && <button type="button" className="mp-btn mp-more" onClick={() => void load(page + 1, false)}>Load more</button>}
              </div>
            </div>

            <aside className="mp-side" aria-label="Details">
              {!sel ? (
                <p className="mp-hint">Select a {noun} to see its details. Double-click to use it straight away.</p>
              ) : (
                <>
                  <div className="mp-preview">
                    {sel.kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sel.url} alt="" />
                    ) : sel.kind === 'video' ? (
                      <video src={sel.url} controls preload="metadata" />
                    ) : (
                      <MediaThumb item={sel} />
                    )}
                  </div>
                  <dl className="mp-meta">
                    <dt>File</dt><dd>{sel.original_name || sel.filename}</dd>
                    <dt>Type</dt><dd>{sel.mime || sel.kind}</dd>
                    <dt>Size</dt><dd>{fmtBytes(sel.size)}{sel.width && sel.height ? ` · ${sel.width}×${sel.height}` : ''}</dd>
                    <dt>Added</dt><dd>{sel.created_at.slice(0, 10)}{sel.author ? ` · ${sel.author}` : ''}</dd>
                  </dl>
                  {!sel.editable && <p className="mp-hint">This file belongs to the site and can't be edited here.</p>}
                  <label className="mp-lab">Alt text<span>Describes the image for screen readers and search.</span>
                    <input className="mp-input" value={alt} disabled={!sel.editable} onChange={(e) => setAlt(e.target.value)} maxLength={300} />
                  </label>
                  <label className="mp-lab">Title
                    <input className="mp-input" value={mtitle} disabled={!sel.editable} onChange={(e) => setMtitle(e.target.value)} maxLength={200} />
                  </label>
                  <label className="mp-lab">Caption
                    <textarea className="mp-input" rows={2} value={caption} disabled={!sel.editable} onChange={(e) => setCaption(e.target.value)} maxLength={500} />
                  </label>
                  <div className="mp-urlrow">
                    <input className="mp-input" readOnly value={sel.url} aria-label="File URL" onFocus={(e) => e.currentTarget.select()} />
                    <button type="button" className="mp-btn mp-btn-sm" onClick={() => void copyUrl()}>{copied ? 'Copied' : 'Copy'}</button>
                  </div>
                  {note && <p className="mp-note" role="status">{note}</p>}
                  {dirty && <button type="button" className="mp-btn mp-btn-sm" disabled={busy} onClick={() => void saveDetails()}>{busy ? 'Saving…' : 'Save details'}</button>}
                </>
              )}
            </aside>
          </div>
        ) : (
          <div className="mp-body mp-uploadpane">
            <div
              className={`mp-drop${dragging ? ' is-over' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fileInputRef.current?.click())}
            >
              <strong>Drop files here</strong>
              <span>or click to select files</span>
              <small>{limitsText(kind)}</small>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept={acceptFor(kind)}
                onChange={(e) => {
                  const fl = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  void startUploads(fl);
                }}
              />
            </div>
            <label className="mp-lab mp-upfolder">Folder (optional)
              <input className="mp-input" list="mp-folders" value={upFolder} onChange={(e) => setUpFolder(e.target.value)} maxLength={40} placeholder="e.g. Projects" />
              <datalist id="mp-folders">{folders.map((f) => (<option key={f} value={f} />))}</datalist>
            </label>
            {jobs.length > 0 && (
              <ul className="mp-jobs">
                {jobs.map((j) => (
                  <li key={j.key} className={`is-${j.state}`}>
                    <span className="mp-job-name">{j.name}</span>
                    <span className="mp-job-state">{j.state === 'err' ? j.error : j.state === 'done' ? 'Uploaded' : j.state === 'wait' ? 'Waiting…' : `${j.pct}%`}</span>
                    <span className="mp-bar-track"><span style={{ width: `${j.state === 'err' ? 100 : j.pct}%` }} /></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {dragging && <div className="mp-dropveil">Drop files to upload</div>}

        <footer className="mp-foot">
          <span className="mp-count">{tab === 'library' ? `${total} item${total === 1 ? '' : 's'}${multiple ? (checked.length ? ` · ${checked.length} selected` : '') : sel ? ` · selected: ${sel.original_name || sel.filename}` : ''}` : ''}</span>
          <button type="button" className="mp-btn" onClick={onClose}>Cancel</button>
          <button type="button" className="mp-btn mp-btn-primary" disabled={!chosenCount || busy} onClick={() => void confirmPick()}>{multiple ? `Use ${chosenCount || ''} ${noun}${chosenCount === 1 ? '' : 's'}`.replace('  ', ' ') : `Use this ${noun}`}</button>
        </footer>
      </div>
    </div>
  );
}
