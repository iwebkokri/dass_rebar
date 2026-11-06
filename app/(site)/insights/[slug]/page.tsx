import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PageShell from '@/components/builder/PageShell';
import PostArticle from '@/components/PostArticle';
import { getCurrentUser } from '@/lib/auth';
import { getPostBySlug } from '@/lib/content';
import { can } from '@/lib/roles';
import { postJsonLd, postMetadata } from '@/lib/seo';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

/**
 * Public: published posts whose date has arrived. With ?preview=1 a signed-in user who may edit the post
 * also sees drafts and scheduled posts (marked as a preview, never indexed).
 */
async function load(slug: string, wantsPreview: boolean) {
  const post = getPostBySlug(slug);
  if (post) return { post, preview: false };
  if (!wantsPreview) return null;
  const user = await getCurrentUser();
  if (!user || !can(user, 'edit_posts')) return null;
  const draft = getPostBySlug(slug, { preview: true });
  if (!draft || (draft.author_id !== user.id && !can(user, 'edit_others_posts'))) return null;
  return { post: draft, preview: true };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const found = await load((await params).slug, (await searchParams).preview === '1');
  if (!found) return { title: 'Article not found', robots: { index: false, follow: false } };
  const { post, preview } = found;
  return postMetadata(post as any, { preview });
}

// Articles written in the Studio CMS. (Posts that have an "External link" go straight to that URL from the Insights list.)
export default async function Page({ params, searchParams }: Props) {
  const found = await load((await params).slug, (await searchParams).preview === '1');
  if (!found) notFound();
  return (
    <PageShell path={`insights/${found.post.slug}`} nodes={[]} jsonld={found.preview ? [] : postJsonLd({ ...(found.post as any), tags: found.post.tags })}>
      <PostArticle post={found.post} preview={found.preview} />
    </PageShell>
  );
}
