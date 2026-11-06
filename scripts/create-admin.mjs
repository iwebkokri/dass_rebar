// Create (or reset) a Studio CMS login.
//   npm run admin:create -- you@example.com                          (administrator, generated password printed once)
//   npm run admin:create -- you@example.com "My Password1"           (your own password, min 10 characters)
//   npm run admin:create -- you@example.com --role=editor            (role: administrator | editor | author)
//   npm run admin:create -- you@example.com --reset                  (set a new password for an existing user)
//   npm run admin:create -- you@example.com --reset --role=author    (… and change their role)
import { randomBytes } from 'node:crypto';
import { openDatabase, getDatabasePath } from '../lib/db-core.mjs';
import { hashPassword } from '../lib/password.mjs';

const ROLES = ['administrator', 'editor', 'author'];
const args = process.argv.slice(2);
const reset = args.includes('--reset');
const roleArg = args.find((a) => a.startsWith('--role'));
let role = '';
if (roleArg) {
  role = roleArg.includes('=') ? roleArg.split('=')[1] : args[args.indexOf(roleArg) + 1] ?? '';
  if (!ROLES.includes(role)) {
    console.error(`Role must be one of: ${ROLES.join(', ')}.`);
    process.exit(1);
  }
}
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] === '--role'));
const [email, givenPassword] = positional;

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Usage: npm run admin:create -- <email> [password] [--role=administrator|editor|author] [--reset]');
  process.exit(1);
}
if (givenPassword && givenPassword.length < 10) {
  console.error('Password must be at least 10 characters.');
  process.exit(1);
}

const password = givenPassword || randomBytes(12).toString('base64url');
const db = openDatabase();
const existing = db.prepare('SELECT id, role FROM users WHERE email = ?').get(email);

if (existing && !reset) {
  console.error(`A user with ${email} already exists. Add --reset to set a new password.`);
  process.exit(1);
}

const hash = await hashPassword(password);
if (existing) {
  if (role && role !== existing.role) {
    const admins = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'administrator'").get().c;
    if (existing.role === 'administrator' && role !== 'administrator' && admins <= 1) {
      console.error('This is the only administrator; it cannot be changed to another role.');
      process.exit(1);
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, existing.id);
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id); // sign out everywhere
} else {
  db.prepare('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)').run(email, email.split('@')[0], hash, role || 'administrator');
}

const finalRole = existing ? role || existing.role : role || 'administrator';
console.log(`Database: ${getDatabasePath()}`);
console.log(existing ? `Password reset for ${email} (${finalRole})` : `User created: ${email} (${finalRole})`);
if (!givenPassword) console.log(`Password: ${password}   (shown once — change it under Studio CMS > My profile)`);
