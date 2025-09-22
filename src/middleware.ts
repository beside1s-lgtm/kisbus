
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authAdmin } from '@/lib/firebase-admin';

// 이 미들웨어는 Node.js 런타임에서 실행되어야 `firebase-admin`을 사용할 수 있습니다.
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
    // 쿠키 검증 실패
    isAuthenticated = false;
  }

  // 사용자가 인증되지 않았고 /admin 경로에 접근하려고 할 때
  if (!isAuthenticated && pathname.startsWith('/admin')) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // 사용자가 인증되었고 /login 경로에 접근하려고 할 때
  if (isAuthenticated && pathname === '/login') {
    const adminUrl = request.nextUrl.clone();
    adminUrl.pathname = '/admin';
    return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

// 미들웨어를 적용할 경로를 지정합니다.
export const config = {
  matcher: ['/admin/:path*', '/login'],
};
