// Tracking snippets + custom CSS / code for the root layout (see docs/SEO-AND-TRACKING.md).
//
//   <head>      built-in trackers, site CSS, page CSS, header code (site + page)  — real elements inside <head>
//   after <body> tracker <noscript> fallbacks + "Body-open code"
//   before </body> "Footer code" (site + page)
//
// Only the public site gets any of it. /admin/* and the builder canvas get nothing — except custom CSS in the canvas,
// so editors see their styling. The request's surface comes from proxy.ts.
import { createElement, type ReactNode } from 'react';
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import { get } from '@/lib/db';
import { nowUtc } from '@/lib/page-admin';
import { can } from '@/lib/roles';
import { getTracking, hasTrackers } from '@/lib/tracking';
import { cleanCss, cleanRawHtml, parseHeadSnippet } from '@/lib/html-snippet.mjs';
import { trackerBodyHtml, trackerHeadNodes } from '@/lib/tracking-core.mjs';

type HeadNode = { tag: string; attrs: Record<string, string | boolean>; text?: string };
type PageCode = { status: string; published_at: string | null; code_css: string; code_head: string; code_footer: string };
export type SiteCode = { head: ReactNode; bodyOpen: string; footer: string };

const EMPTY: SiteCode = { head: null, bodyOpen: '', footer: '' };
const SELECT = 'SELECT status, published_at, code_css, code_head, code_footer FROM pages';

const element = (n: HeadNode, key: string) =>
  createElement(n.tag, { key, ...n.attrs, ...(n.text !== undefined ? { dangerouslySetInnerHTML: { __html: n.text } } : {}) });

export async function resolveSiteCode(): Promise<SiteCode> {
  const h = await headers();
  const surface = h.get('x-dr-surface');
  if (surface !== 'site' && surface !== 'frame') return EMPTY;
  const site = surface === 'site';
  const t = getTracking();

  // page-level CSS / code
  let page: PageCode | undefined;
  if (site) {
    const path = (h.get('x-dr-path') ?? '').replace(/^\/+|\/+$/g, '').toLowerCase();
    page = get<PageCode>(`${SELECT} WHERE path = ? AND status <> 'trash'`, path);
    const live = !!page && page.status === 'published' && (!page.published_at || page.published_at <= nowUtc());
    if (page && !live) {
      const user = await getCurrentUser(); // drafts / scheduled pages are only rendered for editors: they see their code too
      if (!user || !can(user, 'edit_pages')) page = undefined;
    }
  } else {
    const id = Number(h.get('x-dr-page'));
    if (id > 0) {
      const user = await getCurrentUser();
      if (user && can(user, 'use_builder')) page = get<PageCode>(`${SELECT} WHERE id = ?`, id);
    }
  }

  // built-in trackers: not for signed-in CMS users unless the administrator turned the exclusion off
  let trackersOn = site && hasTrackers(t);
  if (trackersOn && t.skipUsers && (await getCurrentUser())) trackersOn = false;

  const nodes: HeadNode[] = [];
  if (trackersOn) nodes.push(...(trackerHeadNodes(t) as HeadNode[]));
  const els: ReactNode[] = nodes.map((n, i) => element(n, `t${i}`));
  if (t.css) els.push(createElement('style', { key: 'css', id: 'dr-custom-css', dangerouslySetInnerHTML: { __html: t.css } }));
  if (page?.code_css) els.push(createElement('style', { key: 'pcss', id: 'dr-page-css', dangerouslySetInnerHTML: { __html: cleanCss(page.code_css) } }));
  if (site) {
    parseHeadSnippet(t.head).nodes.forEach((n: HeadNode, i: number) => els.push(element(n, `h${i}`)));
    if (page?.code_head) parseHeadSnippet(page.code_head).nodes.forEach((n: HeadNode, i: number) => els.push(element(n, `ph${i}`)));
  }

  return {
    head: els.length ? els : null,
    bodyOpen: site ? [trackersOn ? trackerBodyHtml(t) : '', t.body].filter(Boolean).join('\n') : '',
    footer: site ? [t.footer, cleanRawHtml(page?.code_footer)].filter(Boolean).join('\n') : '',
  };
}
