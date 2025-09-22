import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session')?.value;

  const isAuthenticated = !!sessionCookie;

  // If user is not authenticated and tries to access admin page, redirect to login
  if (!isAuthenticated && pathname.startsWith('/admin')) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // If user is authenticated and tries to access login page, redirect to admin
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
