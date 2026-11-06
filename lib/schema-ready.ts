// "Is the database up to date for the new features?" — migrations only run when a process OPENS the database. A server that was started
// before a migration existed (e.g. a long-running `npm run dev` that hot-reloaded newer code) keeps its old connection until it is
// restarted, so code that touches new tables / columns must fail soft there instead of throwing. Visitors' form submissions in
// particular must never be lost because of it.
//
// Nothing here is cached: PRAGMA reads are microseconds, and it keeps the answer truthful if the file changes under a running process.
import { all, get } from './db';

/** Schema version the email log, Lead Manager log, lead attribution and popups need (migrations 4 and 5 in lib/db-core.mjs). */
export const REQUIRED_SCHEMA = 5;

export const NOT_READY_MESSAGE = 'The database is still updating — restart the app to finish.';

export function dbReady(): boolean {
  try {
    return (get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0) >= REQUIRED_SCHEMA;
  } catch {
    return false;
  }
}

/** Does `table` have `column` right now? */
export function hasColumn(table: string, column: string): boolean {
  try {
    return all<{ name: string }>(`PRAGMA table_info(${table.replace(/[^a-z_]/gi, '')})`).some((c) => c.name === column);
  } catch {
    return false;
  }
}

let warned = false;
/** One calm console line per process instead of an error per request. */
export function noteNotReady(what: string) {
  if (warned) return;
  warned = true;
  console.warn(`[db] ${what}: ${NOT_READY_MESSAGE}`);
}
