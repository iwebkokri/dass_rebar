'use server';

import { redirect } from 'next/navigation';
import { authenticate, createSession } from '@/lib/auth';

// Only ever send people back to a page inside the CMS (prevents open redirects).
const safeNext = (n: string) => (/^\/admin(\/[\w\-./]*)?$/.test(n) && !n.includes('..') ? n : '');

export async function loginAction(fd: FormData) {
  const email = String(fd.get('email') ?? '').trim().toLowerCase().slice(0, 200);
  const password = String(fd.get('password') ?? '').slice(0, 500);
  const next = safeNext(String(fd.get('next') ?? ''));
  const back = (error: string) => `/admin/login?error=${error}${next ? `&next=${encodeURIComponent(next)}` : ''}`;

  if (!email || !password) redirect(back('invalid'));

  const result = await authenticate(email, password);
  if ('reason' in result) redirect(back(result.reason));

  await createSession(result.user.id);
  redirect(next || '/admin');
}
