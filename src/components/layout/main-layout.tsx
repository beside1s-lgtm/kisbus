'use client';
import type { FC, ReactNode } from 'react';
import React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarFooter,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Bus, UserCog, User,ClipboardPenLine } from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { href: '/admin', label: '관리자', icon: UserCog },
  { href: '/teacher', label: '선생님', icon: UserCog },
  { href: '/student', label: '학생', icon: User },
  { href: '/apply', label: '탑승 신청', icon: ClipboardPenLine },
];

export const MainLayout: FC<{ children: ReactNode }> = ({ children }) => {
  const pathname = usePathname();

  const getPageTitle = () => {
    const currentPath = pathname.split('/')[1];
    switch(currentPath) {
        case 'admin': return '관리자';
        case 'teacher': return '선생님';
        case 'student': return '학생';
        case 'apply': return '탑승 신청';
        default: return '대시보드';
    }
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3 p-2">
            <div className="bg-primary p-2 rounded-lg flex items-center justify-center">
              <Bus className="text-primary-foreground size-6" />
            </div>
            <h1 className="text-xl font-headline font-bold text-foreground">
              KIS 버스 관리자
            </h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            {navItems.map((item) => (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith(item.href)}
                  className="font-headline"
                >
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <p className="text-xs text-muted-foreground p-4">© 2024 KIS</p>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-16 items-center justify-between p-4 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <SidebarTrigger className="md:hidden" />
          <div className="hidden md:block">
            <h2 className="text-lg font-semibold capitalize font-headline">
              {getPageTitle()}
            </h2>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6 lg:p-8 bg-background">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
};
