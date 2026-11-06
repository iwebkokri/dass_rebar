'use client';

// The per-page / per-post search + AI fields of the page settings screen and the post editor. Plain named inputs inside the
// surrounding server-action <form>; the server validates everything again (lib/seo-core.mjs → cleanContentSeo).
import { useState } from 'react';
import { PAGE_SCHEMA_TYPES, POST_SCHEMA_TYPES, TWITTER_CARDS } from '@/lib/seo-core.mjs';
import { countWords } from '@/lib/builder/content-text.mjs';

export type SeoFieldValues = {
  focus_keyword: string; canonical_url: string; nofollow: number; noindex?: number; og_title: string; og_description: string;
  twitter_card: string; schema_type: string; answer_summary: string; breadcrumb_title: string; custom_jsonld: string;
  code_css?: string; code_head?: string; code_footer?: string;
};

type Props = {
  kind: 'page' | 'post';
  values: SeoFieldValues;
  /** may edit custom JSON-LD (manage_seo) */
  canJsonLd: boolean;
  /** may edit the page's own CSS / head / footer code (manage_code) — pages only */
  canCode?: boolean;
};

export default function SeoFields({ kind, values: v, canJsonLd, canCode = false }: Props) {
  const [summary, setSummary] = useState(v.answer_summary);
  const words = countWords(summary);
  const inRange = words >= 40 && words <= 60;
  const types = kind === 'post' ? POST_SCHEMA_TYPES : PAGE_SCHEMA_TYPES;

  return (
    <>
      <div className="sc-card pg-stack" id="seo-ai">
        <div className="pg-card-h"><h2>AI answer &amp; structured data</h2></div>
        <div className="sc-field">
          <label htmlFor="se-summary">Direct answer (summary)</label>
          <textarea className="sc-textarea" id="se-summary" name="answer_summary" rows={4} maxLength={700} value={summary} onChange={(e) => setSummary(e.target.value)}
            placeholder="Answer the page’s main question in 40–60 words, on its own — as if an assistant were quoting you." />
          <span className={`se-count${words === 0 ? '' : inRange ? ' is-good' : ' is-off'}`} aria-live="polite"><b>{words}</b> words {words === 0 ? '— not set' : inRange ? '— good length' : '— aim for 40–60'}</span>
          <span className="sc-help">Used for the structured data description, llms.txt and as the quotable answer for featured snippets, voice assistants and AI answers. It is not shown on the page.</span>
        </div>
        <div className="sc-form">
          <div className="sc-field">
            <label htmlFor="se-schema">Structured data type</label>
            <select className="sc-select" id="se-schema" name="schema_type" defaultValue={v.schema_type}>
              {types.map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
            </select>
          </div>
          <div className="sc-field">
            <label htmlFor="se-crumb">Breadcrumb title</label>
            <input className="sc-input" id="se-crumb" name="breadcrumb_title" maxLength={100} defaultValue={v.breadcrumb_title} placeholder="Defaults to the title" />
          </div>
        </div>
        <div className="sc-field">
          <label htmlFor="se-jsonld">Custom structured data (JSON-LD) {!canJsonLd && <span className="sc-faint">— administrators only</span>}</label>
          <textarea className="sc-textarea se-code" id="se-jsonld" name="custom_jsonld" rows={5} defaultValue={v.custom_jsonld} disabled={!canJsonLd} spellCheck={false}
            placeholder={'{ "@type": "Service", "name": "Rebar bending", "provider": { "@id": "https://example.com/#organization" } }'} />
          <span className="sc-help">Optional. One JSON object or a list of objects; it is added to the automatic structured data. Invalid JSON is rejected.</span>
        </div>
      </div>

      <div className="sc-card pg-stack">
        <div className="pg-card-h"><h2>Advanced search &amp; social settings</h2></div>
        <div className="sc-form">
          <div className="sc-field">
            <label htmlFor="se-kw">Focus keyword</label>
            <input className="sc-input" id="se-kw" name="focus_keyword" maxLength={80} defaultValue={v.focus_keyword} placeholder="e.g. rebar bending Ontario" />
            <span className="sc-help">Used by the SEO checks only; it is never shown on the site.</span>
          </div>
          <div className="sc-field">
            <label htmlFor="se-canon">Canonical URL</label>
            <input className="sc-input" id="se-canon" name="canonical_url" maxLength={500} defaultValue={v.canonical_url} placeholder="Leave empty to use this page’s own address" />
            <span className="sc-help">Only set this when the same content lives at another address you want search engines to prefer.</span>
          </div>
          <div className="sc-field">
            <label htmlFor="se-ogt">Social title</label>
            <input className="sc-input" id="se-ogt" name="og_title" maxLength={200} defaultValue={v.og_title} placeholder="Defaults to the SEO title" />
          </div>
          <div className="sc-field">
            <label htmlFor="se-card">Twitter / X card</label>
            <select className="sc-select" id="se-card" name="twitter_card" defaultValue={v.twitter_card}>
              {TWITTER_CARDS.map(([val, label]) => (<option key={val} value={val}>{label}</option>))}
            </select>
          </div>
          <div className="sc-field is-wide">
            <label htmlFor="se-ogd">Social description</label>
            <textarea className="sc-textarea" id="se-ogd" name="og_description" rows={2} maxLength={400} defaultValue={v.og_description} placeholder="Defaults to the meta description" />
          </div>
          <div className="sc-field is-wide">
            {kind === 'post' && (
              <label className="sc-check"><input type="checkbox" name="noindex" defaultChecked={!!v.noindex} /> Hide this article from search engines (noindex)</label>
            )}
            <label className="sc-check"><input type="checkbox" name="nofollow" defaultChecked={!!v.nofollow} /> Ask search engines not to follow links on this {kind} (nofollow)</label>
          </div>
        </div>
      </div>

      {canCode && (
        <div className="sc-card pg-stack">
          <div className="pg-card-h"><h2>Custom code for this page</h2><span className="sc-badge sc-badge-warn">administrators only</span></div>
          <div className="sc-flash sc-flash-warn" style={{ margin: 0 }}>
            This code is output exactly as typed, on this page only. Only paste code you trust — it runs for every visitor. Site-wide code lives under Tracking &amp; code.
          </div>
          <div className="sc-field">
            <label htmlFor="se-pcss">CSS</label>
            <textarea className="sc-textarea se-code" id="se-pcss" name="code_css" rows={5} defaultValue={v.code_css ?? ''} spellCheck={false} placeholder=".dr-t-heading h1 { letter-spacing: -0.01em; }" />
          </div>
          <div className="sc-field">
            <label htmlFor="se-phead">Header code <span className="sc-faint">(inside &lt;head&gt;)</span></label>
            <textarea className="sc-textarea se-code" id="se-phead" name="code_head" rows={4} defaultValue={v.code_head ?? ''} spellCheck={false} placeholder={'<script src="https://example.com/widget.js" async></script>'} />
            <span className="sc-help">Allowed in the header: script, style, link, meta, noscript and base tags. Anything else is ignored.</span>
          </div>
          <div className="sc-field">
            <label htmlFor="se-pfoot">Footer code <span className="sc-faint">(just before &lt;/body&gt;)</span></label>
            <textarea className="sc-textarea se-code" id="se-pfoot" name="code_footer" rows={4} defaultValue={v.code_footer ?? ''} spellCheck={false} />
          </div>
        </div>
      )}
    </>
  );
}
