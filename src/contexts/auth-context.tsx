
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
      setLoading(true);
      setUser(user);
      
      if (user) {
        try {
          const token = await user.getIdToken();
          // 서버에 토큰을 보내 세션 쿠키를 생성/저장하도록 요청
          await fetch('/api/auth', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          
          if (pathname === '/login') {
            router.push('/admin');
          }
        } catch (error) {
          console.error('세션 생성 중 오류 발생:', error);
          // 오류 발생 시 로그아웃 처리
          await auth.signOut();
        }
      } else {
        // 서버에 세션 쿠키를 삭제하도록 요청
        try {
          await fetch('/api/auth', { method: 'DELETE' });
        } catch (error) {
          console.error('세션 삭제 중 오류 발생:', error);
        }
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
    // onAuthStateChanged가 쿠키 삭제 및 상태 변경을 처리할 것입니다.
    // 페이지 이동이 필요하면 여기서 처리
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
