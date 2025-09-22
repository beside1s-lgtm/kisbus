
'use client';

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { getAuth, onAuthStateChanged, User, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { app } from '@/lib/firebase';
import { usePathname, useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const auth = getAuth(app);

// Function to set a cookie
const setCookie = (name: string, value: string, days: number) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  if (typeof window !== 'undefined') {
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
  }
};

// Function to erase a cookie
const eraseCookie = (name: string) => {
  if (typeof window !== 'undefined') {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  }
};


export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, pass);
    if (userCredential.user) {
      const token = await userCredential.user.getIdToken();
      setCookie('firebaseIdToken', token, 1); // Set cookie directly on login
    }
  };

  const logout = async () => {
    await signOut(auth);
    eraseCookie('firebaseIdToken');
    // Force a full page reload to ensure middleware catches the logged-out state
    window.location.href = '/';
  };

  const value = { user, loading, login, logout };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
