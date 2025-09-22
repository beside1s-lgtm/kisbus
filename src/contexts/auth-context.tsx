
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        // 사용자가 로그인하면 서버에 세션 쿠키 생성을 요청
        const idToken = await user.getIdToken();
        await fetch('/api/auth/route', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
      } else {
        // 사용자가 로그아웃하면 서버에 세션 쿠키 삭제를 요청
        await fetch('/api/auth/route', { method: 'DELETE' });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, pass);
    // signIn 성공 후 onAuthStateChanged가 트리거되어 후속 처리를 담당합니다.
  };

  const logout = async () => {
    await auth.signOut();
    // signOut 성공 후 onAuthStateChanged가 트리거되어 후속 처리를 담당합니다.
    router.push('/');
  };

  const value = { user, loading, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="flex justify-center items-center h-screen">
          <p>인증 정보를 확인하는 중입니다...</p>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};
