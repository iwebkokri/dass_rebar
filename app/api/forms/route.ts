import { NextResponse } from 'next/server';
import { safeUrl } from '@/lib/builder/url.mjs';
import { transaction } from '@/lib/db';
import { describeCustom, getForm, parseCustomForm } from '@/lib/forms';
import { sendNotification } from '@/lib/mail';
import { UNKNOWN_CLIENT, clientKey, hit, sweep } from '@/lib/ratelimit';
import { describe, insertSubmission, parseSubmission, setAttachments } from '@/lib/submissions';
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, UploadError, checkAttachment, saveAttachment, type StoredAttachment } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// POST /api/forms   (multipart/form-data: type=contact|quote|calculator|newsletter + the form's fields,
//                    or type=form + form_id=<forms.id> + one value per field keyed by the field id — the Custom form widget)
export async function POST(req: Request) {
  // Browsers always send Origin on cross-site POSTs — refuse ones that don't come from this site.
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (origin && host && new URL(origin).host !== host) return json({ ok: false, error: 'Forbidden.' }, 403);

  const length = Number(req.headers.get('content-length') || 0);
  if (length > (MAX_ATTACHMENTS * MAX_ATTACHMENT_BYTES) + 1024 * 1024) return json({ ok: false, error: 'That upload is too large.' }, 413);

  // 12 submissions per hour per visitor is plenty for real people (looser if the host hides visitor IPs)
  const visitor = await clientKey();
  if (!hit(`form:${visitor}`, visitor === UNKNOWN_CLIENT ? 300 : 12, 60 * 60 * 1000)) {
    return json({ ok: false, error: 'Too many requests — please try again in a little while, or call us on (905) 813-3014.' }, 429);
  }
  if (Math.random() < 0.02) sweep();

  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return json({ ok: false, error: 'Invalid request.' }, 400);
  }

  // Honeypot: real visitors never see or fill this field. Pretend it worked so bots don't retry.
  if (String(fd.get('website') || '').trim()) return json({ ok: true });

  if (String(fd.get('type') || '') === 'form') return customForm(fd, origin, host);

  const parsed = parseSubmission(String(fd.get('type') || ''), fd);
  if ('error' in parsed) return json({ ok: false, error: parsed.error }, 400);

  // Drawings / bar lists (contact + quote only). Check them all BEFORE anything is saved.
  const files = parsed.row.type === 'contact' || parsed.row.type === 'quote' ? fd.getAll('files').filter((f): f is File => f instanceof File && f.size > 0) : [];
  if (files.length > MAX_ATTACHMENTS) return json({ ok: false, error: `Please attach no more than ${MAX_ATTACHMENTS} files.` }, 400);
  try {
    files.forEach(checkAttachment);
  } catch (err) {
    if (err instanceof UploadError) return json({ ok: false, error: err.message }, 400);
    throw err;
  }

  const id = transaction(() => insertSubmission(parsed.row));

  const stored: StoredAttachment[] = [];
  for (const file of files) stored.push(await saveAttachment(id, file));
  if (stored.length) setAttachments(id, stored);

  const siteOrigin = origin || `https://${host}`;
  // Fire and forget — the visitor shouldn't wait on the mail server.
  void sendNotification(`New ${parsed.row.type} submission${parsed.row.name ? ` from ${parsed.row.name}` : ''}`, describe(parsed.row, id, stored.length, siteOrigin), parsed.row.email);

  return json({ ok: true });
}

// A form built in the Studio CMS: validate against its definition, store as type 'form:<slug>', email its recipients.
async function customForm(fd: FormData, origin: string | null, host: string | null) {
  const formId = String(fd.get('form_id') || '');
  const def = /^\d{1,9}$/.test(formId) ? getForm(Number(formId)) : undefined;
  if (!def) return json({ ok: false, error: 'This form is no longer available.' }, 404);

  const parsed = parseCustomForm(def, fd);
  if ('error' in parsed) return json({ ok: false, error: parsed.error }, 400);

  const id = transaction(() => insertSubmission(parsed.row));

  // Files are stored privately, exactly like the quote / contact drawings (data/private/submissions/<id>/).
  const stored: Array<StoredAttachment & { field: string }> = [];
  for (const { file, label } of parsed.files) stored.push({ ...(await saveAttachment(id, file)), field: label });
  if (stored.length) setAttachments(id, stored);

  const siteOrigin = origin || `https://${host}`;
  void sendNotification(`New "${def.name}" submission${parsed.row.name ? ` from ${parsed.row.name}` : ''}`, describeCustom(def, parsed.row, id, stored.length, siteOrigin), parsed.row.email, parsed.recipients);

  const redirect = safeUrl(def.settings.redirectUrl || '');
  return json({ ok: true, ...(def.settings.successMessage ? { message: def.settings.successMessage } : {}), ...(redirect ? { redirect } : {}) });
}
