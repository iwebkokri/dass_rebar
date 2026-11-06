// The editable page that runs inside the builder's iframe (same origin). Only for signed-in users who may use the builder.
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import CanvasApp from '@/components/builder/editor/CanvasApp';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/roles';
import { loadBuilderData } from '@/lib/builder/data';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Page builder canvas', robots: { index: false, follow: false } };

export default async function BuilderFrame() {
  const user = await requireUser();
  if (!can(user, 'use_builder')) redirect('/admin?error=forbidden');
  return <CanvasApp data={loadBuilderData('all')} />;
}
