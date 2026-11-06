import { logActivity } from '@/lib/activity';
import { createMediaFromFile, getMedia, listMedia, UploadError } from '@/lib/media';
import { fail, json, mediaUser } from '@/lib/media-api';

// GET  /api/media?kind=&q=&folder=&date=&page=&per=  ->  { items, total, page, pages, folders }
// POST /api/media (multipart, field "file", optional "folder")  ->  the new media record
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const a = await mediaUser(req);
  if ('res' in a) return a.res;
  const sp = new URL(req.url).searchParams;
  return json(
    listMedia(a.user, {
      kind: sp.get('kind') ?? '',
      q: sp.get('q') ?? '',
      folder: sp.get('folder') ?? '',
      date: sp.get('date') ?? '',
      page: Number(sp.get('page')) || 1,
      per: Number(sp.get('per')) || undefined,
    })
  );
}

export async function POST(req: Request) {
  const a = await mediaUser(req, true);
  if ('res' in a) return a.res;
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return fail('The upload could not be read.', 400);
  }
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('Choose a file to upload.', 400);
  try {
    const rec = await createMediaFromFile(file, a.user, { folder: String(fd.get('folder') ?? ''), alt: String(fd.get('alt') ?? '') });
    logActivity(a.user, 'upload', 'media', rec.id, `Uploaded ${rec.original_name || rec.filename}`);
    return json(getMedia(a.user, rec.id), 201);
  } catch (err) {
    if (err instanceof UploadError) return fail(err.message, 400);
    console.error('media upload failed', err);
    return fail('The file could not be saved.', 500);
  }
}
