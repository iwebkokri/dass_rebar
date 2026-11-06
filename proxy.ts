// Tells the root layout WHICH part of the app a request is for, so tracking scripts and custom code are only ever
// output on the public site — never in the admin (/admin/*) and never in the builder canvas (/builder-frame).
//
// The headers are set on the REQUEST that continues into the app. They overwrite whatever the browser sent, so a client
// can't pick its own surface. (Next 16: this file was called "middleware" before.)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const headers = new Headers(request.headers);
  const surface = pathname === '/admin' || pathname.startsWith('/admin/') ? 'admin' : pathname === '/builder-frame' ? 'frame' : 'site';
  headers.set('x-dr-surface', surface);
  headers.set('x-dr-path', pathname);
  headers.delete('x-dr-page');
  if (surface === 'frame') {
    const p = searchParams.get('p'); // the builder canvas passes the page it edits, so that page's own CSS can be shown
    if (p && /^\d{1,9}$/.test(p)) headers.set('x-dr-page', p);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
