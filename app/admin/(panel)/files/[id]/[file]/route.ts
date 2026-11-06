import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { requireCap } from '@/lib/auth';
import { get } from '@/lib/db';
import { privateDir, safeJoin } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

// Customer drawings are private: only a signed-in admin can download them, always as an attachment.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string; file: string }> }) {
  await requireCap('view_submissions');
  const { id, file } = await ctx.params;
  if (!/^\d+$/.test(id)) return new Response('Not found', { status: 404 });

  const sub = get<{ attachments: string }>('SELECT attachments FROM submissions WHERE id = ?', Number(id));
  const entry = (JSON.parse(sub?.attachments || '[]') as Array<{ name: string; file: string }>).find((a) => a.file === file);
  // Only files recorded on this submission can be fetched — the URL never picks a path by itself.
  const full = entry && safeJoin(path.join(privateDir(), 'submissions'), id, entry.file);
  if (!entry || !full) return new Response('Not found', { status: 404 });

  try {
    const data = await readFile(full);
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(entry.name)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
