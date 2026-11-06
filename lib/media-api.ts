// Shared bits of the /api/media route handlers (JSON errors instead of redirects, same-origin check).
import { getCurrentUser, type AdminUser } from './auth';
import { can } from './roles';

export const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export const fail = (error: string, status: number) => json({ error }, status);

/** Signed-in user holding 'upload_media', or a ready-made 401 / 403 response. */
export async function mediaUser(req: Request, write = false): Promise<{ user: AdminUser } | { res: Response }> {
  if (write) {
    // belt and braces on top of SameSite=Lax cookies: refuse cross-origin writes
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) return { res: fail('Cross-origin requests are not allowed.', 403) };
      } catch {
        return { res: fail('Bad origin.', 403) };
      }
    }
  }
  const user = await getCurrentUser();
  if (!user) return { res: fail('Not signed in.', 401) };
  if (!can(user, 'upload_media')) return { res: fail('You are not allowed to use the media library.', 403) };
  return { user };
}
