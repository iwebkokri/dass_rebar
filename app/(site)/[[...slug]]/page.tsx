// Every public page is a builder document stored in the database. Home is slug [] ; /about is ['about'] ; nested paths work too.
// Static routes (admin, api, uploads, insights/[slug]) take precedence over this catch-all.
import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import PageShell from '@/components/builder/PageShell';
import { getCurrentUser } from '@/lib/auth';
import { getPageByPath, normPath, pageDoc } from '@/lib/pages';
import { findRedirect } from '@/lib/redirects';
import { can } from '@/lib/roles';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug?: string[] }> };

async function load(slug: string[] | undefined) {
  const path = normPath((slug || []).map(decodeURIComponent).join('/'));
  const user = await getCurrentUser();
  const preview = can(user, 'edit_pages');
  const page = getPageByPath(path, preview);
  return { path, page, draft: !!page && page.status !== 'published' };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { page, draft } = await load((await params).slug);
  if (!page) return { title: 'Page not found' };
  const image = page.og_image || undefined;
  return {
    title: page.seo_title || (page.path === '' ? undefined : page.title),
    description: page.seo_description || undefined,
    openGraph: image ? { images: [image] } : undefined,
    robots: page.noindex || draft ? { index: false, follow: false } : undefined,
  };
}

export default async function Page({ params }: Props) {
  const { path, page } = await load((await params).slug);
  if (!page) {
    const r = findRedirect(path);
    if (r) {
      const target = /^https?:\/\//i.test(r.to) || r.to.startsWith('/') ? r.to : `/${r.to}`;
      if (r.code === 301 || r.code === 308) permanentRedirect(target);
      redirect(target);
    }
    notFound();
  }
  return <PageShell path={page.path} nodes={pageDoc(page).nodes} layout={page.layout} page={page} />;
}
