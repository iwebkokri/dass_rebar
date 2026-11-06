import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activity';
import { getCurrentUser } from '@/lib/auth';
import { can } from '@/lib/roles';
import { MAX_IMPORT_BYTES, SUMMARY_TYPES, parseImportFile, runImport, type Counts, type SummaryType } from '@/lib/transfer';

export const dynamic = 'force-dynamic';

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

// POST /admin/tools/import  (multipart: file, mode = merge|replace, dry = 1|0, types = comma list)
// A route handler (not a server action) so the 20 MB limit isn't capped by the 12 MB server-action body limit.
export async function POST(req: Request) {
  // JSON-friendly auth (a redirect would be useless to fetch()): same rule as requireCap('manage_site').
  const user = await getCurrentUser();
  if (!user) return json({ ok: false, error: 'Your session has expired. Sign in again.' }, 401);
  if (!can(user, 'manage_site')) return json({ ok: false, error: 'You don’t have permission to import.' }, 403);
  if (req.headers.get('sec-fetch-site') && !['same-origin', 'none'].includes(req.headers.get('sec-fetch-site')!)) return json({ ok: false, error: 'Cross-site request blocked.' }, 403);

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_IMPORT_BYTES + 1024 * 1024) return json({ ok: false, error: 'That file is larger than 20 MB.' }, 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ ok: false, error: 'The upload could not be read.' }, 400);
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return json({ ok: false, error: 'Choose an export file first.' }, 400);
  if (file.size > MAX_IMPORT_BYTES) return json({ ok: false, error: 'That file is larger than 20 MB.' }, 413);

  const parsed = parseImportFile(await file.text());
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 422);

  const mode = form.get('mode') === 'replace' ? 'replace' : 'merge';
  const dryRun = form.get('dry') !== '0';
  const asked = String(form.get('types') ?? '').split(',').filter(Boolean);
  const present = SUMMARY_TYPES.filter((t) => parsed.data[t] !== undefined);
  const types = (asked.length ? present.filter((t) => asked.includes(t)) : present) as SummaryType[];
  if (!types.length) return json({ ok: false, error: 'Nothing selected to import.' }, 400);

  let summary;
  try {
    summary = runImport(parsed.data, { mode, types, dryRun, user });
  } catch (err) {
    return json({ ok: false, error: `The import failed and nothing was changed: ${err instanceof Error ? err.message : 'unknown error'}` }, 500);
  }

  if (!dryRun) {
    const total = (Object.values(summary) as Counts[]).reduce((n, c) => n + (c?.created ?? 0) + (c?.updated ?? 0), 0);
    logActivity(user, 'import', 'site', '', `Imported ${total} item${total === 1 ? '' : 's'} (${mode}): ${types.join(', ')}`);
    revalidatePath('/', 'layout');
  }
  return json({ ok: true, dry: dryRun, mode, present, types, exportedAt: parsed.exportedAt, ignored: parsed.ignored, summary });
}
