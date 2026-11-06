'use client';

import { useActionState } from 'react';
import { submitComment, type CommentState } from '@/app/(site)/insights/[slug]/actions';

const initial: CommentState = { ok: false, message: '' };

const label = { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '14px', fontWeight: 700, color: '#182845' } as const;
const field = {
  font: 'inherit', fontWeight: 400, fontSize: '16px', color: '#182845', background: '#FFFFFF', border: '1px solid #C3C9D0',
  borderRadius: '10px', padding: '12px 14px', width: '100%', boxSizing: 'border-box',
} as const;

/** Public comment form. New comments are held for moderation; the honeypot field `website` is hidden from people. */
export default function PostCommentForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(submitComment, initial);

  if (state.ok) {
    return (
      <p role="status" style={{ margin: 0, padding: '18px 20px', background: '#FFFFFF', border: '1px solid #C3C9D0', borderLeft: '4px solid #7F5F47', borderRadius: '10px', fontSize: '16px', lineHeight: 1.6, color: '#182845' }}>
        {state.message}
      </p>
    );
  }

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <input type="hidden" name="slug" value={slug} />
      {/* honeypot — visually hidden, skipped by keyboards and screen readers */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
        <label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      {state.message && (
        <p role="alert" style={{ margin: 0, padding: '12px 14px', background: '#FFF1F0', border: '1px solid #E9A8A2', borderRadius: '10px', color: '#8A1F17', fontSize: '15px' }}>{state.message}</p>
      )}

      <label style={label}>
        Comment
        <textarea name="comment" required rows={5} maxLength={3000} defaultValue={state.values?.comment ?? ''} style={{ ...field, resize: 'vertical', lineHeight: 1.55 }} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <label style={label}>
          Name
          <input type="text" name="name" required maxLength={80} autoComplete="name" defaultValue={state.values?.name ?? ''} style={field} />
        </label>
        <label style={label}>
          <span>Email <span style={{ fontWeight: 400, color: '#4A5568' }}>(not published)</span></span>
          <input type="email" name="email" required maxLength={200} autoComplete="email" defaultValue={state.values?.email ?? ''} style={field} />
        </label>
      </div>
      <div>
        <button type="submit" disabled={pending} style={{ font: 'inherit', fontWeight: 700, fontSize: '16px', background: '#182845', color: '#FFFFFF', border: 0, borderRadius: '10px', padding: '13px 26px', cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1 }}>
          {pending ? 'Sending…' : 'Post comment'}
        </button>
      </div>
    </form>
  );
}
