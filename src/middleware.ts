
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_PAGES = ['/admin'];
const TEACHER_PAGES = ['/teacher'];
const STUDENT_PAGES = ['/student', '/apply'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('firebaseIdToken');

  // Rule: Admin pages require authentication
  if (ADMIN_PAGES.some(p => pathname.startsWith(p)) && !token) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Rule: If authenticated user tries to access login page, redirect to admin
  if (pathname.startsWith('/login') && token) {
     const url = request.nextUrl.clone();
     url.pathname = '/admin';
     return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
