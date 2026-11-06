import type { Metadata } from 'next';
import Link from 'next/link';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { requireCap } from '@/lib/auth';
import { stamp } from '@/lib/format';
import { ROLES, ROLE_HELP, ROLE_LABEL, roleCan, type Cap } from '@/lib/roles';
import { listUsers } from '@/lib/users';
import '../../css/users.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Users' };

// What each capability means in plain words (rows of the role reference table).
const CAPABILITIES: Array<[Cap, string]> = [
  ['manage_users', 'Add, edit and remove users'],
  ['manage_settings', 'Site settings, branding, colours, email recipients'],
  ['manage_site', 'Header / footer templates, forms, redirects, import / export, activity log'],
  ['manage_menus', 'Edit menus'],
  ['use_builder', 'Open the page builder'],
  ['edit_pages', 'Create and edit pages'],
  ['publish_pages', 'Publish pages'],
  ['delete_pages', 'Delete pages'],
  ['edit_posts', 'Write their own posts'],
  ['edit_others_posts', 'Edit posts written by others'],
  ['publish_posts', 'Publish posts'],
  ['delete_posts', 'Delete posts'],
  ['manage_terms', 'Categories and tags'],
  ['upload_media', 'Upload to the media library'],
  ['edit_others_media', 'Edit media uploaded by others'],
  ['moderate_comments', 'Approve / trash comments'],
  ['view_submissions', 'Read and export form submissions'],
  ['manage_content', 'Projects, products and bar data'],
];

export default async function UsersPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const me = await requireCap('manage_users');
  const users = listUsers();

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>Users</h1>
          <p>{users.length} {users.length === 1 ? 'user' : 'users'} can sign in to this CMS.</p>
        </div>
        <div className="sc-actions">
          <Link className="sc-btn sc-btn-primary" href="/admin/users/new">Add user</Link>
        </div>
      </div>

      <Flash params={await searchParams} />

      <div className="sc-tablewrap">
        <table className="sc-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th><th className="sc-num">Posts</th><th>Created</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="sc-strong"><Link className="sc-rowlink" href={`/admin/users/${u.id}`}>{u.name || '(no name)'}</Link>{u.id === me.id && <span className="sc-badge" style={{ marginLeft: 8 }}>you</span>}</td>
                <td>{u.email}</td>
                <td><span className={`sc-badge sc-users-role sc-users-role-${u.role}`}>{ROLE_LABEL[u.role] ?? u.role}</span></td>
                <td className="sc-muted">{u.last_login_at ? stamp(u.last_login_at) : 'Never'}</td>
                <td className="sc-num">{u.posts}{u.pages > 0 && <span className="sc-muted" title={`${u.pages} page${u.pages === 1 ? '' : 's'}`}> · {u.pages}p</span>}</td>
                <td className="sc-muted">{stamp(u.created_at)}</td>
                <td className="sc-num"><Link className="sc-btn sc-btn-sm" href={`/admin/users/${u.id}`}>Edit</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sc-card sc-users-roles">
        <h2>What each role can do</h2>
        <div className="sc-tablewrap" style={{ border: 0 }}>
          <table className="sc-table">
            <thead>
              <tr><th>Capability</th>{ROLES.map((r) => (<th key={r} className="sc-users-cap">{ROLE_LABEL[r]}</th>))}</tr>
            </thead>
            <tbody>
              {CAPABILITIES.map(([cap, text]) => (
                <tr key={cap}>
                  <td>{text}</td>
                  {ROLES.map((r) => (<td key={r} className="sc-users-cap">{roleCan(r, cap) ? <span className="sc-users-yes" aria-label="Yes">✓</span> : <span className="sc-faint" aria-label="No">—</span>}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="sc-users-help">
          {ROLES.map((r) => (<li key={r}><strong>{ROLE_LABEL[r]}.</strong> {ROLE_HELP[r]}</li>))}
        </ul>
      </div>
    </>
  );
}
