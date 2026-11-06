import { requireCap } from '@/lib/auth';
import { all, get } from '@/lib/db';
import { isCustomType, isKnownType } from '@/lib/submissions';

export const dynamic = 'force-dynamic';

// A cell starting with = + - @ would run as a formula when opened in Excel — neutralise it.
function cell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

// GET /admin/submissions/export?status=&type=
export async function GET(req: Request) {
  await requireCap('view_submissions');
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? '';
  const type = url.searchParams.get('type') ?? '';

  const where: string[] = [];
  const args: string[] = [];
  if (['new', 'read', 'archived'].includes(status)) { where.push('status = ?'); args.push(status); }
  if (isKnownType(type)) { where.push('type = ?'); args.push(type); }

  const rows = all<any>(`SELECT * FROM submissions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY id DESC`, ...args);
  // One custom form: a column per question (in the form's field order, then any answers from fields that were later removed).
  if (isCustomType(type)) {
    const def = get<{ fields: string }>('SELECT fields FROM forms WHERE slug = ?', type.slice(5));
    const keys: string[] = [];
    try { for (const f of JSON.parse(def?.fields || '[]')) if (f?.label && !keys.includes(f.label)) keys.push(f.label); } catch { /* ignore */ }
    const parsed = rows.map((r) => { try { return JSON.parse(r.data || '{}') as Record<string, unknown>; } catch { return {}; } });
    for (const d of parsed) for (const k of Object.keys(d)) if (!keys.includes(k)) keys.push(k);
    const out = [['id', 'received_utc', 'status', ...keys, 'attachments', 'notes'].map(cell).join(',')];
    rows.forEach((r, i) => out.push([r.id, r.created_at, r.status, ...keys.map((k) => parsed[i][k]), JSON.parse(r.attachments || '[]').length, r.notes].map(cell).join(',')));
    return csv(out, type.slice(5));
  }

  const header = ['id', 'received_utc', 'form', 'status', 'name', 'email', 'phone', 'company', 'message', 'details', 'attachments', 'notes'];
  const lines = [header.map(cell).join(',')];
  for (const r of rows) {
    lines.push(
      [r.id, r.created_at, r.type, r.status, r.name, r.email, r.phone, r.company, r.message, r.data, JSON.parse(r.attachments || '[]').length, r.notes].map(cell).join(',')
    );
  }

  return csv(lines);
}

function csv(lines: string[], name = '') {
  return new Response('\uFEFF' + lines.join('\r\n'), { // BOM so Excel reads UTF-8 correctly
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="submissions-${name ? `${name}-` : ''}${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
