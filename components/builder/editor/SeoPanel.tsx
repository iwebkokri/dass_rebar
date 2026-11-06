'use client';

// "SEO & AI" tab of the builder: the key search fields of the page plus the live analysis. The analysis is recomputed from the
// in-memory document every time it changes, so it updates as you type — before anything is saved.
import { useMemo } from 'react';
import Link from 'next/link';
import SeoReport from '@/components/admin/SeoReport';
import { analyzeSeo } from '@/lib/builder/seo-analysis.mjs';
import { countWords } from '@/lib/builder/content-text.mjs';
import type { BNode } from '@/lib/builder/types';

export type SeoFieldsState = { seo_title: string; seo_description: string; focus_keyword: string; answer_summary: string };
export type SeoInit = {
  fields: SeoFieldsState;
  /** read-only page values the analysis also needs */
  context: { canonical_url: string; noindex: number; nofollow: number; og_image: string; schema_type: string; breadcrumb_title: string; og_title: string; custom_jsonld: string };
  site: Record<string, any>;
};

type Props = {
  nodes: BNode[];
  title: string;
  path: string;
  init: SeoInit;
  fields: SeoFieldsState;
  onField: (key: keyof SeoFieldsState, value: string) => void;
  settingsUrl: string;
};

export default function SeoPanel({ nodes, title, path, init, fields, onField, settingsUrl }: Props) {
  const result = useMemo(
    () => analyzeSeo({ nodes, page: { ...init.context, ...fields, title, path }, site: init.site, kind: 'page' }),
    [nodes, init, fields, title, path]
  );
  const words = countWords(fields.answer_summary);
  return (
    <div className="be-pagetab" data-testid="seo-panel">
      <label className="be-field"><span className="be-label">SEO title</span>
        <input className="be-input" name="seo_title" value={fields.seo_title} maxLength={120} placeholder={title} onChange={(e) => onField('seo_title', e.target.value)} />
        <span className="be-muted">{(fields.seo_title || title).length} / 60 characters</span>
      </label>
      <label className="be-field"><span className="be-label">Meta description</span>
        <textarea className="be-input be-textarea" name="seo_description" rows={3} value={fields.seo_description} maxLength={320} onChange={(e) => onField('seo_description', e.target.value)} />
        <span className="be-muted">{fields.seo_description.length} / 160 characters</span>
      </label>
      <label className="be-field"><span className="be-label">Focus keyword</span>
        <input className="be-input" name="focus_keyword" value={fields.focus_keyword} maxLength={80} placeholder="e.g. rebar bending Ontario" onChange={(e) => onField('focus_keyword', e.target.value)} />
      </label>
      <label className="be-field"><span className="be-label">Direct answer (40–60 words)</span>
        <textarea className="be-input be-textarea" name="answer_summary" rows={4} value={fields.answer_summary} maxLength={700} onChange={(e) => onField('answer_summary', e.target.value)} placeholder="Answer the page’s main question on its own, as if an assistant were quoting you." />
        <span className="be-muted">{words} words{words === 0 ? '' : words >= 40 && words <= 60 ? ' — good length' : ' — aim for 40–60'}</span>
      </label>
      <p className="be-muted" style={{ marginBottom: 14 }}>Saved together with the page. More fields (canonical URL, social card, structured data): <Link href={`${settingsUrl}#seo-ai`} target="_blank">page settings ↗</Link></p>
      <h4 style={{ margin: '4px 0 8px' }}>Analysis <span className="be-muted" style={{ fontWeight: 400 }}>· live</span></h4>
      <SeoReport result={result} />
    </div>
  );
}
