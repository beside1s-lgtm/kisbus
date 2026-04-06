'use client';

import { useEffect } from 'react';
import { CheckSquare, Edit, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

interface ActionCardConfig {
  href: string;
  icon: React.ElementType;
  titleKey: string;
  descKey: string;
  gradient: string;
  iconBg: string;
  hoverBorder: string;
}

const ACTION_CARDS: ActionCardConfig[] = [
  {
    href: '/student',
    icon: CheckSquare,
    titleKey: 'parents.boarding_check',
    descKey: 'parents.boarding_check.description',
    gradient: 'from-sky-500/10 via-sky-400/5 to-transparent',
    iconBg: 'bg-sky-500',
    hoverBorder: 'hover:border-sky-400',
  },
  {
    href: '/apply',
    icon: Edit,
    titleKey: 'parents.boarding_application',
    descKey: 'parents.boarding_application.description',
    gradient: 'from-teal-500/10 via-teal-400/5 to-transparent',
    iconBg: 'bg-teal-500',
    hoverBorder: 'hover:border-teal-400',
  },
];

export default function ParentsPage() {
  const { t } = useTranslation();

  // 기존 기능: 학부모 플래그 설정
  useEffect(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('isParent', 'true');
    }
  }, []);

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] py-8 px-4">

        {/* ── 히어로 섹션 ─────────────────────────────── */}
        <div className="relative w-full max-w-2xl mb-8 overflow-hidden rounded-3xl">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500 via-sky-500 to-blue-600 opacity-95" />
          <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full bg-white/10 blur-xl" />

          <div className="relative z-10 px-8 py-8 sm:py-10 text-center sm:text-left">
            <h1
              className="text-2xl sm:text-3xl font-bold font-headline text-white leading-tight drop-shadow-sm"
              dangerouslySetInnerHTML={{ __html: t('main.title') }}
            />
            <p className="text-sm text-white/80 mt-2 font-medium">{t('parents.description')}</p>
          </div>
        </div>

        {/* ── 기능 카드 2개 ──────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 max-w-2xl w-full">
          {ACTION_CARDS.map((cfg) => {
            const Icon = cfg.icon;
            return (
              <Link key={cfg.href} href={cfg.href} className="block group">
                <div
                  className={cn(
                    'h-full border-2 border-border/60 rounded-xl transition-all duration-300',
                    'hover:-translate-y-1.5 hover:shadow-xl',
                    cfg.hoverBorder,
                    'bg-gradient-to-br',
                    cfg.gradient,
                    'p-6 flex flex-col gap-4',
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'p-3 rounded-xl flex items-center justify-center shadow-md',
                        'group-hover:scale-110 transition-transform duration-300',
                        cfg.iconBg,
                      )}
                    >
                      <Icon className="text-white size-7" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg font-bold font-headline leading-tight">{t(cfg.titleKey)}</p>
                      {/* descKey가 없으면 기본 설명 */}
                      <p className="text-sm text-muted-foreground leading-snug mt-0.5">
                        {cfg.href === '/student'
                          ? '자녀의 버스 탑승 현황을 확인합니다.'
                          : '버스 탑승 신청 및 정보를 수정합니다.'}
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1.5 group-hover:text-primary transition-all duration-300" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </MainLayout>
  );
}
