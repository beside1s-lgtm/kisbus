import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
      const idToken = authorization.split('Bearer ')[1];
      const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days

      const sessionCookie = await authAdmin.createSessionCookie(idToken, { expiresIn });

      const options = {
        name: 'session',
        value: sessionCookie,
        maxAge: expiresIn / 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      };

      const response = new NextResponse(JSON.stringify({ status: 'success' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
      
      await response.cookies.set(options);

      return response;
    }
    return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  } catch (error) {
    return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
  }
}


export async function DELETE(request: NextRequest) {
  const response = new NextResponse(JSON.stringify({ status: 'success' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  
  await response.cookies.set({
    name: 'session',
    value: '',
    maxAge: -1, // Expire the cookie immediately
    path: '/',
  });

  return response;
}
