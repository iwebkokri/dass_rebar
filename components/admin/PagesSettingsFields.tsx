'use client';

// Title + path (with the "create a redirect" offer) and the SEO fields with live counters and a Google-style preview.
import { useState } from 'react';

type Props = {
  title: string;
  path: string;
  isHome: boolean;
  seoTitle: string;
  seoDescription: string;
  siteName: string;
  siteHost: string;
};

const clean = (v: string) => v.trim().toLowerCase().replace(/\s+/g, '-').replace(/\/{2,}/g, '/').replace(/^\/+|\/+$/g, '');

function Counter({ n, max, label }: { n: number; max: number; label: string }) {
  const over = n > max;
  return (
    <>
      <div className={`pg-bar${over ? ' is-over' : ''}`} aria-hidden><i style={{ width: `${Math.min(100, (n / max) * 100)}%` }} /></div>
      <div className={`pg-counter${over ? ' is-over' : ''}`}>
        <span><b>{n}</b> / {max} characters{over ? ` — ${label} may be cut off in search results` : ''}</span>
      </div>
    </>
  );
}

export default function PagesSettingsFields(p: Props) {
  const [title, setTitle] = useState(p.title);
  const [path, setPath] = useState(p.path);
  const [seoTitle, setSeoTitle] = useState(p.seoTitle);
  const [seoDesc, setSeoDesc] = useState(p.seoDescription);
  const changed = !p.isHome && clean(path) !== p.path;

  const shownPath = clean(path);
  const crumbs = shownPath ? ' › ' + shownPath.split('/').join(' › ') : '';
  const headline = `${seoTitle.trim() || title.trim() || 'Untitled'} | ${p.siteName}`;

  return (
    <>
      <div className="sc-card pg-stack">
        <div className="sc-field">
          <label htmlFor="pg-title">Title <span className="sc-req">*</span></label>
          <input className="sc-input" id="pg-title" name="title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="sc-field">
          <label htmlFor="pg-path">Path</label>
          <div className="pg-prefix">
            <span>/</span>
            <input
              className="sc-input"
              id="pg-path"
              name="path"
              maxLength={160}
              value={path}
              readOnly={p.isHome}
              placeholder={p.isHome ? '' : 'about-us'}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setPath(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            />
          </div>
          <span className="pg-url">{p.isHome ? 'The home page always lives at the site root; its path can’t be changed.' : `https://${p.siteHost}/${shownPath}`}</span>
          {changed && (
            <div className="pg-redirect" role="note">
              <label>
                <input type="checkbox" name="redirect_old" defaultChecked />
                <span>Create a 301 redirect from <code>/{p.path}</code> to <code>/{shownPath || '…'}</code> so old links and Google keep working.</span>
              </label>
            </div>
          )}
        </div>
      </div>

      <div className="sc-card pg-stack">
        <div className="pg-card-h"><h2>Search engine listing</h2></div>
        <div>
          <span className="pg-snippet-label">Preview (approximate)</span>
          <div className="pg-snippet" aria-label="Search result preview">
            <div className="pg-snippet-site">
              <span className="pg-snippet-fav">{p.siteName.slice(0, 1).toUpperCase()}</span>
              <div>
                <div className="pg-snippet-name">{p.siteName}</div>
                <div className="pg-snippet-url">{`https://${p.siteHost}${crumbs}`}</div>
              </div>
            </div>
            <div className="pg-snippet-title">{headline}</div>
            <div className="pg-snippet-desc">{seoDesc.trim() || 'No description set — search engines will pick a snippet from the page text.'}</div>
          </div>
        </div>

        <div className="sc-field">
          <label htmlFor="pg-seo-title">SEO title</label>
          <input className="sc-input" id="pg-seo-title" name="seo_title" maxLength={120} value={seoTitle} placeholder={title} onChange={(e) => setSeoTitle(e.target.value)} />
          <Counter n={(seoTitle || title).length} max={60} label="the title" />
          <span className="sc-help">Leave empty to use the page title. “| {p.siteName}” is added automatically.</span>
        </div>

        <div className="sc-field">
          <label htmlFor="pg-seo-desc">Meta description</label>
          <textarea className="sc-textarea" id="pg-seo-desc" name="seo_description" rows={3} maxLength={320} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} />
          <Counter n={seoDesc.length} max={160} label="the description" />
        </div>
      </div>
    </>
  );
}
