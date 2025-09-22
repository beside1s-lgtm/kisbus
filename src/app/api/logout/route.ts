import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const response = NextResponse.json({ status: 'success' }, { status: 200 });
    // Instruct the browser to clear the session cookie
    response.cookies.set('session', '', {
      maxAge: -1,
      path: '/',
    });
    return response;
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
