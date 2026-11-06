import type { Metadata } from 'next';
import type { FlashParams } from '@/components/admin/Flash';
import PostEditor from '@/components/admin/PostEditor';
import { requireCap } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Add new post' };

export default async function NewPostPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const user = await requireCap('edit_posts');
  return <PostEditor idParam="new" user={user} flash={await searchParams} />;
}
