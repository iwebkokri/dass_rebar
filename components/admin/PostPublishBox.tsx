'use client';

// "Publish" card of the post editor: status, publish date (future date = Scheduled), the main save button and the secondary links.
// The Move-to-Trash button lives in the separate form #post-actions (HTML `form` attribute) because forms can't be nested.
import '@/app/admin/css/posts.css';
import { useState } from 'react';
import { localInputToStamp, nowStamp } from '@/lib/post-time';

type Props = {
  isNew: boolean;
  postId: number;
  status: 'draft' | 'published';
  wasPublished: boolean;
  publishedAtLocal: string; // datetime-local value in Toronto time ('' = not set yet)
  canPublish: boolean;
  canDelete: boolean;
  viewUrl: string; // public URL (published) or the ?preview=1 URL
  external: boolean;
  updatedLabel: string;
};

export default function PostPublishBox(p: Props) {
  const [status, setStatus] = useState<'draft' | 'published'>(p.canPublish ? p.status : 'draft');
  const [at, setAt] = useState(p.publishedAtLocal);

  const stamp = at ? localInputToStamp(at) : null;
  const future = !!stamp && stamp > nowStamp();
  const button = status === 'draft' ? (p.isNew || !p.wasPublished ? 'Save draft' : 'Switch to draft') : future ? 'Schedule' : p.wasPublished ? 'Update' : 'Publish';
  const note =
    status === 'draft' ? 'Not visible on the website.'
      : future ? 'Will go live automatically at the date below (Scheduled).'
      : at || p.wasPublished ? 'Visible on the website.' : 'Goes live as soon as you save.';

  return (
    <section className="sc-card po-box po-publish">
      <h2>Publish</h2>
      <div className="sc-field">
        <label htmlFor="po-status">Status</label>
        <select className="sc-select" id="po-status" name="status" value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}>
          <option value="draft">Draft</option>
          {p.canPublish && <option value="published">Published</option>}
        </select>
        <span className="sc-help">{note}</span>
      </div>
      <div className="sc-field">
        <label htmlFor="po-date">Publish date <span className="sc-faint">(Toronto time)</span></label>
        <input className="sc-input" id="po-date" type="datetime-local" name="published_at" value={at} onChange={(e) => setAt(e.target.value)} />
        <span className="sc-help">
          {at ? <>A future date schedules the post. <button type="button" className="po-link" onClick={() => setAt('')}>Clear</button></> : 'Leave empty to publish immediately.'}
        </span>
      </div>
      {!p.isNew && <p className="po-meta">Last saved {p.updatedLabel}</p>}

      <div className="po-publish-actions">
        <button type="submit" className="sc-btn sc-btn-primary">{button}</button>
        {!p.isNew && (
          <a className="sc-btn" href={p.viewUrl} target="_blank" rel="noopener">{p.external ? 'Open link ↗' : status === 'published' && p.wasPublished && !future ? 'View ↗' : 'Preview ↗'}</a>
        )}
        {!p.isNew && p.canDelete && (
          <button type="submit" form="post-actions" name="op" value={`trash:${p.postId}`} className="sc-btn sc-btn-danger">Move to Trash</button>
        )}
      </div>
    </section>
  );
}
