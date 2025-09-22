import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authAdmin } from '@/lib/firebase-admin';

// This forces the middleware to run on the Node.js runtime instead of the Edge runtime.
export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('session')?.value;

  let isAuthenticated = false;
  try {
    if (sessionCookie) {
      await authAdmin.verifySessionCookie(sessionCookie, true);
      isAuthenticated = true;
    }
  } catch (error) {
    // Session cookie is invalid.
    isAuthenticated = false;
  }

  // If user is not authenticated and tries to access admin page, redirect to login
  if (!isAuthenticated && pathname.startsWith('/admin')) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('session'); // Clear invalid cookie just in case
    return response;
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
