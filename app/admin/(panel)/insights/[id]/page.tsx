import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

// Old links: /admin/insights/new and /admin/insights/<id> (same ids as Posts).
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  if (id !== 'new' && !/^\d+$/.test(id)) notFound();
  redirect(`/admin/posts/${id}`);
}
