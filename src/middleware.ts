
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // This is a simple session cookie set on client-side by the AuthProvider.
  // It doesn't contain sensitive info, just indicates that a session *should* exist.
  const sessionCookie = request.cookies.get('session')?.value;

  const isAuthenticated = !!sessionCookie;

  // If user is not authenticated and tries to access a protected admin page, redirect to login
  if (!isAuthenticated && pathname.startsWith('/admin')) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // If user is authenticated and tries to access the login page, redirect to admin
  if (isAuthenticated && pathname === '/login') {
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
