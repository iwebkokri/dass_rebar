'use server';

// Public comment form. Comments are stored as 'pending' and only appear once a moderator approves them
// (Studio CMS > Comments). Never returns or stores HTML — comment text is plain text.
import { revalidatePath } from 'next/cache';
import { COMMENT_LIMITS, insertPendingComment, isDuplicate } from '@/lib/comments';
import { getPostBySlug } from '@/lib/content';
import { sendNotification } from '@/lib/mail';
import { clientKey, hit, UNKNOWN_CLIENT } from '@/lib/ratelimit';

export type CommentState = {
  ok: boolean;
  message: string;
  /** Sent back on an error so the visitor doesn't lose what they typed. */
  values?: { name: string; email: string; comment: string };
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMIT = 5; // comments …
const WINDOW = 15 * 60 * 1000; // … per 15 minutes, per visitor

const clean = (v: FormDataEntryValue | null, max: number) =>
  String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);

export async function submitComment(_prev: CommentState, fd: FormData): Promise<CommentState> {
  const slug = clean(fd.get('slug'), 200);
  const name = clean(fd.get('name'), COMMENT_LIMITS.name);
  const email = clean(fd.get('email'), COMMENT_LIMITS.email);
  const comment = clean(fd.get('comment'), COMMENT_LIMITS.body).replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
  const values = { name, email, comment };

  // Honeypot: real visitors never see or fill this field. Pretend it worked so bots don't adapt.
  if (clean(fd.get('website'), 200)) return { ok: true, message: 'Thanks — your comment is awaiting moderation.' };

  const post = getPostBySlug(slug);
  if (!post) return { ok: false, message: 'This article could not be found.', values };
  if (!post.comments_enabled) return { ok: false, message: 'Comments are closed on this article.', values };

  if (!name) return { ok: false, message: 'Please enter your name.', values };
  if (!EMAIL.test(email)) return { ok: false, message: 'Please enter a valid email address (it is never shown publicly).', values };
  if (comment.length < COMMENT_LIMITS.minBody) return { ok: false, message: 'Please write a comment.', values };

  const visitor = await clientKey();
  const limit = visitor === UNKNOWN_CLIENT ? LIMIT * 5 : LIMIT; // host not passing IPs: don't let one shared bucket block everyone
  if (!hit(`comment:${visitor}`, limit, WINDOW)) {
    return { ok: false, message: 'You have posted several comments recently. Please try again in a little while.', values };
  }

  if (isDuplicate(post.id, email, comment)) return { ok: true, message: 'Thanks — your comment is awaiting moderation.' };

  const id = insertPendingComment(post.id, name, email, comment);
  revalidatePath('/admin/comments');

  // Optional email heads-up (no-op when SMTP is not configured); never blocks or fails the comment.
  void sendNotification(
    `New comment awaiting moderation: ${post.title}`,
    `${name} <${email}> commented on "${post.title}" (/insights/${post.slug}):\n\n${comment}\n\nModerate it in Studio CMS > Comments (comment #${id}).`,
    email
  ).catch(() => {});

  return { ok: true, message: 'Thanks — your comment is awaiting moderation.' };
}
