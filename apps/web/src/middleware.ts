import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { betterFetch } from '@better-fetch/fetch';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect authenticated app routes (apps/web/src/app/(dashboard)/*)
  const protectedPrefixes = [
    '/dashboard',
    '/inbox',
    '/pipeline',
    '/patients',
    '/settings',
    '/professionals',
    '/agenda',
    '/services',
    '/reports',
  ];
  if (!protectedPrefixes.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  try {
    // Validate session with the API
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    
    // Check if session cookie exists
    const sessionCookieName = process.env.NODE_ENV === 'production' 
      ? '__Secure-better-auth.session_token' 
      : 'better-auth.session_token';
      
    const hasSessionCookie = request.cookies.has(sessionCookieName);
    
    if (!hasSessionCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    const { data: session, error } = await betterFetch<{ session: any; user: any }>(
      '/api/auth/get-session',
      {
        baseURL: apiUrl,
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
      }
    );

    if (error || !session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    return NextResponse.next();
  } catch (error) {
    console.error('Middleware auth check failed:', error);
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
