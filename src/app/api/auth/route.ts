
import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
      const idToken = authorization.split('Bearer ')[1];
      // 세션 쿠키 유효 기간: 5일
      const expiresIn = 60 * 60 * 24 * 5 * 1000;

      const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });

      const options = {
        name: 'session',
        value: sessionCookie,
        maxAge: expiresIn / 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };

      const response = NextResponse.json({ status: 'success' }, { status: 200 });
      response.cookies.set(options);

      return response;
    }
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  } catch (error) {
    console.error('Session cookie creation failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
    try {
        const sessionCookieName = 'session';
        const sessionCookie = request.cookies.get(sessionCookieName)?.value;

        if (sessionCookie) {
            // Firebase 세션을 해지합니다.
            const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie, true).catch(() => null);
            if (decodedClaims) {
                await authAdmin.revokeRefreshTokens(decodedClaims.sub);
            }
        }

        // 클라이언트의 쿠키를 삭제하기 위한 응답을 생성합니다.
        const response = NextResponse.json({ status: 'success' }, { status: 200 });
        response.cookies.set({
            name: sessionCookieName,
            value: '',
            maxAge: -1, // 쿠키 즉시 만료
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Error logging out:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
