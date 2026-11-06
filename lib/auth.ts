import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { get, run } from './db';
import { DUMMY_HASH, verifyPassword } from './password.mjs';
import { UNKNOWN_CLIENT, clear, clientKey, hit, isBlocked } from './ratelimit';
import { type Cap, type Role, can } from './roles';

export const SESSION_COOKIE = 'studio_session';
const SESSION_DAYS = 7;
const LOGIN_LIMIT = 8; // failed attempts …
const LOGIN_WINDOW = 15 * 60 * 1000; // … per 15 minutes, per IP and per email

export type AdminUser = { id: number; email: string; name: string; role: Role };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function cookieSecure() {
  if (process.env.COOKIE_SECURE) return process.env.COOKIE_SECURE === 'true';
  return process.env.NODE_ENV === 'production';
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  run('INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)', userId, sha256(token), expires);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure(),
    path: '/',
    expires: new Date(expires),
  });
}

export async function getCurrentUser(): Promise<AdminUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const user = get<AdminUser>(
    `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`,
    sha256(token),
    Date.now()
  );
  return user ?? null;
}

/** Call at the top of EVERY admin page, route handler and server action (layouts alone are not enough). */
export async function requireUser(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/admin/login');
  return user;
}

/** Like requireUser(), but the signed-in user must also hold this capability (see lib/roles.ts). */
export async function requireCap(cap: Cap): Promise<AdminUser> {
  const user = await requireUser();
  if (!can(user, cap)) redirect('/admin?error=forbidden');
  return user;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  jar.delete(SESSION_COOKIE);
}

export type LoginResult = { ok: true; user: AdminUser } | { ok: false; reason: 'invalid' | 'rate' };

/** Check credentials with per-IP and per-email throttling. */
export async function authenticate(email: string, password: string): Promise<LoginResult> {
  const visitor = await clientKey();
  const ipLimit = visitor === UNKNOWN_CLIENT ? LOGIN_LIMIT * 5 : LOGIN_LIMIT; // host not passing IPs: don't let one bucket lock everyone out
  const ipKey = `login:ip:${visitor}`;
  const emailKey = `login:email:${sha256(email.toLowerCase()).slice(0, 24)}`;
  if (isBlocked(ipKey, ipLimit) || isBlocked(emailKey, LOGIN_LIMIT)) return { ok: false, reason: 'rate' };

  const row = get<AdminUser & { password_hash: string }>('SELECT id, email, name, role, password_hash FROM users WHERE email = ?', email);
  // Always run a hash so response time doesn't reveal whether the email exists
  const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);

  if (!row || !valid) {
    hit(ipKey, ipLimit, LOGIN_WINDOW);
    hit(emailKey, LOGIN_LIMIT, LOGIN_WINDOW);
    return { ok: false, reason: 'invalid' };
  }
  clear(ipKey);
  clear(emailKey);
  run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", row.id);
  return { ok: true, user: { id: row.id, email: row.email, name: row.name, role: row.role } };
}
