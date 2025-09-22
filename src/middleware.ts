
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authAdmin } from '@/lib/firebase-admin';

// 이 미들웨어는 Node.js 런타임에서 실행되어야 합니다.
export const runtime = 'nodejs';

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value || '';
  const { pathname } = request.nextUrl;

  let isAuthenticated = false;
  try {
    // 세션 쿠키를 검증합니다.
    await authAdmin.verifySessionCookie(sessionCookie, true);
    isAuthenticated = true;
  } catch (error) {
    // 쿠키가 유효하지 않거나 없는 경우
    isAuthenticated = false;
  }

  // 사용자가 인증되지 않았고 /admin 경로에 접근하려고 할 때
  if (!isAuthenticated && pathname.startsWith('/admin')) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 사용자가 인증되었고 /login 경로에 접근하려고 할 때
  if (isAuthenticated && pathname === '/login') {
    const adminUrl = new URL('/admin', request.url);
    return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

// 미들웨어를 적용할 경로를 지정합니다.
export const config = {
  matcher: ['/admin/:path*', '/login'],
};
