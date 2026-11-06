import { after, NextResponse } from 'next/server';
import { cleanAttribution, type Attribution } from '@/lib/attribution';
import { getCurrentUser } from '@/lib/auth';
import { safeUrl } from '@/lib/builder/url.mjs';
import { get, transaction } from '@/lib/db';
import { getForm, parseCustomForm } from '@/lib/forms';
import { forwardLead } from '@/lib/leadmanager';
import { notifyLead } from '@/lib/mailer';
import { UNKNOWN_CLIENT, clientKey, hit, sweep } from '@/lib/ratelimit';
import { cleanSourcePath, insertSubmission, parseSubmission, setAttachments, type NewSubmission } from '@/lib/submissions';
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, UploadError, checkAttachment, saveAttachment, type StoredAttachment } from '@/lib/uploads';

export const dynamic = 'force-dynamic';

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Where the lead came from: the page the form was on (sent by the widget, else the Referer) and the popup it was inside, if any. */
type Source = { url: string; label: string; attribution: Attribution };
function sourceOf(req: Request, fd: FormData): Source {
  let url = cleanSourcePath(fd.get('_src'));
  if (!url) {
    try {
      const ref = new URL(req.headers.get('referer') || '');
      const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
      if (ref.host === host) url = cleanSourcePath(ref.pathname + ref.search);
    } catch {
      /* no / invalid referer */
    }
  }
  let label = '';
  const popup = String(fd.get('_popup') || '');
  if (/^\d{1,9}$/.test(popup)) {
    const p = get<{ name: string }>("SELECT name FROM templates WHERE id = ? AND kind = 'popup'", Number(popup));
    if (p) label = `Popup: ${p.name}`.slice(0, 160);
  }
  // first-touch attribution (utm_*, landing page, referrer) captured in the browser's sessionStorage — validated to plain text here
  return { url, label, attribution: cleanAttribution(fd.get('_attr')) };
}

// POST /api/forms   (multipart/form-data: type=contact|quote|calculator|newsletter + the form's fields,
//                    or type=form + form_id=<forms.id> + one value per field keyed by the field id — the Custom form widget;
//                    optional _src=<page path> and _popup=<popup id> say where the form was shown)
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

  const src = sourceOf(req, fd);
  const siteOrigin = origin || (host ? `https://${host}` : '');
  if (String(fd.get('type') || '') === 'form') return customForm(fd, src, siteOrigin);

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

  return finish(parsed.row, src, files.map((file) => ({ file, label: '' })), siteOrigin);
}

// A form built in the Studio CMS: validate against its definition, store as type 'form:<slug>', then email.
async function customForm(fd: FormData, src: Source, siteOrigin: string) {
  const formId = String(fd.get('form_id') || '');
  const def = /^\d{1,9}$/.test(formId) ? getForm(Number(formId)) : undefined;
  if (!def) return json({ ok: false, error: 'This form is no longer available.' }, 404);

  const parsed = parseCustomForm(def, fd);
  if ('error' in parsed) return json({ ok: false, error: parsed.error }, 400);

  const res = await finish(parsed.row, src, parsed.files, siteOrigin, true);
  if (res.status !== 200) return res;
  const redirect = safeUrl(def.settings.redirectUrl || '');
  return json({ ok: true, ...(def.settings.successMessage ? { message: def.settings.successMessage } : {}), ...(redirect ? { redirect } : {}) });
}

/** Store the submission (+ private files), then email the owner AFTER the response — mail trouble never reaches the visitor. */
async function finish(row: NewSubmission, src: Source, files: Array<{ file: File; label: string }>, siteOrigin: string, labelled = false) {
  row.source_url = src.url;
  row.source_label = src.label;
  row.attribution = src.attribution as Record<string, string>;
  const id = transaction(() => insertSubmission(row));

  const stored: Array<StoredAttachment & { field?: string }> = [];
  for (const { file, label } of files) stored.push({ ...(await saveAttachment(id, file)), ...(labelled && label ? { field: label } : {}) });
  if (stored.length) setAttachments(id, stored);

  // Two independent jobs after the response: the owner email and the Lead Manager forward. Each catches its own errors, so one failing
  // never affects the other or the visitor. `staff` = a signed-in CMS user (their test submissions are not forwarded unless allowed).
  const staff = !!(await getCurrentUser().catch(() => null));
  after(() => notifyLead(id, siteOrigin));
  after(() => forwardLead(id, { origin: siteOrigin, staff }));
  return json({ ok: true });
}
