import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getDataDir } from './db-core.mjs';

export class UploadError extends Error {}

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

/** Public images uploaded through the CMS — served by app/uploads/[...path]/route.ts */
export const uploadsDir = () => path.join(getDataDir(), 'uploads');
/** Customer drawings sent through the forms — never public, only downloadable by a signed-in admin. */
export const privateDir = () => path.join(getDataDir(), 'private');

export const IMAGE_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
};

/**
 * Save an image chosen in the CMS and return its public URL (e.g. /uploads/2026/11/photo-ab12cd.jpg).
 * The file is verified by its real bytes, stored under uploads/YYYY/MM/ and registered in the media library (owner = the signed-in user).
 */
export async function saveImage(file: File, userId?: number | null): Promise<string> {
  const { createMediaFromFile } = await import('./media'); // dynamic: media.ts imports this file
  let uid = userId;
  if (uid === undefined) {
    try {
      uid = (await (await import('./auth')).getCurrentUser())?.id ?? null;
    } catch {
      uid = null; // not inside a request (scripts)
    }
  }
  const rec = await createMediaFromFile(file, uid ? { id: uid } : null, { imagesOnly: true });
  return rec.url;
}

const ATTACHMENT_EXT = new Set(['pdf', 'dwg', 'dxf', 'xls', 'xlsx', 'csv', 'doc', 'docx', 'txt', 'png', 'jpg', 'jpeg', 'zip']);

export type StoredAttachment = { name: string; file: string; size: number };

/** Validate a customer's file (size + type) and return its sanitized name. Throws UploadError. */
export function checkAttachment(file: File): string {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new UploadError(`"${file.name}" is larger than ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB.`);
  const original = path.basename(file.name).replace(/[^\w.\- ()]+/g, '_').slice(0, 120) || 'file';
  const ext = original.split('.').pop()!.toLowerCase();
  if (!ATTACHMENT_EXT.has(ext)) throw new UploadError(`"${file.name}": this file type isn't accepted (PDF, DWG, DXF, XLS/XLSX, CSV, DOC/DOCX, images or ZIP).`);
  return original;
}

/** Save a customer's drawing/bar list under data/private/submissions/<id>/. */
export async function saveAttachment(submissionId: number, file: File): Promise<StoredAttachment> {
  const original = checkAttachment(file);
  const stored = `${randomBytes(4).toString('hex')}-${original}`;
  const dir = path.join(privateDir(), 'submissions', String(submissionId));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, stored), Buffer.from(await file.arrayBuffer()));
  return { name: original, file: stored, size: file.size };
}

/** Resolve `parts` inside `root`, or null if it would escape it (path traversal). */
export function safeJoin(root: string, ...parts: string[]): string | null {
  const resolved = path.resolve(root, ...parts);
  return resolved.startsWith(path.resolve(root) + path.sep) ? resolved : null;
}
