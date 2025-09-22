import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authAdmin } from '@/lib/firebase-admin';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session')?.value;

  // Rule 1: Protect the /admin route.
  if (pathname.startsWith('/admin')) {
    if (!sessionCookie) {
      // Not logged in, redirect to login page.
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }
    
    // Verify the session cookie.
    try {
      await authAdmin.verifySessionCookie(sessionCookie, true);
      // Session is valid, allow access.
      return NextResponse.next();
    } catch (error) {
      // Session is invalid, redirect to login page.
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      const response = NextResponse.redirect(loginUrl);
      // Clear the invalid cookie
      response.cookies.delete('session');
      return response;
    }
  }

  // Rule 2: If a logged-in user tries to access /login, redirect to /admin.
  if (pathname.startsWith('/login')) {
      if (sessionCookie) {
          try {
              await authAdmin.verifySessionCookie(sessionCookie, true);
              // Session is valid, redirect to admin
              const adminUrl = request.nextUrl.clone();
              adminUrl.pathname = '/admin';
              return NextResponse.redirect(adminUrl);
          } catch (error) {
              // Invalid cookie, let them stay on login but clear the cookie
              const response = NextResponse.next();
              response.cookies.delete('session');
              return response;
          }
      }
  }

  return NextResponse.next();
}

// Apply middleware to relevant paths.
export const config = {
  matcher: ['/admin/:path*', '/login'],
};
