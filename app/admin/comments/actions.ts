'use server';

// Comment moderation. One action handles the bulk bar (<select name="bulk"> + ids[]) and the per-row buttons (name="op" value="approve:12").
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { COMMENT_LIMITS } from '@/lib/comments';
import { all, run, transaction } from '@/lib/db';

function go(pathname: string, params: Record<string, string> = {}): never {
  const qs = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v))).toString();
  redirect(qs ? `${pathname}${pathname.includes('?') ? '&' : '?'}${qs}` : pathname);
}

function safeBack(v: FormDataEntryValue | null): string {
  const s = String(v ?? '');
  return /^\/admin\/comments(\?|$)/.test(s) && !s.includes('//') && !/[\r\n]/.test(s) ? s : '/admin/comments';
}

function backWith(back: string, params: Record<string, string>): never {
  const [path, qs = ''] = back.split('?');
  const q = new URLSearchParams(qs);
  for (const k of ['saved', 'error', 'warn']) q.delete(k);
  const rest = q.toString();
  return go(rest ? `${path}?${rest}` : path, params);
}

const clean = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);

type Row = { id: number; post_id: number; status: string; author_name: string };
const STATUS_OF: Record<string, string> = { approve: 'approved', unapprove: 'pending', spam: 'spam', trash: 'trash', restore: 'pending', notspam: 'pending' };
const LABEL: Record<string, string> = {
  approve: 'Approved', unapprove: 'Unapproved', spam: 'Marked as spam', trash: 'Moved to Trash', restore: 'Restored', notspam: 'Marked as not spam',
  delete: 'Deleted permanently', reply: 'Replied to', edit: 'Edited',
};

export async function commentsAction(fd: FormData) {
  const user = await requireCap('moderate_comments');
  const back = safeBack(fd.get('back'));

  let op = '';
  let ids: number[] = [];
  const single = /^(\w+):(\d+)$/.exec(String(fd.get('op') ?? ''));
  if (single) {
    op = single[1];
    ids = [Number(single[2])];
  } else {
    op = String(fd.get('bulk') ?? '').slice(0, 12);
    ids = [...new Set(fd.getAll('ids').map((v) => Math.trunc(Number(v))).filter((n) => Number.isInteger(n) && n > 0))];
    if (!op) backWith(back, { error: 'Choose a bulk action first.' });
    if (!ids.length) backWith(back, { error: 'Select at least one comment.' });
  }

  if (op === 'emptytrash' || op === 'emptyspam') {
    const status = op === 'emptytrash' ? 'trash' : 'spam';
    const n = run('DELETE FROM comments WHERE status = ?', status).changes;
    logActivity(user, 'delete', 'comment', '', `Emptied ${status}: ${n} comment${n === 1 ? '' : 's'}`);
    revalidatePath('/', 'layout');
    backWith(back, { saved: '1' });
  }
  if (!(op in STATUS_OF) && !['delete', 'reply', 'edit'].includes(op)) backWith(back, { error: 'Unknown action.' });

  const rows = all<Row>(`SELECT id, post_id, status, author_name FROM comments WHERE id IN (${ids.map(() => '?').join(',')})`, ...ids);
  if (!rows.length) backWith(back, { error: 'Those comments no longer exist.' });

  let error = '';
  let done = 0;
  transaction(() => {
    for (const c of rows) {
      if (op in STATUS_OF) {
        run('UPDATE comments SET status = ? WHERE id = ?', STATUS_OF[op], c.id);
        done++;
      } else if (op === 'delete') {
        if (c.status !== 'trash' && c.status !== 'spam') continue; // only from the Trash / Spam tabs
        run('DELETE FROM comments WHERE id = ?', c.id);
        done++;
      } else if (op === 'edit') {
        const text = clean(fd.get(`edit_${c.id}`), COMMENT_LIMITS.body);
        if (text.length < COMMENT_LIMITS.minBody) { error = 'The comment text can’t be empty.'; continue; }
        run('UPDATE comments SET body = ? WHERE id = ?', text, c.id);
        done++;
      } else if (op === 'reply') {
        const text = clean(fd.get(`reply_${c.id}`), COMMENT_LIMITS.body);
        if (text.length < COMMENT_LIMITS.minBody) { error = 'Write a reply first.'; continue; }
        run(
          "INSERT INTO comments (post_id, parent_id, author_name, author_email, body, status) VALUES (?, ?, ?, ?, ?, 'approved')",
          c.post_id, c.id, (user.name || user.email).slice(0, COMMENT_LIMITS.name), user.email, text
        );
        if (c.status !== 'approved') run("UPDATE comments SET status = 'approved' WHERE id = ?", c.id); // replying to a waiting comment approves it
        done++;
      }
    }
  });

  if (error) backWith(back, { error });
  if (done) logActivity(user, op, 'comment', rows.map((c) => c.id).join(','), `${LABEL[op] ?? op}: ${rows.map((c) => c.author_name).join(', ')}`.slice(0, 280));
  revalidatePath('/', 'layout');
  backWith(back, done ? { saved: '1' } : { warn: 'Nothing was changed.' });
}
