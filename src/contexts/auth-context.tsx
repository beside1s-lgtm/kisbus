
'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth, onAuthStateChanged, User, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { app } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const auth = getAuth(app);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        // User is signed in, create session cookie by calling our API
        const idToken = await firebaseUser.getIdToken();
        await fetch('/api/auth', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        // If user is on login page, redirect to admin
        if (pathname === '/login') {
            router.push('/admin');
        }
      } else {
        // User is signed out, delete session cookie by calling our API
        await fetch('/api/auth', { method: 'DELETE' });
      }
    });

    return () => unsubscribe();
  }, [router, pathname]);

  const login = async (email: string, pass: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged will handle the redirect and cookie setting
  };

  const logout = async () => {
    await signOut(auth);
    // onAuthStateChanged will handle the cookie deletion
    router.push('/');
  };

  const value = { user, loading, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
