import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

// The old "Insights" screen is now Posts.
export default async function Page() {
  await requireUser();
  redirect('/admin/posts');
}
