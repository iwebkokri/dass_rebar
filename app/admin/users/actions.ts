'use server';

// User management — every action requires manage_users (administrators). Actions are public HTTP endpoints, so each one checks itself.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { get, run, transaction } from '@/lib/db';
import { hashPassword } from '@/lib/password.mjs';
import { ROLE_LABEL, isRole } from '@/lib/roles';
import { EMAIL_RE, adminCount, generatePassword, passwordProblem } from '@/lib/users';

export type UserFormState = {
  error?: string;
  /** Set after a successful create / reset. `password` is only present when it was generated (shown ONCE). */
  done?: { message: string; email: string; password?: string; id?: number };
};

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);

function go(pathname: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  redirect(qs ? `${pathname}?${qs}` : pathname);
}

/** Password from the form: either generated (shown once to the admin) or typed in. */
function chooseSecret(fd: FormData, who: { email: string; name: string }): { password: string; generated: boolean } | { error: string } {
  if (fd.get('password_mode') === 'manual') {
    const password = String(fd.get('password') ?? '');
    const problem = passwordProblem(password, who);
    return problem ? { error: problem } : { password, generated: false };
  }
  return { password: generatePassword(), generated: true };
}

export async function createUser(_prev: UserFormState, fd: FormData): Promise<UserFormState> {
  const me = await requireCap('manage_users');
  const email = clip(fd.get('email'), 200).toLowerCase();
  const name = clip(fd.get('name'), 80) || email.split('@')[0];
  const role = String(fd.get('role') ?? '');
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' };
  if (!isRole(role)) return { error: 'Choose a role.' };
  if (get('SELECT 1 AS x FROM users WHERE email = ?', email)) return { error: 'A user with that email already exists.' };
  const secret = chooseSecret(fd, { email, name });
  if ('error' in secret) return { error: secret.error };

  const id = run('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)', email, name, await hashPassword(secret.password), role).lastInsertRowid;
  logActivity(me, 'create', 'user', id, `Added ${ROLE_LABEL[role]} ${email}`);
  revalidatePath('/admin/users');
  return {
    done: {
      message: `${email} was added as ${ROLE_LABEL[role]}.`,
      email,
      id,
      password: secret.generated ? secret.password : undefined,
    },
  };
}

export async function updateUser(id: number, fd: FormData) {
  const me = await requireCap('manage_users');
  const here = `/admin/users/${id}`;
  const target = get<{ id: number; email: string; role: string }>('SELECT id, email, role FROM users WHERE id = ?', id);
  if (!target) go('/admin/users', { error: 'That user no longer exists.' });

  const email = clip(fd.get('email'), 200).toLowerCase();
  const name = clip(fd.get('name'), 80) || email.split('@')[0];
  const role = String(fd.get('role') ?? '');
  if (!EMAIL_RE.test(email)) go(here, { error: 'Enter a valid email address.' });
  if (!isRole(role)) go(here, { error: 'Choose a role.' });
  if (get('SELECT 1 AS x FROM users WHERE email = ? AND id != ?', email, id)) go(here, { error: 'Another user already has that email address.' });
  if (target.role === 'administrator' && role !== 'administrator' && adminCount() <= 1) {
    go(here, { error: 'This is the only administrator. Make someone else an administrator first.' });
  }

  run('UPDATE users SET email = ?, name = ?, role = ? WHERE id = ?', email, name, role, id);
  logActivity(me, 'update', 'user', id, `Updated ${email}${role !== target.role ? ` (role ${target.role} → ${role})` : ''}`);
  revalidatePath('/admin/users');
  go(here, { saved: '1' });
}

export async function resetUserPassword(id: number, _prev: UserFormState, fd: FormData): Promise<UserFormState> {
  const me = await requireCap('manage_users');
  const target = get<{ id: number; email: string; name: string }>('SELECT id, email, name FROM users WHERE id = ?', id);
  if (!target) return { error: 'That user no longer exists.' };
  if (target.id === me.id) return { error: 'Use “My profile” to change your own password.' };
  const secret = chooseSecret(fd, target);
  if ('error' in secret) return { error: secret.error };

  const hash = await hashPassword(secret.password);
  transaction(() => {
    run('UPDATE users SET password_hash = ? WHERE id = ?', hash, id);
    run('DELETE FROM sessions WHERE user_id = ?', id); // sign them out everywhere
  });
  logActivity(me, 'reset_password', 'user', id, `Reset the password of ${target.email}`);
  return {
    done: { message: 'Password updated. They have been signed out on every device.', email: target.email, password: secret.generated ? secret.password : undefined },
  };
}

export async function deleteUser(id: number, fd: FormData) {
  const me = await requireCap('manage_users');
  const here = `/admin/users/${id}`;
  const target = get<{ id: number; email: string; role: string }>('SELECT id, email, role FROM users WHERE id = ?', id);
  if (!target) go('/admin/users', { error: 'That user no longer exists.' });
  if (id === me.id) go(here, { error: 'You can’t delete your own account.' });
  if (target.role === 'administrator' && adminCount() <= 1) go(here, { error: 'You can’t delete the last administrator.' });

  const to = Math.trunc(Number(fd.get('reassign_to')));
  if (!Number.isInteger(to) || to <= 0 || to === id) go(here, { error: 'Choose who should take over this user’s posts, pages and media.' });
  const heir = get<{ id: number; email: string }>('SELECT id, email FROM users WHERE id = ?', to);
  if (!heir) go(here, { error: 'The user you chose to take over no longer exists.' });

  transaction(() => {
    run('UPDATE posts SET author_id = ? WHERE author_id = ?', to, id);
    run('UPDATE pages SET author_id = ? WHERE author_id = ?', to, id);
    run('UPDATE templates SET author_id = ? WHERE author_id = ?', to, id);
    run('UPDATE media SET user_id = ? WHERE user_id = ?', to, id);
    run('DELETE FROM users WHERE id = ?', id); // sessions go with it (ON DELETE CASCADE)
  });
  logActivity(me, 'delete', 'user', id, `Deleted ${target.email}; content moved to ${heir.email}`);
  revalidatePath('/admin/users');
  go('/admin/users', { saved: '1' });
}
