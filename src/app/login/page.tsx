
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MainLayout } from '@/components/layout/main-layout';
import { useAuth } from '@/hooks/use-auth';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@kshcm.net');
  const [password, setPassword] = useState('kis123456!');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { login, user } = useAuth();
  const router = useRouter();

  // 이미 로그인된 사용자가 이 페이지에 머무르는 것을 방지
  useEffect(() => {
    if (user) {
      router.push('/admin');
    }
  }, [user, router]);
  
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await login(email, password);
      // 로그인 성공 시 AuthProvider가 상태 변경을 감지하고
      // /admin으로 리디렉션할 것이므로 여기서 별도 처리를 하지 않습니다.
      toast({
        title: '로그인 성공',
        description: '관리자 페이지로 이동합니다.',
      });

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
    // 성공 시에는 AuthProvider가 리디렉션하므로 loading을 false로 설정하지 않음
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
