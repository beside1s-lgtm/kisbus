
'use client';
import type { FC, ReactNode } from 'react';
import React from 'react';
import Link from 'next/link';
import { ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '../ui/button';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { LanguageSwitcher } from './language-switcher';


interface MainLayoutProps {
  children: ReactNode;
  headerContent?: ReactNode;
}

export const MainLayout: FC<MainLayoutProps> = ({ children, headerContent }) => {
  const pathname = usePathname();
  const { user, logout, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const getPageTitle = () => {
    const currentPath = pathname.split('/')[1];
    return t(`page.title.${currentPath || 'home'}`);
  }

  const isHomePage = pathname === '/';
  
  const handleLogout = async () => {
      try {
        await logout();
        toast({ title: t('logout.success'), description: t('logout.success.description') });
      } catch (error) {
        toast({ title: t('logout.error'), description: t('logout.error.description'), variant: 'destructive' });
      }
  }

  if (authLoading && pathname.startsWith('/admin')) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>{t('loading.auth')}</p>
      </div>
    );
  }

  const getBackLink = () => {
    if (!user) return '/'; // 로그아웃 상태에서는 무조건 홈으로
    if (pathname.startsWith('/admin') || pathname.startsWith('/teacher')) return '/';
    if (pathname.startsWith('/student') || pathname.startsWith('/apply')) return '/parents';
    return '/';
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
       <header className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-card/80 px-4 py-2 backdrop-blur-sm sm:gap-4 md:px-6">
          <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-4">
                  {!isHomePage && (
                  <Button asChild variant="outline" size="icon" className="h-8 w-8">
                      <Link href={getBackLink()}>
                      <ArrowLeft className="h-4 w-4" />
                      <span className="sr-only">Back</span>
                      </Link>
                  </Button>
                  )}
                  <h1 className="text-lg font-semibold md:text-xl font-headline">
                      {getPageTitle()}
                  </h1>
              </div>
              <div className="flex items-center gap-2">
                  <LanguageSwitcher />
                  {user && (pathname.startsWith('/admin')) && (
                      <Button variant="outline" size="sm" onClick={handleLogout}>
                      <LogOut className="mr-2" /> {t('logout.button')}
                      </Button>
                  )}
              </div>
          </div>
          {headerContent && (
            <div className="w-full">
              {headerContent}
            </div>
          )}
      </header>
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
};
