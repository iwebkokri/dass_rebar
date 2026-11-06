import Link from 'next/link';
import AdminNav, { type NavGroup } from '@/components/admin/AdminNav';
import { requireUser } from '@/lib/auth';
import { get } from '@/lib/db';
import { ROLE_LABEL, can, type Cap } from '@/lib/roles';
import { logoutAction } from '../actions';

export const dynamic = 'force-dynamic';

type Entry = { href: string; label: string; cap?: Cap; count?: number; sub?: boolean };

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(); // every page below calls requireUser()/requireCap() too — layouts aren't re-run on every navigation
  const newSubs = get<{ c: number }>("SELECT COUNT(*) AS c FROM submissions WHERE status = 'new'")?.c ?? 0;
  const pending = get<{ c: number }>("SELECT COUNT(*) AS c FROM comments WHERE status = 'pending'")?.c ?? 0;

  const nav: { heading?: string; items: Entry[] }[] = [
    { items: [{ href: '/admin', label: 'Dashboard' }] },
    {
      heading: 'Content',
      items: [
        { href: '/admin/pages', label: 'Pages', cap: 'edit_pages' },
        { href: '/admin/posts', label: 'Posts', cap: 'edit_posts' },
        { href: '/admin/categories', label: 'Categories', cap: 'manage_terms', sub: true },
        { href: '/admin/tags', label: 'Tags', cap: 'manage_terms', sub: true },
        { href: '/admin/comments', label: 'Comments', cap: 'moderate_comments', count: pending },
        { href: '/admin/media', label: 'Media', cap: 'upload_media' },
      ],
    },
    {
      heading: 'Design',
      items: [
        { href: '/admin/templates', label: 'Templates', cap: 'manage_site' },
        { href: '/admin/popups', label: 'Popups', cap: 'manage_forms' },
        { href: '/admin/menus', label: 'Menus', cap: 'manage_menus' },
      ],
    },
    {
      heading: 'Data',
      items: [
        { href: '/admin/forms', label: 'Forms', cap: 'manage_forms' },
        { href: '/admin/submissions', label: 'Submissions', cap: 'view_submissions', count: newSubs },
        { href: '/admin/projects', label: 'Projects', cap: 'manage_content' },
        { href: '/admin/products', label: 'Products', cap: 'manage_content' },
        { href: '/admin/bar-data', label: 'Bar data', cap: 'manage_content' },
      ],
    },
    {
      heading: 'Site',
      items: [
        { href: '/admin/users', label: 'Users', cap: 'manage_users' },
        { href: '/admin/seo', label: 'SEO & AI', cap: 'manage_seo' },
        { href: '/admin/tracking', label: 'Tracking & code', cap: 'manage_code' },
        { href: '/admin/redirects', label: 'Redirects', cap: 'manage_site' },
        { href: '/admin/tools', label: 'Import / Export', cap: 'manage_site' },
        { href: '/admin/activity', label: 'Activity log', cap: 'manage_site' },
        { href: '/admin/email', label: 'Email', cap: 'manage_email' },
        { href: '/admin/lead-manager', label: 'Lead Manager', cap: 'manage_integrations' },
        { href: '/admin/settings', label: 'Settings', cap: 'manage_settings' },
        { href: '/admin/account', label: 'My profile' },
      ],
    },
  ];
  const groups: NavGroup[] = nav
    .map((g) => ({ heading: g.heading, items: g.items.filter((i) => !i.cap || can(user, i.cap)).map(({ cap: _cap, ...rest }) => rest) }))
    .filter((g) => g.items.length);

  return (
    <div className="sc-shell">
      <aside className="sc-side">
        <Link href="/admin" className="sc-brand">
          <span className="sc-mark">DR</span>
          <div>
            <strong>Studio CMS</strong>
            <small>Dass Rebar</small>
          </div>
        </Link>
        <AdminNav groups={groups} />
        <div className="sc-side-foot">
          <Link href="/" target="_blank" rel="noopener" className="sc-back" style={{ alignSelf: 'flex-start' }}>View the site ↗</Link>
          <span className="sc-user">{user.name || user.email}<br /><span className="sc-faint">{ROLE_LABEL[user.role] ?? user.role}</span></span>
          <form action={logoutAction}>
            <button className="sc-btn sc-btn-sm" type="submit">Sign out</button>
          </form>
        </div>
      </aside>
      <main className="sc-main">{children}</main>
    </div>
  );
}
