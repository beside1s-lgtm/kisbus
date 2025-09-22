
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get('session')?.value;
  const { pathname } = request.nextUrl;

  // 사용자가 인증되지 않았고 /admin 경로에 접근하려고 할 때
  if (!sessionCookie && pathname.startsWith('/admin')) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 사용자가 인증되었고 /login 경로에 접근하려고 할 때
  if (sessionCookie && pathname === '/login') {
    const adminUrl = new URL('/admin', request.url);
    return NextResponse.redirect(adminUrl);
  }

  return NextResponse.next();
}

// 미들웨어를 적용할 경로를 지정합니다.
export const config = {
  matcher: ['/admin/:path*', '/login'],
};
