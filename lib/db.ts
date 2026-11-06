import { openDatabase } from './db-core.mjs';

type Param = string | number | bigint | null | Uint8Array;

const g = globalThis as unknown as { __dassDb?: any };

/** One shared connection per Node process (cached across dev hot reloads). Opened lazily, never at build time. */
export function getDb() {
  if (!g.__dassDb) g.__dassDb = openDatabase();
  return g.__dassDb;
}

// node:sqlite returns null-prototype row objects; copy to plain objects so they can be
// passed to client components.
const plain = <T>(row: any): T => ({ ...row }) as T;

export function all<T = any>(sql: string, ...params: Param[]): T[] {
  return getDb().prepare(sql).all(...params).map((r: any) => plain<T>(r));
}

export function get<T = any>(sql: string, ...params: Param[]): T | undefined {
  const row = getDb().prepare(sql).get(...params);
  return row ? plain<T>(row) : undefined;
}

export function run(sql: string, ...params: Param[]): { changes: number; lastInsertRowid: number } {
  const r = getDb().prepare(sql).run(...params);
  return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
}

/** Run several statements atomically. */
export function transaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ---- settings (key/value) ----
export function getSetting(key: string, fallback = ''): string {
  return get<{ value: string }>('SELECT value FROM settings WHERE key = ?', key)?.value ?? fallback;
}

export function setSetting(key: string, value: string) {
  run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
