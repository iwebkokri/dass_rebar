import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { loginAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in' };

type Props = { searchParams: Promise<{ error?: string; next?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  if (await getCurrentUser()) redirect('/admin');
  const { error, next } = await searchParams;

  return (
    <main className="sc-login">
      <div className="sc-login-card">
        <div className="sc-brand">
          <span className="sc-mark">DR</span>
          <div>
            <strong>Dass Rebar</strong>
            <small>Website admin</small>
          </div>
        </div>
        <div>
          <h1>Studio CMS</h1>
          <p>Sign in to manage the Dass Rebar website.</p>
        </div>

        {error === 'rate' && <div className="sc-flash sc-flash-err" role="alert" style={{ margin: 0 }}>Too many attempts. Please wait 15 minutes and try again.</div>}
        {error === 'invalid' && <div className="sc-flash sc-flash-err" role="alert" style={{ margin: 0 }}>That email or password isn’t right.</div>}

        <form action={loginAction} className="sc-stack" style={{ gap: 14 }}>
          <input type="hidden" name="next" value={next ?? ''} />
          <div className="sc-field">
            <label htmlFor="email">Email</label>
            <input className="sc-input" id="email" name="email" type="email" autoComplete="username" required autoFocus placeholder="you@example.com" />
          </div>
          <div className="sc-field">
            <label htmlFor="password">Password</label>
            <input className="sc-input" id="password" name="password" type="password" autoComplete="current-password" required placeholder="••••••••••" />
          </div>
          <button className="sc-btn sc-btn-primary" type="submit" style={{ width: '100%' }}>Sign in</button>
        </form>

        <Link href="/" className="sc-back">← Back to the site</Link>
      </div>
    </main>
  );
}
