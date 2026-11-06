// User management helpers (queries + password rules). Used by /admin/users, /admin/account and the CLI-free flows.
import { randomInt } from 'node:crypto';
import { all, get } from './db';
import type { Role } from './roles';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UserRow = {
  id: number;
  email: string;
  name: string;
  role: Role;
  created_at: string;
  last_login_at: string | null;
  posts: number;
  pages: number;
};

export function listUsers(): UserRow[] {
  return all<UserRow>(
    `SELECT u.id, u.email, u.name, u.role, u.created_at, u.last_login_at,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status != 'trash') AS posts,
            (SELECT COUNT(*) FROM pages g WHERE g.author_id = u.id AND g.status != 'trash') AS pages
     FROM users u ORDER BY u.id`
  );
}

export function getUser(id: number): UserRow | undefined {
  return get<UserRow>(
    `SELECT u.id, u.email, u.name, u.role, u.created_at, u.last_login_at,
            (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id AND p.status != 'trash') AS posts,
            (SELECT COUNT(*) FROM pages g WHERE g.author_id = u.id AND g.status != 'trash') AS pages
     FROM users u WHERE u.id = ?`,
    id
  );
}

export const adminCount = () => get<{ c: number }>("SELECT COUNT(*) AS c FROM users WHERE role = 'administrator'")?.c ?? 0;

/** Everything a user "owns" that must be handed to someone else before the account can go. */
export function ownedCounts(id: number) {
  const n = (sql: string) => get<{ c: number }>(sql, id)?.c ?? 0;
  return {
    posts: n('SELECT COUNT(*) AS c FROM posts WHERE author_id = ?'),
    pages: n('SELECT COUNT(*) AS c FROM pages WHERE author_id = ?'),
    templates: n('SELECT COUNT(*) AS c FROM templates WHERE author_id = ?'),
    media: n('SELECT COUNT(*) AS c FROM media WHERE user_id = ?'),
  };
}

const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGIT = '23456789';
const SYMBOL = '!@#$%^&*-_=+?';

/** 16 random characters (no look-alikes such as 0/O or l/1) with at least one of each kind. */
export function generatePassword(): string {
  const pick = (set: string) => set[randomInt(set.length)];
  const all_ = LOWER + UPPER + DIGIT + SYMBOL;
  const chars = [pick(LOWER), pick(UPPER), pick(DIGIT), pick(SYMBOL)];
  while (chars.length < 16) chars.push(pick(all_));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

const COMMON = ['password', 'passw0rd', 'letmein', 'welcome', 'qwerty', 'admin', 'dassrebar', '1234567890', '0123456789', 'iloveyou'];

/** Returns a human-readable problem, or '' when the password is acceptable (>= 10 chars, not trivially guessable). */
export function passwordProblem(pw: string, who: { email?: string; name?: string } = {}): string {
  if (pw.length < 10) return 'The password must be at least 10 characters.';
  if (pw.length > 200) return 'The password is too long (200 characters at most).';
  const lower = pw.toLowerCase();
  if (/^(.)\1+$/.test(pw)) return 'The password is too easy to guess (one repeated character).';
  if (COMMON.some((c) => lower.includes(c))) return 'The password contains a very common word. Choose something less guessable.';
  const local = (who.email ?? '').split('@')[0].toLowerCase();
  if (local.length >= 4 && lower.includes(local)) return 'The password must not contain the email name.';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3 && !(pw.length >= 16 && classes >= 2)) return 'Use at least three of: lower-case, upper-case, digits, symbols (or 16+ characters).';
  return '';
}
