
'use client';
import type { FC, ReactNode } from 'react';
import React from 'react';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

interface MainLayoutProps {
  children: ReactNode;
  headerContent?: ReactNode;
}

export const MainLayout: FC<MainLayoutProps> = ({ children, headerContent }) => {
  const pathname = usePathname();
  const { user, logout, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const getPageTitle = () => {
    const currentPath = pathname.split('/')[1];
    switch(currentPath) {
        case 'admin': return '관리자';
        case 'teacher': return '선생님';
        case 'student': return '탑승 확인';
        case 'apply': return '탑승 신청';
        case 'login': return '관리자 로그인';
        default: return '홈';
    }
  }

  const isHomePage = pathname === '/';
  
  const handleLogout = async () => {
      try {
        await logout();
        toast({ title: '로그아웃 성공', description: '홈 화면으로 이동합니다.' });
      } catch (error) {
        toast({ title: '로그아웃 실패', description: '다시 시도해주세요.', variant: 'destructive' });
      }
  }

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>인증 정보를 확인하는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
       <header className="sticky top-0 z-10 flex h-auto min-h-16 items-center justify-between gap-4 border-b bg-card/80 px-4 py-2 backdrop-blur-sm md:px-6">
        <div className="flex items-center gap-4">
          {!isHomePage && (
            <Button asChild variant="outline" size="icon" className="h-8 w-8">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to Home</span>
              </Link>
            </Button>
          )}
           <h1 className="text-lg font-semibold md:text-xl font-headline">
              {getPageTitle()}
            </h1>
        </div>
        
        <div className="flex flex-1 items-center justify-center gap-2">
            {headerContent}
        </div>
        
        <div className="flex items-center gap-2">
          {user && (pathname.startsWith('/admin') || pathname.startsWith('/teacher')) && (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2" /> 로그아웃
            </Button>
          )}
        </div>
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};
