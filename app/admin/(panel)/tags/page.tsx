import type { Metadata } from 'next';
import type { FlashParams } from '@/components/admin/Flash';
import TermsScreen from '@/components/admin/TermsScreen';
import { requireCap } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tags' };

export default async function Page({ searchParams }: { searchParams: Promise<FlashParams & { edit?: string }> }) {
  await requireCap('manage_terms');
  const sp = await searchParams;
  return <TermsScreen taxonomy="tag" flash={sp} editId={Math.trunc(Number(sp.edit)) || 0} />;
}
