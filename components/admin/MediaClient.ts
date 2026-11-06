// Browser-side helpers for the media API (used by MediaPicker, MediaField and the library page).
import type { MediaItem, MediaList } from '@/lib/media-types';

export type ListParams = { kind?: string; q?: string; folder?: string; date?: string; page?: number; per?: number };

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function problem(status: number, body: any): string {
  if (body?.error) return String(body.error);
  if (status === 401) return 'Your session has expired. Sign in again and retry.';
  if (status === 403) return 'You are not allowed to do that.';
  if (status === 413) return 'That file is too large for the server.';
  return `Request failed (${status}).`;
}

export async function fetchMedia(p: ListParams, signal?: AbortSignal): Promise<MediaList> {
  const qs = new URLSearchParams();
  if (p.kind) qs.set('kind', p.kind);
  if (p.q) qs.set('q', p.q);
  if (p.folder) qs.set('folder', p.folder);
  if (p.date) qs.set('date', p.date);
  if (p.page) qs.set('page', String(p.page));
  if (p.per) qs.set('per', String(p.per));
  const res = await fetch(`/api/media?${qs}`, { credentials: 'same-origin', cache: 'no-store', signal });
  const body = await readJson(res);
  if (!res.ok) throw new Error(problem(res.status, body));
  return body as MediaList;
}

/** Upload one file (XHR so we get progress events). Resolves with the new media record. */
export function uploadMedia(file: File, opts: { folder?: string; onProgress?: (pct: number) => void } = {}): Promise<MediaItem> {
  return sendFile('/api/media', file, opts);
}

/** Replace the file of an existing record (same URL, same record). */
export function replaceMediaFile(id: number, file: File, opts: { onProgress?: (pct: number) => void } = {}): Promise<MediaItem> {
  return sendFile(`/api/media/${id}`, file, opts);
}

function sendFile(url: string, file: File, opts: { folder?: string; onProgress?: (pct: number) => void }): Promise<MediaItem> {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    if (opts.folder) fd.append('folder', opts.folder);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'json';
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new Error('Network error while uploading.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.onload = () => {
      let body: any = xhr.response;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          body = {};
        }
      }
      if (xhr.status >= 200 && xhr.status < 300 && body && body.id) {
        opts.onProgress?.(100);
        resolve(body as MediaItem);
      } else reject(new Error(problem(xhr.status, body)));
    };
    xhr.send(fd);
  });
}

export async function patchMedia(id: number, data: Partial<Pick<MediaItem, 'alt' | 'title' | 'caption' | 'folder'>>): Promise<MediaItem> {
  const res = await fetch(`/api/media/${id}`, {
    method: 'PATCH',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const body = await readJson(res);
  if (!res.ok) throw new Error(problem(res.status, body));
  return body as MediaItem;
}

/** Absolute URL of a media item (for "Copy URL"). */
export const absoluteUrl = (url: string) => (/^https?:\/\//i.test(url) ? url : `${window.location.origin}${url}`);
