import type { Metadata } from 'next';
import Link from 'next/link';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { ToolsExport } from '@/components/admin/ToolsExport';
import { ToolsImport } from '@/components/admin/ToolsImport';
import { requireCap } from '@/lib/auth';
import { can } from '@/lib/roles';
import { EXPORT_TYPES, SUMMARY_LABEL, TYPE_LABEL, countsForExport } from '@/lib/transfer';
import '../../css/tools.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Import / Export' };

export default async function ToolsPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const user = await requireCap('manage_site');
  const counts = countsForExport();
  const items = EXPORT_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t], count: counts[t] }));

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Import / Export</h1>
          <p>Move content between sites, or keep a backup of it.</p>
        </div>
      </div>

      <Flash params={await searchParams} />

      <div className="sc-stack">
        <ToolsExport items={items} />
        <ToolsImport labels={SUMMARY_LABEL} />

        <div className="sc-card sc-tools-extra">
          <h2>Also good to know</h2>
          <ul>
            {can(user, 'view_submissions') && (
              <li><a className="sc-rowlink" href="/admin/submissions/export">Export submissions as CSV</a> — form entries are not part of the JSON export (see also <Link className="sc-rowlink" href="/admin/submissions">Submissions</Link>).</li>
            )}
            <li><strong>Uploaded files</strong> live in the <code>data/uploads</code> folder on the server and are not part of the export. Copy that folder by hand when you move the site (the media records above tell the new site which files to expect). Customer attachments in <code>data/private</code> stay private and are never exported.</li>
            <li>Users, passwords and sessions are never exported or imported. Add people under <Link className="sc-rowlink" href="/admin/users">Users</Link>.</li>
            <li>Page content is re-checked on import, exactly like a page saved in the builder. Custom HTML widgets are only kept when an administrator imports.</li>
          </ul>
        </div>
      </div>
    </>
  );
}
