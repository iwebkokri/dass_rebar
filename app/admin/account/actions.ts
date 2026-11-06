'use server';

// "My profile" actions — any signed-in user may change their OWN details.
import { createHash } from 'node:crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { SESSION_COOKIE, requireUser } from '@/lib/auth';
import { get, run } from '@/lib/db';
import { EMAIL_RE } from '@/lib/users';

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);

function go(params: Record<string, string>): never {
  redirect(`/admin/account?${new URLSearchParams(params)}`);
}

export async function updateProfile(fd: FormData) {
  const user = await requireUser();
  const email = clip(fd.get('email'), 200).toLowerCase();
  const name = clip(fd.get('name'), 80) || email.split('@')[0];
  if (!EMAIL_RE.test(email)) go({ error: 'Enter a valid email address.' });
  if (get('SELECT 1 AS x FROM users WHERE email = ? AND id != ?', email, user.id)) go({ error: 'Another user already has that email address.' });
  run('UPDATE users SET email = ?, name = ? WHERE id = ?', email, name, user.id);
  logActivity({ id: user.id, email }, 'update', 'user', user.id, 'Updated their own profile');
  revalidatePath('/admin', 'layout');
  go({ saved: '1' });
}

/** Delete every session of this user except the one making the request. */
export async function signOutOtherSessions() {
  const user = await requireUser();
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? '';
  const mine = createHash('sha256').update(token).digest('hex');
  const r = run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', user.id, mine);
  logActivity(user, 'sign_out_others', 'user', user.id, `Signed out ${r.changes} other session${r.changes === 1 ? '' : 's'}`);
  go({ saved: '1' });
}
