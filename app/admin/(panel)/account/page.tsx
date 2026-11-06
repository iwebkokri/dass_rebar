import { createHash } from 'node:crypto';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import ConfirmButton from '@/components/admin/ConfirmButton';
import Flash, { type FlashParams } from '@/components/admin/Flash';
import { SESSION_COOKIE, requireUser } from '@/lib/auth';
import { get } from '@/lib/db';
import { stamp } from '@/lib/format';
import { ROLE_HELP, ROLE_LABEL } from '@/lib/roles';
import { changePassword } from '../../actions';
import { signOutOtherSessions, updateProfile } from '../../account/actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'My profile' };

export default async function Account({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const me = await requireUser();
  const row = get<{ name: string; email: string; created_at: string; last_login_at: string | null }>('SELECT name, email, created_at, last_login_at FROM users WHERE id = ?', me.id);
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? '';
  const mine = createHash('sha256').update(token).digest('hex');
  const others = get<{ c: number }>('SELECT COUNT(*) AS c FROM sessions WHERE user_id = ? AND expires_at > ? AND token_hash != ?', me.id, Date.now(), mine)?.c ?? 0;

  return (
    <>
      <div className="sc-head">
        <div>
          <h1>My profile</h1>
          <p>Signed in as {me.email} · {ROLE_LABEL[me.role] ?? me.role}</p>
        </div>
      </div>

      <Flash params={await searchParams} />

      <div className="sc-stack">
        <form action={updateProfile} className="sc-card sc-form">
          <h2 style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Your details</h2>
          <div className="sc-field"><label htmlFor="p-name">Name</label><input className="sc-input" id="p-name" name="name" type="text" defaultValue={row?.name ?? ''} maxLength={80} autoComplete="name" /></div>
          <div className="sc-field"><label htmlFor="p-email">Email</label><input className="sc-input" id="p-email" name="email" type="email" defaultValue={row?.email ?? me.email} maxLength={200} required autoComplete="email" /></div>
          <div className="sc-field is-wide">
            <span className="sc-label">Role</span>
            <span>{ROLE_LABEL[me.role] ?? me.role}</span>
            <span className="sc-help">{ROLE_HELP[me.role]} Only an administrator can change roles.</span>
          </div>
          <div className="sc-form-actions"><button className="sc-btn sc-btn-primary" type="submit">Save profile</button></div>
        </form>

        <form action={changePassword} className="sc-card sc-form">
          <h2 style={{ gridColumn: '1 / -1', marginBottom: 0 }}>Change your password</h2>
          <div className="sc-field is-wide"><label htmlFor="current">Current password</label><input className="sc-input" id="current" name="current" type="password" autoComplete="current-password" required style={{ maxWidth: 360 }} /></div>
          <div className="sc-field"><label htmlFor="next">New password</label><input className="sc-input" id="next" name="next" type="password" autoComplete="new-password" minLength={10} required /><span className="sc-help">At least 10 characters, mixing three of: lower-case, upper-case, digits, symbols (or 16+ characters). Other devices are signed out.</span></div>
          <div className="sc-field"><label htmlFor="again">Repeat new password</label><input className="sc-input" id="again" name="again" type="password" autoComplete="new-password" minLength={10} required /></div>
          <div className="sc-form-actions"><button className="sc-btn sc-btn-primary" type="submit">Update password</button></div>
        </form>

        <form action={signOutOtherSessions} className="sc-card">
          <h2>Sessions</h2>
          <p className="sc-muted" style={{ margin: '0 0 14px' }}>
            {others > 0 ? `You are also signed in on ${others} other device${others === 1 ? '' : 's'}.` : 'This is the only device you are signed in on.'}
            {row?.last_login_at ? ` Last sign-in: ${stamp(row.last_login_at)}.` : ''}
          </p>
          <ConfirmButton className="sc-btn" message="Sign out of every other session? This device stays signed in.">Sign out of all other sessions</ConfirmButton>
        </form>
      </div>
    </>
  );
}
