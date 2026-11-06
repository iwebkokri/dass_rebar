'use client';

// Ordered photo list for the resource editors (projects). Posts `${name}__list` (JSON array of URLs, in order) and,
// for direct uploads, files under `${name}__files`. The server only accepts URLs the item already had or that exist in the media library.
import '@/app/admin/css/media.css';
import { useState } from 'react';
import MediaPicker from './MediaPicker';
import { acceptFor, type PickedMedia } from '@/lib/media-types';

export default function MediaGalleryField({ name, defaultValue, label, help }: { name: string; defaultValue: string[]; label: string; help?: string }) {
  const [list, setList] = useState<string[]>(defaultValue);
  const [open, setOpen] = useState(false);

  const move = (i: number, d: -1 | 1) =>
    setList((l) => {
      const j = i + d;
      if (j < 0 || j >= l.length) return l;
      const n = l.slice();
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  function add(items: PickedMedia[]) {
    setList((l) => [...l, ...items.map((m) => m.url).filter((u) => !l.includes(u))]);
    setOpen(false);
  }

  return (
    <div className="mp-field">
      <span className="mp-field-label">{label}</span>
      <input type="hidden" name={`${name}__list`} value={JSON.stringify(list)} />
      {list.length > 0 && (
        <ul className="mp-gal">
          {list.map((src, i) => (
            <li key={src}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              <span className="mp-gal-tag">{i === 0 ? 'Main' : i + 1}</span>
              <span className="mp-gal-btns">
                <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}>‹</button>
                <button type="button" aria-label="Move later" disabled={i === list.length - 1} onClick={() => move(i, 1)}>›</button>
                <button type="button" aria-label="Remove photo" onClick={() => setList((l) => l.filter((x) => x !== src))}>×</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mp-field-btns">
        <button type="button" className="mp-btn mp-btn-sm" onClick={() => setOpen(true)}>Add from media library</button>
      </div>
      <label className="mp-gal-upload">
        <span>…or upload from your computer</span>
        <input className="sc-input" type="file" name={`${name}__files`} multiple accept={acceptFor('image')} />
      </label>
      <span className="mp-field-help">The first photo is the main one — use the arrows to reorder. JPG, PNG, WebP, GIF or AVIF, up to 8 MB each. {help}</span>
      <MediaPicker open={open} kind="image" multiple onPick={(m) => add([m])} onPickMany={add} onClose={() => setOpen(false)} />
    </div>
  );
}
