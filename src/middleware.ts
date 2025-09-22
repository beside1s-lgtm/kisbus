
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // This is a simple hint cookie set on client-side after successful login.
  // It doesn't contain sensitive info, just indicates that a session *should* exist.
  // The actual authentication is handled by Firebase client-side SDK.
  const sessionHint = request.cookies.get('session')?.value;

  const isAuthenticated = !!sessionHint;

  // If user is not authenticated and tries to access a protected admin page, redirect to login
  if (!isAuthenticated && pathname.startsWith('/admin')) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // If user is authenticated and tries to access the login page, redirect to admin
  if (isAuthenticated && pathname.startsWith('/login')) {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = '/admin';
    return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

// Apply middleware to relevant paths.
export const config = {
  matcher: ['/admin/:path*', '/login'],
};
