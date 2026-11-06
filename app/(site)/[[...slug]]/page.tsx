// Every public page is a builder document stored in the database. Home is slug [] ; /about is ['about'] ; nested paths work too.
// Static routes (admin, api, uploads, insights/[slug]) take precedence over this catch-all.
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import PageShell from '@/components/builder/PageShell';
import { getCurrentUser } from '@/lib/auth';
import { nowUtc } from '@/lib/page-admin';
import { getPageByPath, normPath, pageDoc } from '@/lib/pages';
import { findRedirect } from '@/lib/redirects';
import { can } from '@/lib/roles';
import { pageJsonLd, pageMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug?: string[] }> };

async function load(slug: string[] | undefined) {
  const path = normPath((slug || []).map(decodeURIComponent).join('/'));
  const user = await getCurrentUser();
  const preview = can(user, 'edit_pages');
  const page = getPageByPath(path, preview);
  // draft or scheduled (only editors get this far): shown, but never indexed
  const draft = !!page && (page.status !== 'published' || (!!page.published_at && page.published_at > nowUtc()));
  return { path, page, draft };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page, draft } = await load((await params).slug);
  if (!page) return { title: 'Page not found', robots: { index: false, follow: false } };
  return pageMetadata(page, { draft });
}

export default async function Page({ params }: Props) {
  const { path, page, draft } = await load((await params).slug);
  if (!page) {
    const r = findRedirect(path);
    if (r) {
      const target = /^https?:\/\//i.test(r.to) || r.to.startsWith('/') ? r.to : `/${r.to}`;
      if (r.code === 301 || r.code === 308) permanentRedirect(target);
      redirect(target);
    }
    notFound(); // (the 404 page records the hit for SEO → 404 monitor)
  }
  const nodes = pageDoc(page).nodes;
  return <PageShell path={page.path} nodes={nodes} layout={page.layout} page={page} jsonld={draft ? [] : pageJsonLd(page, nodes)} />;
}
