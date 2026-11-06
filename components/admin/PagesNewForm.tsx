'use client';

// "Add new page": title, path (auto-slug until edited), layout and where to start from.
import { useState } from 'react';
import { createPage } from '@/app/admin/pages/actions';
import { slugify } from '@/lib/slug.mjs';

type Props = {
  pages: { id: number; title: string; path: string }[];
  templates: { id: number; name: string }[];
  initial: { title: string; path: string; layout: string; source: string; sp: string; st: string };
};

export default function PagesNewForm({ pages, templates, initial }: Props) {
  const [title, setTitle] = useState(initial.title);
  const [path, setPath] = useState(initial.path);
  const [auto, setAuto] = useState(!initial.path);
  const [source, setSource] = useState(['page', 'template'].includes(initial.source) ? initial.source : 'blank');
  const [layout, setLayout] = useState(initial.layout === 'canvas' ? 'canvas' : 'default');

  return (
    <form action={createPage} className="sc-card pg-narrow">
      <div className="pg-stack">
        <div className="sc-field">
          <label htmlFor="pg-title">Title <span className="sc-req">*</span></label>
          <input
            className="sc-input"
            id="pg-title"
            name="title"
            required
            autoFocus
            maxLength={200}
            value={title}
            placeholder="About us"
            onChange={(e) => {
              setTitle(e.target.value);
              if (auto) setPath(e.target.value.trim() ? slugify(e.target.value) : '');
            }}
          />
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
              placeholder="about-us"
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => {
                setAuto(false);
                setPath(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
            />
          </div>
          <input type="hidden" name="path_auto" value={auto ? '1' : '0'} />
          <span className="sc-help">Lowercase letters, digits and dashes. Use “/” for sub-pages (services/detailing). If the path is taken, a number is added automatically.</span>
        </div>

        <div className="sc-field">
          <span className="sc-label">Layout</span>
          <div className="pg-twoup">
            <label className="pg-choice">
              <input type="radio" name="layout" value="default" checked={layout === 'default'} onChange={() => setLayout('default')} />
              <span><b>Default</b><small>With the site header and footer.</small></span>
            </label>
            <label className="pg-choice">
              <input type="radio" name="layout" value="canvas" checked={layout === 'canvas'} onChange={() => setLayout('canvas')} />
              <span><b>Canvas</b><small>No header or footer: landing pages.</small></span>
            </label>
          </div>
        </div>

        <div className="sc-field">
          <span className="sc-label">Start from</span>
          <div className="pg-choices">
            <label className="pg-choice">
              <input type="radio" name="source" value="blank" checked={source === 'blank'} onChange={() => setSource('blank')} />
              <span><b>A blank page</b><small>Build it from scratch in the page builder.</small></span>
            </label>
            <label className="pg-choice">
              <input type="radio" name="source" value="page" checked={source === 'page'} onChange={() => setSource('page')} disabled={pages.length === 0} />
              <span style={{ flex: 1 }}>
                <b>A copy of an existing page</b>
                <small>Duplicates its content (the original is not touched).</small>
                {source === 'page' && (
                  <select className="sc-select" name="source_page" defaultValue={initial.sp} required aria-label="Page to copy">
                    <option value="">Choose a page…</option>
                    {pages.map((p) => (<option key={p.id} value={p.id}>{p.title} ({p.path === '' ? '/' : '/' + p.path})</option>))}
                  </select>
                )}
              </span>
            </label>
            <label className="pg-choice">
              <input type="radio" name="source" value="template" checked={source === 'template'} onChange={() => setSource('template')} disabled={templates.length === 0} />
              <span style={{ flex: 1 }}>
                <b>A saved page layout</b>
                <small>{templates.length ? 'Start from a page template saved in Templates.' : 'No page layouts saved yet (save one from the builder or add it under Templates).'}</small>
                {source === 'template' && (
                  <select className="sc-select" name="source_template" defaultValue={initial.st} required aria-label="Page layout">
                    <option value="">Choose a layout…</option>
                    {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                )}
              </span>
            </label>
          </div>
        </div>

        <div className="sc-form-actions" style={{ gridColumn: 'auto' }}>
          <button className="sc-btn sc-btn-primary" type="submit">Create page</button>
          <a className="sc-btn" href="/admin/pages">Cancel</a>
          <span className="sc-help">The new page starts as a draft and opens in the builder.</span>
        </div>
      </div>
    </form>
  );
}
