// Page / template queries (read side). Pages are builder documents stored in SQLite.
import { all, get } from './db';
import { parseDoc } from './builder/tree.mjs';
import type { BDoc } from './builder/types';

export type PageRow = {
  id: number;
  path: string;
  title: string;
  status: 'draft' | 'published' | 'trash';
  layout: 'default' | 'canvas';
  content: string;
  seo_title: string;
  seo_description: string;
  og_image: string;
  noindex: number;
  author_id: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  // SEO / AI fields (migration 3)
  nofollow: number;
  focus_keyword: string;
  canonical_url: string;
  og_title: string;
  og_description: string;
  twitter_card: string;
  schema_type: string;
  answer_summary: string;
  breadcrumb_title: string;
  custom_jsonld: string;
  // page-level code (administrators only)
  code_css: string;
  code_head: string;
  code_footer: string;
};

export type TemplateRow = { id: number; kind: 'header' | 'footer' | 'section' | 'page' | 'popup'; name: string; content: string; active: number; updated_at: string };

/** Normalise a request path: no leading/trailing slashes, lower-case. '' is the home page. */
export const normPath = (p: string) => p.replace(/^\/+|\/+$/g, '').toLowerCase();

/** A published page, or — when `preview` is true (a signed-in editor) — any non-trashed page. */
export function getPageByPath(path: string, preview = false): PageRow | undefined {
  const row = get<PageRow>('SELECT * FROM pages WHERE path = ?', normPath(path));
  if (!row || row.status === 'trash') return undefined;
  if (preview) return row;
  if (row.status !== 'published') return undefined;
  if (row.published_at && row.published_at > new Date().toISOString().slice(0, 19).replace('T', ' ')) return undefined; // scheduled
  return row;
}

export function getPageById(id: number): PageRow | undefined {
  return get<PageRow>('SELECT * FROM pages WHERE id = ?', id);
}

export const pageDoc = (row: Pick<PageRow, 'content'>): BDoc => parseDoc(row.content);

export function getActiveTemplate(kind: 'header' | 'footer'): { id: number; doc: BDoc } | null {
  const row = get<TemplateRow>('SELECT * FROM templates WHERE kind = ? AND active = 1 ORDER BY id DESC LIMIT 1', kind);
  return row ? { id: row.id, doc: parseDoc(row.content) } : null;
}

export function getTemplateById(id: number): TemplateRow | undefined {
  return get<TemplateRow>('SELECT * FROM templates WHERE id = ?', id);
}

export function listTemplates(kind?: TemplateRow['kind']): TemplateRow[] {
  return kind ? all<TemplateRow>('SELECT * FROM templates WHERE kind = ? ORDER BY name', kind) : all<TemplateRow>('SELECT * FROM templates ORDER BY kind, name');
}

/** Published pages for sitemap / link pickers. */
export function listPublishedPages() {
  return all<{ id: number; path: string; title: string; updated_at: string }>("SELECT id, path, title, updated_at FROM pages WHERE status = 'published' AND noindex = 0 ORDER BY path");
}
