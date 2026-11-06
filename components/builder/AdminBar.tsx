import type { AdminUser } from '@/lib/auth';
import { can } from '@/lib/roles';

/**
 * Slim bar shown to signed-in editors on the public site: jump into the builder or the admin.
 * Plain links (not next/link) on purpose: going to /admin must be a full page load, so no public-site tracking
 * script that is already running can follow the user into the admin.
 */
export default function AdminBar({ user, pageId, title, status }: { user: AdminUser; pageId?: number; title?: string; status?: string }) {
  return (
    <div className="dr-adminbar" role="region" aria-label="Site admin">
      <div className="dr-adminbar-in">
        <a href="/admin">Dashboard</a>
        {pageId && can(user, 'use_builder') ? (
          <>
            <a href={`/admin/builder/page-${pageId}`} className="dr-adminbar-primary">Edit with builder</a>
            <a href={`/admin/pages/${pageId}`}>Page settings</a>
          </>
        ) : null}
        {title ? <span className="dr-adminbar-note">{title}{status && status !== 'published' ? ` · ${status}` : ''}</span> : null}
        <span className="dr-adminbar-user">{user.email}</span>
      </div>
    </div>
  );
}
