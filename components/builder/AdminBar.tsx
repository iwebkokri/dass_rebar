import Link from 'next/link';
import type { AdminUser } from '@/lib/auth';
import { can } from '@/lib/roles';

/** Slim bar shown to signed-in editors on the public site: jump into the builder or the admin. */
export default function AdminBar({ user, pageId, title, status }: { user: AdminUser; pageId?: number; title?: string; status?: string }) {
  return (
    <div className="dr-adminbar" role="region" aria-label="Site admin">
      <div className="dr-adminbar-in">
        <Link href="/admin" prefetch={false}>Dashboard</Link>
        {pageId && can(user, 'use_builder') ? (
          <>
            <Link href={`/admin/builder/page-${pageId}`} prefetch={false} className="dr-adminbar-primary">Edit with builder</Link>
            <Link href={`/admin/pages/${pageId}`} prefetch={false}>Page settings</Link>
          </>
        ) : null}
        {title ? <span className="dr-adminbar-note">{title}{status && status !== 'published' ? ` · ${status}` : ''}</span> : null}
        <span className="dr-adminbar-user">{user.email}</span>
      </div>
    </div>
  );
}
