'use server';

// Server actions of the Media library screen. Every one starts with requireCap('upload_media'); lib/media.ts then enforces ownership
// (authors: own uploads only; 'public' storage items can't be deleted or replaced).
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { deleteMedia, findUsage, getMedia, moveMedia, updateMedia, UploadError, type MediaItem, type Usage } from '@/lib/media';

const refresh = () => revalidatePath('/admin/media');
const cleanIds = (ids: unknown): number[] =>
  Array.isArray(ids) ? [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 200) : [];

export type SaveResult = { ok: boolean; item?: MediaItem; error?: string };

export async function updateMediaAction(id: number, data: { alt?: string; title?: string; caption?: string; folder?: string }): Promise<SaveResult> {
  const user = await requireCap('upload_media');
  try {
    const item = updateMedia(user, Number(id), {
      alt: typeof data?.alt === 'string' ? data.alt : undefined,
      title: typeof data?.title === 'string' ? data.title : undefined,
      caption: typeof data?.caption === 'string' ? data.caption : undefined,
      folder: typeof data?.folder === 'string' ? data.folder : undefined,
    });
    logActivity(user, 'update', 'media', id, `Edited details of ${item.original_name || item.filename}`);
    refresh();
    return { ok: true, item };
  } catch (err) {
    return { ok: false, error: err instanceof UploadError ? err.message : 'Could not save.' };
  }
}

/** Where each of these files is used (so the UI can warn before deleting). */
export async function mediaUsageAction(ids: number[]): Promise<{ id: number; name: string; usage: Usage[] }[]> {
  const user = await requireCap('upload_media');
  return cleanIds(ids)
    .map((id) => getMedia(user, id))
    .filter((m): m is MediaItem => !!m)
    .map((m) => ({ id: m.id, name: m.original_name || m.filename, usage: findUsage(m.url) }));
}

export type DeleteResult = { ok: boolean; deleted: number; skipped: number; message: string };

export async function deleteMediaAction(ids: number[]): Promise<DeleteResult> {
  const user = await requireCap('upload_media');
  let deleted = 0;
  let skipped = 0;
  for (const id of cleanIds(ids)) {
    const r = await deleteMedia(user, id);
    if (r.ok) {
      deleted++;
      logActivity(user, 'delete', 'media', id, `Deleted ${r.name}`);
    } else skipped++;
  }
  refresh();
  const message =
    `${deleted} file${deleted === 1 ? '' : 's'} deleted.` + (skipped ? ` ${skipped} skipped (site images and other people's uploads can't be deleted by you).` : '');
  return { ok: deleted > 0 || skipped === 0, deleted, skipped, message };
}

export async function moveMediaAction(ids: number[], folder: string): Promise<{ ok: boolean; moved: number; message: string }> {
  const user = await requireCap('upload_media');
  const moved = moveMedia(user, cleanIds(ids), String(folder ?? ''));
  if (moved) logActivity(user, 'update', 'media', cleanIds(ids).join(','), `Moved ${moved} file${moved === 1 ? '' : 's'} to folder “${String(folder).slice(0, 40) || '(none)'}”`);
  refresh();
  return { ok: moved > 0, moved, message: moved ? `${moved} file${moved === 1 ? '' : 's'} moved.` : 'Nothing was moved.' };
}
