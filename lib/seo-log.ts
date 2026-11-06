// 404 monitor: public "page not found" hits, one row per path (SEO → 404 monitor). Capped so it can't grow without limit.
import { all, get, run } from './db';

export type NotFoundRow = { id: number; path: string; hits: number; referrer: string; ignored: number; first_seen: string; last_seen: string };

const MAX_ROWS = 500;

/** Obvious bot noise and static assets: not worth listing. */
const NOISE = /^\/(wp-|xmlrpc|\.env|\.git|phpmyadmin|cgi-bin|vendor\/|_next\/|api\/|uploads\/|images\/|\.well-known\/|favicon|apple-touch|sitemap|robots\.txt|llms)|\.(php\d?|asp|aspx|jsp|cgi|env|git|ico|png|jpe?g|gif|svg|webp|avif|css|js|mjs|map|woff2?|ttf|otf|eot|json|xml|txt|zip|sql|bak|rar|gz|7z|tar|mp4|webm|mp3|pdf|yml|yaml|ini|log)$/i;

export const isNoise = (path: string) => NOISE.test(path);

/** Record a missing public path. Never throws (this runs while a page is being rendered). */
export function log404(rawPath: string, referrer = '') {
  try {
    let path = '/' + String(rawPath || '').replace(/^\/+/, '').split(/[?#]/)[0];
    path = path.replace(/\/{2,}/g, '/');
    if (path.length > 1) path = path.replace(/\/+$/, '');
    path = path.slice(0, 300);
    if (!path || path === '/' || isNoise(path) || /[\u0000-\u001f<>"'\\]/.test(path)) return;
    const ref = String(referrer || '').slice(0, 300);
    const have = get<{ id: number }>('SELECT id FROM not_found_log WHERE path = ? COLLATE NOCASE', path);
    if (have) {
      run("UPDATE not_found_log SET hits = hits + 1, last_seen = datetime('now'), referrer = CASE WHEN ? <> '' THEN ? ELSE referrer END WHERE id = ?", ref, ref, have.id);
      return;
    }
    run('INSERT INTO not_found_log (path, referrer) VALUES (?, ?)', path, ref);
    run('DELETE FROM not_found_log WHERE id NOT IN (SELECT id FROM not_found_log ORDER BY last_seen DESC, id DESC LIMIT ?)', MAX_ROWS);
  } catch { /* monitoring must never break a page */ }
}

export function list404(opts: { ignored?: boolean; limit?: number } = {}): NotFoundRow[] {
  return all<NotFoundRow>('SELECT * FROM not_found_log WHERE ignored = ? ORDER BY hits DESC, last_seen DESC LIMIT ?', opts.ignored ? 1 : 0, opts.limit ?? 200);
}

export const count404 = (): number => get<{ c: number }>('SELECT COUNT(*) AS c FROM not_found_log WHERE ignored = 0')?.c ?? 0;

export const get404 = (id: number) => get<NotFoundRow>('SELECT * FROM not_found_log WHERE id = ?', id);
export const setIgnored = (id: number, ignored: boolean) => run('UPDATE not_found_log SET ignored = ? WHERE id = ?', ignored ? 1 : 0, id).changes;
export const remove404 = (id: number) => run('DELETE FROM not_found_log WHERE id = ?', id).changes;
export const clear404 = (includeIgnored = false) => run(includeIgnored ? 'DELETE FROM not_found_log' : 'DELETE FROM not_found_log WHERE ignored = 0').changes;
