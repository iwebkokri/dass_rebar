import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { EXPORT_TYPES, buildExport, type ExportType } from '@/lib/transfer';

export const dynamic = 'force-dynamic';

// GET /admin/tools/export?include=pages&include=posts…  ->  dassrebar-export-YYYY-MM-DD.json (administrators only)
export async function GET(req: Request) {
  const user = await requireCap('manage_site');
  const wanted = new URL(req.url).searchParams.getAll('include');
  const types = EXPORT_TYPES.filter((t) => wanted.includes(t)) as ExportType[];
  if (!types.length) return new Response('Choose at least one thing to export.', { status: 400 });

  const body = JSON.stringify(buildExport(types));
  logActivity(user, 'export', 'site', '', `Exported ${types.join(', ')}`);
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dassrebar-export-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
