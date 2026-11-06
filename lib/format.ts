/** "2026-11-01" -> "NOV 1, 2026" (the style used on the Insights cards). */
export function cardDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).replace('.', '').toUpperCase();
}

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) -> readable Toronto time for the CMS. */
export function stamp(sqliteUtc: string): string {
  const d = new Date(sqliteUtc.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return sqliteUtc;
  return d.toLocaleString('en-CA', { timeZone: 'America/Toronto', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
