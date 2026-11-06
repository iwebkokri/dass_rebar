// The page builder (Elementor-style). Server part: loads the document(s), checks permissions, hands everything to the client shell.
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import BuilderShell, { type BuilderInit } from '@/components/builder/editor/BuilderShell';
import { requireUser } from '@/lib/auth';
import { all, get, getSetting } from '@/lib/db';
import { can } from '@/lib/roles';
import { getPageById, getActiveTemplate, getTemplateById, pageDoc } from '@/lib/pages';
import { PALETTE } from '@/lib/builder/schema.mjs';
import { parseDoc } from '@/lib/builder/tree.mjs';
import { parsePalette } from '@/lib/palette';
import { getSeo, siteForAnalysis } from '@/lib/seo';
import { listPopups, popupsReady } from '@/lib/popups';
import { normalisePopupSettings } from '@/lib/popups-shared';
import { NOT_READY_MESSAGE } from '@/lib/schema-ready';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Page builder' };

export default async function BuilderPage({ params }: { params: Promise<{ target: string }> }) {
  const { target } = await params;
  const user = await requireUser();
  if (!can(user, 'use_builder')) redirect('/admin?error=forbidden');
  const m = /^(page|tpl)-(\d+)$/.exec(target);
  if (!m) notFound();
  const id = Number(m[2]);

  let init: Omit<BuilderInit, 'lists' | 'saved' | 'palette' | 'isAdmin' | 'canPublish' | 'canManageSite'>;
  const seoSettings = getSeo();
  if (m[1] === 'page') {
    const page = getPageById(id);
    if (!page || page.status === 'trash') notFound();
    if (!can(user, 'edit_pages')) redirect('/admin?error=forbidden');
    const header = can(user, 'manage_site') ? tplMeta('header') : null;
    const footer = can(user, 'manage_site') ? tplMeta('footer') : null;
    const ctxHeader = header ?? ro('header');
    const ctxFooter = footer ?? ro('footer');
    init = {
      kind: 'page', id, title: page.title, status: page.status, path: page.path, templateKind: null, base: page.updated_at,
      docs: { page: pageDoc(page).nodes, header: ctxHeader?.nodes ?? null, footer: ctxFooter?.nodes ?? null },
      headerMeta: header ? { id: header.id, base: header.base } : null,
      footerMeta: footer ? { id: footer.id, base: footer.base } : null,
      urls: { back: '/admin/pages', view: `/${page.path}`, settings: `/admin/pages/${page.id}` },
      popup: null,
      seo: {
        fields: { seo_title: page.seo_title, seo_description: page.seo_description, focus_keyword: page.focus_keyword, answer_summary: page.answer_summary },
        context: { canonical_url: page.canonical_url, noindex: page.noindex, nofollow: page.nofollow, og_image: page.og_image, schema_type: page.schema_type, breadcrumb_title: page.breadcrumb_title, og_title: page.og_title, custom_jsonld: page.custom_jsonld },
        site: siteForAnalysis(seoSettings),
      },
    };
  } else {
    const tpl = getTemplateById(id);
    if (!tpl) notFound();
    const live = tpl.kind === 'header' || tpl.kind === 'footer';
    const isPopup = tpl.kind === 'popup';
    if (isPopup && !popupsReady()) redirect(`/admin/popups?error=${encodeURIComponent(NOT_READY_MESSAGE)}`); // a server that hasn't run the migration yet
    if (!can(user, isPopup ? 'manage_forms' : live ? 'manage_site' : 'edit_pages')) redirect('/admin?error=forbidden');
    const popupRow = isPopup ? listPopups().find((p) => p.id === id) : undefined;
    init = {
      kind: 'template', id, title: tpl.name, status: tpl.kind, path: '', templateKind: tpl.kind, base: tpl.updated_at,
      docs: { page: parseDoc(tpl.content).nodes, header: null, footer: null },
      headerMeta: null, footerMeta: null,
      urls: isPopup ? { back: '/admin/popups', view: `/?popup-preview=${id}`, settings: '/admin/popups' } : { back: '/admin/templates', view: '/', settings: '/admin/templates' },
      popup: popupRow ? { settings: popupRow.settings } : isPopup ? { settings: normalisePopupSettings({}, tpl.name) } : null,
      seo: null,
    };
  }

  const sections = all<{ id: number; name: string; content: string }>("SELECT id, name, content FROM templates WHERE kind = 'section' ORDER BY name");
  const full: BuilderInit = {
    ...init,
    isAdmin: user.role === 'administrator',
    canPublish: can(user, 'publish_pages'),
    canManageSite: can(user, 'manage_site'),
    palette: parsePalette(getSetting('design_palette')) ?? (PALETTE as [string, string][]),
    saved: Object.fromEntries(sections.map((s) => [String(s.id), parseDoc(s.content).nodes])),
    lists: {
      pages: all<{ id: number; title: string; path: string }>("SELECT id, title, path FROM pages WHERE status != 'trash' ORDER BY title"),
      menus: all<{ slug: string; name: string }>('SELECT slug, name FROM menus ORDER BY name'),
      forms: all<{ id: number; name: string }>('SELECT id, name FROM forms ORDER BY name'),
      categories: all<{ slug: string; name: string }>("SELECT slug, name FROM terms WHERE taxonomy = 'category' ORDER BY name"),
      sections: sections.map((s) => ({ id: s.id, name: s.name })),
      popups: listPopups().filter((p) => !p.settings.trashed && p.settings.slug).map((p) => ({ slug: p.settings.slug, name: p.name })),
    },
  };
  return <BuilderShell init={full} />;
}

/** Active header/footer with its row version (editable by site managers). */
function tplMeta(kind: 'header' | 'footer') {
  const row = get<{ id: number; content: string; updated_at: string }>('SELECT id, content, updated_at FROM templates WHERE kind = ? AND active = 1 ORDER BY id DESC LIMIT 1', kind);
  return row ? { id: row.id, base: row.updated_at, nodes: parseDoc(row.content).nodes } : null;
}
/** Read-only context for editors who can't edit the header/footer. */
function ro(kind: 'header' | 'footer') {
  const t = getActiveTemplate(kind);
  return t ? { nodes: t.doc.nodes } : null;
}
