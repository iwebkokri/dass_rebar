// Time helpers for posts. published_at is stored in UTC ('YYYY-MM-DD HH:MM:SS', or the legacy date-only 'YYYY-MM-DD' = midnight UTC).
// The admin edits dates in site time (Toronto). Pure functions — safe in client components too.

const TZ = 'America/Toronto';

/** Current time as a SQLite UTC stamp: 'YYYY-MM-DD HH:MM:SS'. */
export function nowStamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

const parts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function tzFields(ms: number) {
  const p = parts.formatToParts(new Date(ms));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return { y: g('year'), mo: g('month'), d: g('day'), h: g('hour'), mi: g('minute'), s: g('second') };
}

/** Minutes to add to UTC to get Toronto wall-clock time at that instant (negative: -300 / -240). */
function offsetMinutes(ms: number): number {
  const f = tzFields(ms);
  return Math.round((Date.UTC(f.y, f.mo - 1, f.d, f.h, f.mi, f.s) - Math.floor(ms / 1000) * 1000) / 60000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Stored stamp -> value for <input type="datetime-local"> in Toronto time. Legacy date-only values stay at 00:00 of that date. */
export function stampToLocalInput(stamp: string): string {
  if (!stamp) return '';
  if (stamp.length <= 10) return `${stamp}T00:00`;
  const ms = Date.parse(stamp.replace(' ', 'T') + 'Z');
  if (Number.isNaN(ms)) return '';
  const f = tzFields(ms);
  return `${f.y}-${pad(f.mo)}-${pad(f.d)}T${pad(f.h)}:${pad(f.mi)}`;
}

/** <input type="datetime-local"> value (Toronto time) -> stored UTC stamp, or null if it isn't a valid date. */
export function localInputToStamp(v: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(guess) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const first = guess - offsetMinutes(guess) * 60000;
  const ms = guess - offsetMinutes(first) * 60000;
  return new Date(ms).toISOString().slice(0, 19).replace('T', ' ');
}

/** The calendar date ('YYYY-MM-DD') of a stored stamp, in Toronto time — what readers should see on a card. */
export function stampToLocalDate(stamp: string): string {
  if (stamp.length <= 10) return stamp;
  return stampToLocalInput(stamp).slice(0, 10);
}

/** Is this stamp later than now? (drives "Scheduled") */
export function isFuture(stamp: string): boolean {
  return !!stamp && stamp > nowStamp();
}
