import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { get, run } from './db';

export const UNKNOWN_CLIENT = 'unknown';

/**
 * Client IP as seen behind Hostinger's proxy, hashed. Only used as a rate-limit key — it is never stored
 * with submissions. Returns UNKNOWN_CLIENT if the proxy passes no address; callers then use a looser limit
 * so that one shared bucket can't lock out every visitor.
 */
export async function clientKey(): Promise<string> {
  const h = await headers();
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || '';
  return ip ? createHash('sha256').update(ip).digest('hex').slice(0, 24) : UNKNOWN_CLIENT;
}

/**
 * Fixed-window counter stored in SQLite. Returns true if the action is allowed
 * (and counts it), false once `limit` hits within `windowMs` have been reached.
 */
export function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const row = get<{ count: number; reset_at: number }>('SELECT count, reset_at FROM rate_limits WHERE key = ?', key);
  if (!row || row.reset_at <= now) {
    run(
      'INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, reset_at = excluded.reset_at',
      key,
      now + windowMs
    );
    return true;
  }
  if (row.count >= limit) return false;
  run('UPDATE rate_limits SET count = count + 1 WHERE key = ?', key);
  return true;
}

/** Peek without counting. */
export function isBlocked(key: string, limit: number): boolean {
  const row = get<{ count: number; reset_at: number }>('SELECT count, reset_at FROM rate_limits WHERE key = ?', key);
  return !!row && row.reset_at > Date.now() && row.count >= limit;
}

export function clear(key: string) {
  run('DELETE FROM rate_limits WHERE key = ?', key);
}

/** Housekeeping: drop expired counters and sessions. Cheap; called occasionally. */
export function sweep() {
  const now = Date.now();
  run('DELETE FROM rate_limits WHERE reset_at <= ?', now);
  run('DELETE FROM sessions WHERE expires_at <= ?', now);
}
