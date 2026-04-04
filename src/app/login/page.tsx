
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
import { Checkbox } from '@/components/ui/checkbox';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { login, user, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // On component mount, check for 'remember me' data in localStorage
    const savedEmail = localStorage.getItem('rememberMeEmail');
    const shouldRemember = localStorage.getItem('rememberMe') === 'true';
    if (shouldRemember && savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // If user is already logged in, redirect to admin page.
  useEffect(() => {
    if (!authLoading && user) {
      // Use window.location.href instead of router.push to prevent Next.js fetch errors
      // during local dev server desyncs or cache unavailabilities.
      window.location.href = '/admin';
    }
  }, [user, authLoading]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      await login(email, password);
      // Handle 'Remember Me' logic
      if (rememberMe) {
        localStorage.setItem('rememberMeEmail', email);
        localStorage.setItem('rememberMe', 'true');
      } else {
        localStorage.removeItem('rememberMeEmail');
        localStorage.removeItem('rememberMe');
      }
      
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
      setIsSubmitting(false);
    }
  };
  
  if (authLoading || user) {
     return (
        <MainLayout>
          <div className="flex justify-center items-center h-full">
            <p>인증 정보를 확인 중입니다...</p>
          </div>
        </MainLayout>
      );
  }


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
                  disabled={isSubmitting}
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
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="remember-me" className="text-sm font-medium">
                  자동 로그인
                </Label>
              </div>
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? '로그인 중...' : '로그인'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
