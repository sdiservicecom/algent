import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'algent_session';

const PUBLIC_PATHS = ['/login', '/register'];

async function isAuthed(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token || !process.env.AUTH_SECRET) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths
  if (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname === '/api/health' ||
    pathname === '/sw.js' ||
    PUBLIC_PATHS.some((p) => pathname === p)
  ) {
    return NextResponse.next();
  }

  // Static / Next internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/manifest.json'
  ) {
    return NextResponse.next();
  }

  if (await isAuthed(req)) return NextResponse.next();

  if (pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
