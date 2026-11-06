import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { MEDIA_TYPES, extOf } from '@/lib/media-types';
import { safeJoin, uploadsDir } from '@/lib/uploads';

// Next.js only serves files that existed in /public at build time, so everything uploaded through the
// Studio CMS (stored in data/uploads) is served by this route instead: correct content types, HTTP Range
// (video seeking), ETag / 304, long immutable caching and nosniff.
export const dynamic = 'force-dynamic';

const IMMUTABLE = 'public, max-age=31536000, immutable'; // file names are unique per upload
// A file that was REPLACED in place keeps its URL, so it must not be cached "forever" any more.
const REVALIDATE = 'public, max-age=0, must-revalidate';

function parseRange(header: string, size: number): { start: number; end: number } | 'invalid' | null {
  const m = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return header.includes(',') ? null : 'invalid'; // multi-range: just send the whole file
  let start: number;
  let end: number;
  if (m[1] === '') {
    const n = Number(m[2]); // suffix: the last n bytes
    if (!n) return 'invalid';
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size || start > end) return 'invalid';
  return { start, end };
}

async function serve(req: Request, ctx: { params: Promise<{ path: string[] }> }, head: boolean) {
  const { path: parts } = await ctx.params;
  // path-traversal protection: no empty / dot segments, no separators or drive/stream colons, and the resolved path must stay inside uploads/
  if (!parts.length || parts.some((p) => !p || p === '.' || p === '..' || /[\\:\u0000]/.test(p))) return new Response('Not found', { status: 404 });
  const ext = extOf(parts[parts.length - 1] ?? '');
  const rule = MEDIA_TYPES[ext];
  const file = safeJoin(uploadsDir(), ...parts);
  if (!rule || !file) return new Response('Not found', { status: 404 });

  let st;
  try {
    st = await stat(file);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!st.isFile()) return new Response('Not found', { status: 404 });

  const size = st.size;
  const modified = st.birthtimeMs > 0 && st.mtimeMs - st.birthtimeMs > 3000;
  const etag = `W/"${size.toString(16)}-${Math.trunc(st.mtimeMs).toString(16)}"`;
  const headers: Record<string, string> = {
    'Content-Type': rule.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': modified ? REVALIDATE : IMMUTABLE,
    'X-Content-Type-Options': 'nosniff',
    ETag: etag,
    'Last-Modified': st.mtime.toUTCString(),
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  };
  // images, video and PDF show inline; everything else is a download, so an uploaded file can never run as a page
  if (rule.kind !== 'image' && rule.kind !== 'video' && ext !== 'pdf') {
    const name = parts[parts.length - 1].replace(/[^\w.\- ()]+/g, '_');
    headers['Content-Disposition'] = `attachment; filename="${name}"`;
  }
  if (ext === 'pdf') delete headers['Content-Security-Policy']; // the built-in PDF viewer needs to load its own resources

  if (req.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers });

  const range = req.headers.get('range');
  let start = 0;
  let end = size - 1;
  let status = 200;
  if (range && size > 0) {
    const ifRange = req.headers.get('if-range');
    if (!ifRange || ifRange === etag || ifRange === headers['Last-Modified']) {
      const r = parseRange(range, size);
      if (r === 'invalid') return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } });
      if (r) {
        ({ start, end } = r);
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      }
    }
  }
  headers['Content-Length'] = String(size === 0 ? 0 : end - start + 1);
  if (head || size === 0) return new Response(null, { status, headers });

  const stream = createReadStream(file, { start, end });
  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, { status, headers });
}

export const GET = (req: Request, ctx: { params: Promise<{ path: string[] }> }) => serve(req, ctx, false);
export const HEAD = (req: Request, ctx: { params: Promise<{ path: string[] }> }) => serve(req, ctx, true);
