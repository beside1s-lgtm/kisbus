
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('firebaseIdToken');

  // Rule 1: Protect the /admin route. If no token, redirect to /login.
  if (pathname.startsWith('/admin') && !token) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Rule 2: If a logged-in user tries to access /login, redirect to /admin.
  if (pathname.startsWith('/login') && token) {
     const adminUrl = request.nextUrl.clone();
     adminUrl.pathname = '/admin';
     return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

// Apply middleware to both /admin and /login paths to handle all redirection cases.
export const config = {
  matcher: ['/admin/:path*', '/login'],
};
