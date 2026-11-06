'use client';

// Details modal of the /admin/media screen: preview, alt / title / caption / folder, copy URL, replace file, usage, delete.
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { deleteMediaAction, mediaUsageAction, updateMediaAction } from '@/app/admin/media/actions';
import { absoluteUrl, replaceMediaFile } from './MediaClient';
import MediaThumb from './MediaThumb';
import { fmtBytes, type MediaItem } from '@/lib/media-types';
import type { Usage } from '@/lib/media';

type Props = {
  item: MediaItem;
  folders: string[];
  bust: number;
  hasPrev: boolean;
  hasNext: boolean;
  onNav: (dir: -1 | 1) => void;
  onClose: () => void;
  /** after something changed on the server (save / replace / delete) */
  onChanged: (message: string, kind?: 'ok' | 'err') => void;
  onReplaced: (id: number) => void;
};

export default function MediaDetails({ item, folders, bust, hasPrev, hasNext, onNav, onClose, onChanged, onReplaced }: Props) {
  const [alt, setAlt] = useState(item.alt);
  const [title, setTitle] = useState(item.title);
  const [caption, setCaption] = useState(item.caption);
  const [folder, setFolder] = useState(item.folder);
  const [note, setNote] = useState<{ text: string; err?: boolean } | null>(null);
  const [usage, setUsage] = useState<Usage[] | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // follow the item when the user pages through with the arrows
  useEffect(() => {
    setAlt(item.alt);
    setTitle(item.title);
    setCaption(item.caption);
    setFolder(item.folder);
    setNote(null);
    setUsage(null);
    let live = true;
    mediaUsageAction([item.id]).then((r) => live && setUsage(r[0]?.usage ?? [])).catch(() => live && setUsage([]));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    const typing = (e.target as HTMLElement).matches('input, textarea, select');
    if (!typing && e.key === 'ArrowLeft' && hasPrev) onNav(-1);
    if (!typing && e.key === 'ArrowRight' && hasNext) onNav(1);
  }

  const dirty = alt !== item.alt || title !== item.title || caption !== item.caption || folder !== item.folder;
  const name = item.original_name || item.filename;

  function save(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const r = await updateMediaAction(item.id, { alt, title, caption, folder });
      if (r.ok) {
        setNote({ text: 'Saved.' });
        onChanged('Details saved.');
      } else setNote({ text: r.error, err: true });
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(absoluteUrl(item.url));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setNote({ text: 'Copy failed — select the URL and copy it manually.', err: true });
    }
  }

  async function replace(file: File | undefined) {
    if (!file) return;
    setReplacing(true);
    setNote(null);
    try {
      await replaceMediaFile(item.id, file);
      onReplaced(item.id);
      setNote({ text: 'File replaced. The URL did not change.' });
      onChanged('File replaced.');
    } catch (err) {
      setNote({ text: err instanceof Error ? err.message : 'Could not replace the file.', err: true });
    } finally {
      setReplacing(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function remove() {
    start(async () => {
      const fresh = (await mediaUsageAction([item.id]))[0]?.usage ?? [];
      const msg = fresh.length
        ? `“${name}” is used in ${fresh.length} place${fresh.length === 1 ? '' : 's'} (${fresh.slice(0, 4).map((u) => `${u.type}: ${u.label}`).join('; ')}${fresh.length > 4 ? '…' : ''}).\n\nDeleting it will leave broken images there. Delete it permanently anyway?`
        : `Delete “${name}” permanently? This can't be undone.`;
      if (!window.confirm(msg)) return;
      const r = await deleteMediaAction([item.id]);
      onChanged(r.message, r.deleted ? 'ok' : 'err');
      if (r.deleted) onClose();
    });
  }

  return (
    <div className="ml-modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ml-panel" role="dialog" aria-modal="true" aria-label={`Details of ${name}`} tabIndex={-1} ref={dialogRef} onKeyDown={onKeyDown}>
        <button type="button" className="ml-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="ml-stage">
          {item.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bust ? `${item.url}?v=${bust}` : item.url} alt={item.alt} />
          ) : item.kind === 'video' ? (
            <video key={`${item.id}-${bust}`} src={bust ? `${item.url}?v=${bust}` : item.url} controls preload="metadata" />
          ) : (
            <MediaThumb item={item} />
          )}
          <button type="button" className="ml-nav ml-nav-prev" aria-label="Previous file" disabled={!hasPrev} onClick={() => onNav(-1)}>‹</button>
          <button type="button" className="ml-nav ml-nav-next" aria-label="Next file" disabled={!hasNext} onClick={() => onNav(1)}>›</button>
        </div>

        <div className="ml-info">
          <h2>{name}</h2>
          <dl className="ml-meta">
            <dt>URL</dt><dd>{item.url}</dd>
            <dt>Type</dt><dd>{item.mime || item.kind}</dd>
            <dt>Size</dt><dd>{fmtBytes(item.size)}{item.width && item.height ? ` · ${item.width} × ${item.height}px` : ''}</dd>
            <dt>Uploaded</dt><dd>{item.created_at.slice(0, 16).replace('T', ' ')}{item.author ? ` by ${item.author}` : ''}</dd>
            {item.folder && (<><dt>Folder</dt><dd>{item.folder}</dd></>)}
          </dl>

          {item.storage === 'public' && <p className="ml-readonly">This file ships with the site. It can be described here but not replaced or deleted.</p>}
          {!item.editable && item.storage !== 'public' && <p className="ml-readonly">You can view this file but not edit it.</p>}

          <form className="ml-form" onSubmit={save}>
            <label className="mp-lab">Alternative text<span>Describe the image for screen readers and search engines.</span>
              <input className="mp-input" name="alt" value={alt} disabled={!item.editable} maxLength={300} onChange={(e) => setAlt(e.target.value)} />
            </label>
            <label className="mp-lab">Title
              <input className="mp-input" name="title" value={title} disabled={!item.editable} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="mp-lab">Caption
              <textarea className="mp-input" name="caption" rows={2} value={caption} disabled={!item.editable} maxLength={500} onChange={(e) => setCaption(e.target.value)} />
            </label>
            <label className="mp-lab">Folder
              <input className="mp-input" name="folder" list="ml-folders" value={folder} disabled={!item.editable} maxLength={40} placeholder="(none)" onChange={(e) => setFolder(e.target.value)} />
              <datalist id="ml-folders">{folders.map((f) => (<option key={f} value={f} />))}</datalist>
            </label>
            <div className="ml-row">
              {item.editable && <button type="submit" className="mp-btn mp-btn-primary" disabled={!dirty || pending}>{pending ? 'Saving…' : 'Save changes'}</button>}
              <button type="button" className="mp-btn" onClick={() => void copy()}>{copied ? 'Copied' : 'Copy URL'}</button>
              <a className="mp-btn" href={item.url} target="_blank" rel="noopener">Open ↗</a>
            </div>
            {note && <p className={`ml-status ${note.err ? 'is-err' : 'is-ok'}`} role="status">{note.text}</p>}
          </form>

          <div className={`ml-usage${usage && usage.length ? ' is-used' : ''}`} aria-live="polite">
            {usage === null ? (
              <span className="mp-note">Checking where this file is used…</span>
            ) : usage.length === 0 ? (
              <span>Not used anywhere on the site.</span>
            ) : (
              <>
                <strong>Used in {usage.length} place{usage.length === 1 ? '' : 's'}</strong>
                <ul>
                  {usage.map((u, i) => (
                    <li key={`${u.href}-${i}`}>{u.type}: <Link href={u.href}>{u.label}</Link></li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {item.deletable && (
            <div className="ml-row">
              <input ref={fileRef} type="file" hidden accept={`.${item.url.split('.').pop()}`} onChange={(e) => void replace(e.target.files?.[0])} />
              <button type="button" className="mp-btn" disabled={replacing} onClick={() => fileRef.current?.click()}>{replacing ? 'Replacing…' : 'Replace file'}</button>
              <button type="button" className="mp-btn mp-btn-danger" disabled={pending} onClick={remove}>Delete permanently</button>
              <span className="mp-note" style={{ flexBasis: '100%' }}>Replace keeps the URL and every place that uses it. Visitors who already loaded the old file may keep seeing it until their browser cache expires.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
