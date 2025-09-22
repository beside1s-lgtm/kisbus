
'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth, onAuthStateChanged, User, signInWithEmailAndPassword, UserCredential } from 'firebase/auth';
import { app } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<UserCredential>;
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const token = await user.getIdToken();
        // 서버에 토큰을 보내 세션 쿠키를 생성/저장하도록 요청
        await fetch('/api/auth', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        // 로그인 페이지에 있다면 관리자 페이지로 이동
        if (pathname === '/login') {
          router.push('/admin');
        }
      } else {
        // 서버에 세션 쿠키를 삭제하도록 요청
        await fetch('/api/auth', { method: 'DELETE' });
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [pathname, router]);

  const login = async (email: string, pass: string): Promise<UserCredential> => {
    return signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await auth.signOut();
    // 로그아웃 후 홈으로 리디렉션
    window.location.href = '/';
  };

  const value = { user, loading, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
