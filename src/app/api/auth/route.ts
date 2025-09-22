
import { NextRequest, NextResponse } from 'next/server';
import { authAdmin } from '@/lib/firebase-admin';

// This forces the route to be evaluated on the Node.js runtime
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('Authorization');
    if (authorization?.startsWith('Bearer ')) {
      const idToken = authorization.split('Bearer ')[1];
      // Session cookie valid for 5 days
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
            // Revoke Firebase session
            const decodedClaims = await authAdmin.verifySessionCookie(sessionCookie, true).catch(() => null);
            if (decodedClaims) {
                await authAdmin.revokeRefreshTokens(decodedClaims.sub);
            }
        }

        // Create a response to clear the client's cookie
        const response = NextResponse.json({ status: 'success' }, { status: 200 });
        response.cookies.set({
            name: sessionCookieName,
            value: '',
            maxAge: -1, // Expire cookie immediately
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Error logging out:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
