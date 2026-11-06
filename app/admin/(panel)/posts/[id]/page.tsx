import type { Metadata } from 'next';
import type { FlashParams } from '@/components/admin/Flash';
import PostEditor from '@/components/admin/PostEditor';
import { requireCap } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit post' };

export default async function EditPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<FlashParams> }) {
  const user = await requireCap('edit_posts');
  return <PostEditor idParam={(await params).id} user={user} flash={await searchParams} />;
}
