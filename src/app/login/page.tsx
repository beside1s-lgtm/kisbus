
'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { LogIn } from 'lucide-react';
import { getAuth, setPersistence, browserSessionPersistence } from 'firebase/auth';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@kshcm.net');
  const [password, setPassword] = useState('kis123456!');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { login } = useAuth();
  const auth = getAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
       // Set session persistence
      await setPersistence(auth, browserSessionPersistence);
      const user = await login(email, password);
      
      // For the middleware to work, we need a simple cookie.
      // Firebase Auth SDK for client-side handles token management automatically,
      // but the middleware needs a hint that the session exists.
      document.cookie = "session=true; path=/";

      toast({
        title: '로그인 성공',
        description: '관리자 페이지로 이동합니다.',
      });
      
      // Force a full page reload to '/admin'.
      // This ensures the middleware runs with the newly set cookie.
      window.location.href = '/admin';

    } catch (error: any) {
      let description = '이메일 또는 비밀번호가 올바르지 않습니다.';
      if (error.code) {
          switch(error.code) {
              case 'auth/user-not-found':
              case 'auth/wrong-password':
              case 'auth/invalid-credential':
                  description = '이메일 또는 비밀번호가 올바르지 않습니다.';
                  break;
              default:
                  description = '로그인 중 오류가 발생했습니다. 다시 시도해주세요.';
                  break;
          }
      }
      toast({
        title: '로그인 실패',
        description,
        variant: 'destructive',
      });
      setLoading(false);
    }
  };

  return (
    <MainLayout>
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-headline flex items-center gap-2">
              <LogIn /> 관리자 로그인
            </CardTitle>
            <CardDescription>
              관리자 계정으로 로그인해주세요.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@kshcm.net"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? '로그인 중...' : '로그인'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
