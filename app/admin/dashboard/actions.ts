'use server';

// Dashboard "Quick draft": a title + a few lines become a draft post, authored by the signed-in user.
import { redirect } from 'next/navigation';
import { logActivity } from '@/lib/activity';
import { requireCap } from '@/lib/auth';
import { get, run } from '@/lib/db';
import { slugify } from '@/lib/slug.mjs';

const clip = (v: FormDataEntryValue | null, max: number) => String(v ?? '').replace(/\u0000/g, '').trim().slice(0, max);

export async function quickDraft(fd: FormData) {
  const user = await requireCap('edit_posts');
  const title = clip(fd.get('title'), 200);
  const body = clip(fd.get('body'), 20_000);
  if (!title && !body) redirect('/admin?error=' + encodeURIComponent('Write a title or a few words for the draft.'));
  const heading = title || body.split('\n')[0].slice(0, 80);

  const base = slugify(heading);
  let slug = base;
  for (let n = 2; get('SELECT 1 AS x FROM posts WHERE slug = ?', slug); n++) slug = `${base}-${n}`;

  const r = run(
    "INSERT INTO posts (slug, title, body, status, published_at, author_id) VALUES (?, ?, ?, 'draft', datetime('now'), ?)",
    slug,
    heading,
    body,
    user.id
  );
  logActivity(user, 'create', 'post', r.lastInsertRowid, `${heading} (quick draft)`);
  redirect(`/admin?draft=${r.lastInsertRowid}`);
}
