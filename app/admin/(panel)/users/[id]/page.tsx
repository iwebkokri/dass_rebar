import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ConfirmButton from '@/components/admin/ConfirmButton';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { UsersResetForm } from '@/components/admin/UsersForms';
import { requireCap } from '@/lib/auth';
import { stamp } from '@/lib/format';
import { ROLES, ROLE_HELP, ROLE_LABEL } from '@/lib/roles';
import { adminCount, getUser, listUsers, ownedCounts } from '@/lib/users';
import { deleteUser, updateUser } from '../../../users/actions';
import '../../../css/users.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Edit user' };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<FlashParams> };

export default async function EditUser({ params, searchParams }: Props) {
  const me = await requireCap('manage_users');
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const user = getUser(Number(id));
  if (!user) notFound();

  const isMe = user.id === me.id;
  const lastAdmin = user.role === 'administrator' && adminCount() <= 1;
  const owned = ownedCounts(user.id);
  const others = listUsers().filter((u) => u.id !== user.id);
  const ownedText = [
    owned.posts && `${owned.posts} post${owned.posts === 1 ? '' : 's'}`,
    owned.pages && `${owned.pages} page${owned.pages === 1 ? '' : 's'}`,
    owned.templates && `${owned.templates} template${owned.templates === 1 ? '' : 's'}`,
    owned.media && `${owned.media} media file${owned.media === 1 ? '' : 's'}`,
  ].filter(Boolean).join(', ');

  return (
    <>
      <div className="sc-head">
        <div>
          <p style={{ margin: 0 }}><Link href="/admin/users" className="sc-muted">← Users</Link></p>
          <h1>{user.name || user.email}</h1>
          <p>{user.email} · last login {user.last_login_at ? stamp(user.last_login_at) : 'never'}</p>
        </div>
      </div>

      <Flash params={await searchParams} />

      <div className="sc-stack">
        <form action={updateUser.bind(null, user.id)} className="sc-card sc-form">
          <h2 style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Profile</h2>
          <div className="sc-field"><label htmlFor="e-name">Name</label><input className="sc-input" id="e-name" name="name" type="text" defaultValue={user.name} maxLength={80} /></div>
          <div className="sc-field"><label htmlFor="e-email">Email</label><input className="sc-input" id="e-email" name="email" type="email" defaultValue={user.email} maxLength={200} required /></div>
          <div className="sc-field is-wide">
            <label htmlFor="e-role">Role</label>
            <select className="sc-select" id="e-role" name="role" defaultValue={user.role} style={{ maxWidth: 260 }}>
              {ROLES.map((r) => (<option key={r} value={r}>{ROLE_LABEL[r]}</option>))}
            </select>
            <span className="sc-help">{ROLES.map((r) => `${ROLE_LABEL[r]}: ${ROLE_HELP[r]}`).join('  ')}</span>
            {lastAdmin && <span className="sc-help">This is the only administrator, so the role can’t be lowered until someone else is an administrator.</span>}
            {isMe && <span className="sc-help">You are editing your own account.</span>}
          </div>
          <div className="sc-form-actions">
            <button className="sc-btn sc-btn-primary" type="submit">Save changes</button>
            <Link className="sc-btn" href="/admin/users">Cancel</Link>
          </div>
        </form>

        {isMe ? (
          <div className="sc-card">
            <h2>Password</h2>
            <p className="sc-muted" style={{ margin: 0 }}>Change your own password under <Link className="sc-rowlink" href="/admin/account">My profile</Link>.</p>
          </div>
        ) : (
          <UsersResetForm id={user.id} />
        )}

        {!isMe && !lastAdmin && (
          <form action={deleteUser.bind(null, user.id)} className="sc-card sc-form sc-users-danger">
            <h2 style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Delete user</h2>
            <p className="sc-muted" style={{ gridColumn: '1 / -1', margin: 0 }}>
              {ownedText ? `${user.name || user.email} owns ${ownedText}. ` : 'This user does not own any content. '}
              Choose who takes over their posts, pages, templates and media — then the account is removed and they are signed out.
            </p>
            <div className="sc-field">
              <label htmlFor="d-heir">Move their content to</label>
              <select className="sc-select" id="d-heir" name="reassign_to" defaultValue={me.id} required>
                {others.map((u) => (<option key={u.id} value={u.id}>{u.name || u.email} ({ROLE_LABEL[u.role]}){u.id === me.id ? ' — you' : ''}</option>))}
              </select>
            </div>
            <div className="sc-form-actions">
              <ConfirmButton className="sc-btn sc-btn-danger" message={`Delete ${user.email}? This can't be undone.`}>Delete user</ConfirmButton>
            </div>
          </form>
        )}
        {(isMe || lastAdmin) && (
          <p className="sc-muted" style={{ margin: 0 }}>
            {isMe ? 'You can’t delete your own account.' : 'The last administrator can’t be deleted.'}
          </p>
        )}
      </div>
    </>
  );
}
