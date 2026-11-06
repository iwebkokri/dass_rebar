// Comments on posts: public thread + the helpers the admin screens share.
import { all, get, run } from './db';

export type CommentStatus = 'pending' | 'approved' | 'spam' | 'trash';
export const COMMENT_STATUSES: CommentStatus[] = ['pending', 'approved', 'spam', 'trash'];

export const COMMENT_LIMITS = { name: 80, email: 200, body: 3000, minBody: 2 } as const;

export type ThreadComment = { id: number; parent_id: number | null; author_name: string; body: string; created_at: string; depth: number };

/** Approved comments of a post as a flat, display-ordered list: oldest first, each reply right after its parent (depth capped at 3). */
export function getThread(postId: number): ThreadComment[] {
  const rows = all<Omit<ThreadComment, 'depth'>>(
    "SELECT id, parent_id, author_name, body, created_at FROM comments WHERE post_id = ? AND status = 'approved' ORDER BY created_at, id",
    postId
  );
  const ids = new Set(rows.map((r) => r.id));
  const kids = new Map<number | null, typeof rows>();
  for (const r of rows) {
    const key = r.parent_id && ids.has(r.parent_id) ? r.parent_id : null; // replies to a hidden/removed comment become top-level
    kids.set(key, [...(kids.get(key) ?? []), r]);
  }
  const out: ThreadComment[] = [];
  const walk = (parent: number | null, depth: number) => {
    for (const r of kids.get(parent) ?? []) {
      out.push({ ...r, depth });
      walk(r.id, Math.min(depth + 1, 3));
    }
  };
  walk(null, 0);
  return out;
}

/** Approved-comment counts for many posts at once. */
export function approvedCounts(postIds: number[]): Map<number, number> {
  const map = new Map<number, number>();
  if (!postIds.length) return map;
  for (const r of all<{ post_id: number; c: number }>(
    `SELECT post_id, COUNT(*) AS c FROM comments WHERE status = 'approved' AND post_id IN (${postIds.map(() => '?').join(',')}) GROUP BY post_id`,
    ...postIds
  )) map.set(r.post_id, r.c);
  return map;
}

/** Same for comments waiting for moderation. */
export function pendingCounts(postIds: number[]): Map<number, number> {
  const map = new Map<number, number>();
  if (!postIds.length) return map;
  for (const r of all<{ post_id: number; c: number }>(
    `SELECT post_id, COUNT(*) AS c FROM comments WHERE status = 'pending' AND post_id IN (${postIds.map(() => '?').join(',')}) GROUP BY post_id`,
    ...postIds
  )) map.set(r.post_id, r.c);
  return map;
}

/** Visitor comment: always stored as 'pending' until a moderator approves it. */
export function insertPendingComment(postId: number, name: string, email: string, body: string): number {
  return run(
    "INSERT INTO comments (post_id, parent_id, author_name, author_email, body, status) VALUES (?, NULL, ?, ?, ?, 'pending')",
    postId, name, email, body
  ).lastInsertRowid;
}

/** The same visitor posting the same text on the same post in the last day — treat as a double click, don't store twice. */
export function isDuplicate(postId: number, email: string, body: string): boolean {
  return !!get(
    "SELECT 1 AS x FROM comments WHERE post_id = ? AND author_email = ? AND body = ? AND created_at > datetime('now', '-1 day') LIMIT 1",
    postId, email, body
  );
}
