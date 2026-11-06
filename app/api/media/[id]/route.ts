import { logActivity } from '@/lib/activity';
import { deleteMedia, findUsage, getMedia, replaceMediaFile, updateMedia, UploadError } from '@/lib/media';
import { fail, json, mediaUser } from '@/lib/media-api';

// GET    /api/media/<id>[?usage=1]  one record (+ where it is used)
// PATCH  /api/media/<id>            JSON { alt, title, caption, folder }
// POST   /api/media/<id>            multipart "file": replace the file, keeping the URL and the record
// DELETE /api/media/<id>
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
const idOf = async (ctx: Ctx) => {
  const n = Number((await ctx.params).id);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

export async function GET(req: Request, ctx: Ctx) {
  const a = await mediaUser(req);
  if ('res' in a) return a.res;
  const item = getMedia(a.user, await idOf(ctx));
  if (!item) return fail('Not found.', 404);
  return json(new URL(req.url).searchParams.get('usage') ? { ...item, usage: findUsage(item.url) } : item);
}

export async function PATCH(req: Request, ctx: Ctx) {
  const a = await mediaUser(req, true);
  if ('res' in a) return a.res;
  const id = await idOf(ctx);
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail('Bad request.', 400);
  }
  try {
    const item = updateMedia(a.user, id, { alt: body?.alt, title: body?.title, caption: body?.caption, folder: body?.folder });
    logActivity(a.user, 'update', 'media', id, `Edited details of ${item.original_name || item.filename}`);
    return json(item);
  } catch (err) {
    return err instanceof UploadError ? fail(err.message, 403) : fail('Could not save.', 500);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const a = await mediaUser(req, true);
  if ('res' in a) return a.res;
  const id = await idOf(ctx);
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return fail('The upload could not be read.', 400);
  }
  const file = fd.get('file');
  if (!(file instanceof File) || file.size === 0) return fail('Choose a file.', 400);
  try {
    const item = await replaceMediaFile(a.user, id, file);
    logActivity(a.user, 'replace', 'media', id, `Replaced the file of ${item.original_name || item.filename}`);
    return json(item);
  } catch (err) {
    if (err instanceof UploadError) return fail(err.message, 400);
    console.error('media replace failed', err);
    return fail('The file could not be saved.', 500);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const a = await mediaUser(req, true);
  if ('res' in a) return a.res;
  const id = await idOf(ctx);
  const r = await deleteMedia(a.user, id);
  if (!r.ok) return fail('You are not allowed to delete this file.', 403);
  logActivity(a.user, 'delete', 'media', id, `Deleted ${r.name}`);
  return json({ ok: true });
}
