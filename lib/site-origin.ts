// The public address of the site as last seen in a request — a fallback for links inside emails and webhook payloads when neither the
// Email page's "Public site address" nor SITE_URL is set (development). Process-wide, survives hot reloads.
import { siteBase } from './mail-settings';

const g = globalThis as unknown as { __dassOrigin?: string };

export function rememberOrigin(origin: string | undefined | null) {
  if (origin && /^https?:\/\/[^\s/]+$/i.test(origin)) g.__dassOrigin = origin;
}

export const knownOrigin = () => g.__dassOrigin || '';

/** Configured address (Email page → SITE_URL) first, else the last request origin, else ''. No trailing slash. */
export const publicBase = (hint?: string) => siteBase(hint || knownOrigin());
