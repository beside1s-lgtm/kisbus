
'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, User, signInWithEmailAndPassword } from 'firebase/auth';
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string): Promise<void> => {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    const idToken = await userCredential.user.getIdToken();

    const response = await fetch('/api/auth/route', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!response.ok) {
        throw new Error('Failed to create session cookie.');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/route', { method: 'DELETE' });
    await auth.signOut();
    router.push('/');
  };

  const value = { user, loading, login, logout };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>인증 정보를 확인하는 중입니다...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
