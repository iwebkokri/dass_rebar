import type { Metadata } from 'next';
import Link from 'next/link';
import '../../../css/pages.css';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import PagesNewForm from '@/components/admin/PagesNewForm';
import { requireCap } from '@/lib/auth';
import { all } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Add new page' };

type SP = FlashParams & { title?: string; path?: string; layout?: string; source?: string; sp?: string; st?: string };

export default async function NewPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireCap('edit_pages');
  const sp = await searchParams;
  const pages = all<{ id: number; title: string; path: string }>("SELECT id, title, path FROM pages WHERE status <> 'trash' ORDER BY title");
  const templates = all<{ id: number; name: string }>("SELECT id, name FROM templates WHERE kind = 'page' ORDER BY name");

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Add new page</h1>
          <p>Name it, choose where it lives, then design it in the page builder.</p>
        </div>
        <div className="sc-actions">
          <Link className="sc-btn" href="/admin/pages">← All pages</Link>
        </div>
      </div>

      <Flash params={{ error: sp.error }} />
      <PagesNewForm
        pages={pages}
        templates={templates}
        initial={{ title: sp.title ?? '', path: sp.path ?? '', layout: sp.layout ?? 'default', source: sp.source ?? 'blank', sp: sp.sp ?? '', st: sp.st ?? '' }}
      />
    </>
  );
}
