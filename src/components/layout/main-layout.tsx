
'use client';
import type { FC, ReactNode } from 'react';
import React from 'react';
import Link from 'next/link';
import { Home, LogOut, ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { LanguageSwitcher } from './language-switcher';

interface MainLayoutProps {
  children: ReactNode;
  headerContent?: ReactNode;
  titleActions?: ReactNode;
}

export const MainLayout: FC<MainLayoutProps> = ({ children, headerContent, titleActions }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  
  const getPageTitle = () => {
    const currentPath = pathname.split('/')[1];
    return t(`page.title.${currentPath || 'home'}`);
  }

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

  const showHomeButton = pathname.startsWith('/admin') || pathname.startsWith('/teacher');
  const showParentBackButton = pathname.startsWith('/student') || pathname.startsWith('/apply');

  return (
    <div className="flex flex-col min-h-screen bg-background">
       <header className="sticky top-0 z-10 flex flex-col gap-2 border-b bg-card/80 px-3 py-2 backdrop-blur-sm sm:gap-4 sm:px-4 md:px-6">
          <div className="flex w-full items-center justify-between gap-2 overflow-hidden">
              <div className="flex items-center gap-2 min-w-0 flex-shrink overflow-hidden">
                  {showHomeButton && (
                    <Button asChild variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
                      <Link href="/">
                        <Home className="h-4 w-4" />
                        <span className="sr-only">Home</span>
                      </Link>
                    </Button>
                  )}
                  {showParentBackButton && (
                     <Button asChild variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
                      <Link href="/parents">
                        <ArrowLeft className="h-4 w-4" />
                        <span className="sr-only">Back</span>
                      </Link>
                    </Button>
                  )}
                  <div className="flex items-center gap-2 min-w-0">
                    <h1 className="text-base font-semibold sm:text-lg md:text-xl font-headline truncate">
                        {getPageTitle()}
                    </h1>
                    {titleActions}
                  </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 sm:gap-2">
                  <LanguageSwitcher />
                  {user && pathname.startsWith('/admin') && (
                      <Button variant="outline" size="sm" onClick={handleLogout} className="h-8 px-2 sm:px-3">
                        <LogOut className="h-4 w-4 sm:mr-2" />
                        <span className="hidden sm:inline">{t('logout.button')}</span>
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
