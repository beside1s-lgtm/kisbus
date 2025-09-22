
import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebase-admin';

// 미들웨어와 달리 API 라우트는 Node.js 런타임을 사용하도록 명시할 필요가 거의 없습니다.
// Vercel 배포 시에는 기본적으로 서버리스 함수(Node.js)로 빌드됩니다.

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


export async function DELETE() {
  const response = NextResponse.json({ status: 'success' }, { status: 200 });
  
  response.cookies.set({
    name: 'session',
    value: '',
    maxAge: -1, // 쿠키 즉시 만료
    path: '/',
  });

  return response;
}
