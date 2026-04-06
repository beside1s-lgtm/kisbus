'use client';
// Updated by cjwave on 2026-04-06 for UI/UX consistency across roles.

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowRight,
  UserCog,
  User,
  ShieldCheck,
  Bus,
  Activity,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import { MainLayout } from '@/components/layout/main-layout';
import { useTranslation } from '@/hooks/use-translation';
import { useRouter } from 'next/navigation';
import { onBusesUpdate } from '@/lib/firebase-data';
import type { Bus as BusType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ─── 역할 카드 데이터 ──────────────────────────────────────
interface RoleConfig {
  href: string;
  icon: React.ElementType;
  titleKey: string;
  descKey: string;
  gradient: string;
  iconBg: string;
  hoverBorder: string;
}

const ROLE_CONFIGS: RoleConfig[] = [
  {
    href: '/login',
    icon: ShieldCheck,
    titleKey: 'role.admin',
    descKey: 'role.admin.description',
    gradient: 'from-blue-600/10 via-blue-500/5 to-transparent',
    iconBg: 'bg-blue-600',
    hoverBorder: 'hover:border-blue-400',
  },
  {
    href: '/teacher',
    icon: UserCog,
    titleKey: 'role.teacher',
    descKey: 'role.teacher.description',
    gradient: 'from-sky-500/10 via-sky-400/5 to-transparent',
    iconBg: 'bg-sky-500',
    hoverBorder: 'hover:border-sky-400',
  },
  {
    href: '/parents',
    icon: User,
    titleKey: 'role.parent',
    descKey: 'role.parent.description',
    gradient: 'from-teal-500/10 via-teal-400/5 to-transparent',
    iconBg: 'bg-teal-500',
    hoverBorder: 'hover:border-teal-400',
  },
];

// ─── 역할 카드 컴포넌트 ───────────────────────────────────
function RoleCard({ config, t }: { config: RoleConfig; t: (k: string) => string }) {
  const { href, icon: Icon, titleKey, descKey, gradient, iconBg, hoverBorder } = config;
  return (
    <Link href={href} className="block group">
      <Card
        className={cn(
          'h-full border-2 border-border/60 transition-all duration-300',
          'hover:-translate-y-1.5 hover:shadow-xl',
          hoverBorder,
          'bg-gradient-to-br',
          gradient,
        )}
      >
        <CardContent className="pt-6 pb-5 px-6 flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'p-3 rounded-xl flex items-center justify-center shadow-md',
                'group-hover:scale-110 transition-transform duration-300',
                iconBg,
              )}
            >
              <Icon className="text-white size-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold font-headline leading-tight">{t(titleKey)}</p>
              <p className="text-sm text-muted-foreground leading-snug mt-0.5">{t(descKey)}</p>
            </div>
          </div>
          <div className="flex justify-end">
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1.5 group-hover:text-primary transition-all duration-300" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// ─── 실시간 통계 카드 ─────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  iconClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  loading: boolean;
  iconClass: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-card/70 backdrop-blur-sm border border-border/50 rounded-xl px-4 py-3 shadow-sm min-w-[120px]">
      <div className={cn('p-2 rounded-lg', iconClass)}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] text-muted-foreground font-medium leading-none mb-1">{label}</span>
        {loading ? (
          <Skeleton className="h-5 w-10 rounded" />
        ) : (
          <span className="text-base font-bold leading-none">{value}</span>
        )}
      </div>
    </div>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────
export default function HomePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [buses, setBuses] = useState<BusType[] | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // 기존 기능: 마운트 + sessionStorage 체크
  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const isParent = sessionStorage.getItem('isParent');
      if (isParent) {
        router.replace('/parents');
      }
    }
  }, [router]);

  // 기존 기능: 홈으로 돌아올 때 parent 플래그 제거
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      sessionStorage.removeItem('isParent');
    }
  }, []);

  // 실시간 버스 데이터 구독 (경량 - 통계용)
  useEffect(() => {
    const unsub = onBusesUpdate((data) => setBuses(data));
    return () => unsub();
  }, []);

  // 현재 시각 갱신 (1분마다)
  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // 버스 통계 계산
  const stats = useMemo(() => {
    if (!buses) return null;
    const activeBuses = buses.filter((b) => b.isActive !== false);
    const departedBuses = activeBuses.filter((b) => b.status === 'departed');
    return {
      total: activeBuses.length,
      departed: departedBuses.length,
    };
  }, [buses]);

  const isOperating = stats && stats.departed > 0;
  const loading = buses === null;

  // 현재 날짜 포맷
  const todayStr = mounted ? format(currentTime, 'yyyy.MM.dd (EEE)') : '';

  if (!mounted) {
    return null;
  }

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] py-8 px-4">

        {/* ── 히어로 섹션 ─────────────────────────────── */}
        <div className="relative w-full max-w-3xl mb-8 overflow-hidden rounded-3xl">
          {/* 배경 그라디언트 */}
          <div className="absolute inset-0 bg-gradient-to-br from-sky-500 via-blue-500 to-blue-700 opacity-95" />
          {/* 장식 원 */}
          <div className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full bg-white/10 blur-xl" />

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-6 px-8 py-8 sm:py-10">
            {/* 버스 아이콘 */}
            <div className="flex-shrink-0 flex items-center justify-center w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-md shadow-lg border border-white/30">
              <Bus className="w-10 h-10 text-white drop-shadow" />
            </div>

            {/* 텍스트 */}
            <div className="text-center sm:text-left text-white flex-1">
              <h1
                className="text-2xl sm:text-3xl font-bold font-headline leading-tight drop-shadow-sm"
                dangerouslySetInnerHTML={{ __html: t('main.title') }}
              />
              <p className="text-sm text-white/80 mt-1.5 font-medium">{t('main.select_role')}</p>

              {/* 날짜 + 운행 상태 배지 */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                {todayStr && (
                  <Badge className="bg-white/20 text-white border-white/30 text-xs font-medium gap-1 py-1 px-3">
                    <Clock className="w-3 h-3" />
                    {todayStr}
                  </Badge>
                )}
                {loading ? (
                  <Skeleton className="h-6 w-24 rounded-full bg-white/20" />
                ) : (
                  <Badge
                    className={cn(
                      'text-xs font-medium gap-1 py-1 px-3 border',
                      isOperating
                        ? 'bg-emerald-400/30 text-white border-emerald-300/50'
                        : 'bg-white/20 text-white/80 border-white/30',
                    )}
                  >
                    {isOperating ? (
                      <>
                        <Activity className="w-3 h-3" />
                        운행 중
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        대기 중
                      </>
                    )}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── 실시간 통계 바 ──────────────────────────── */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8 w-full max-w-3xl">
          <StatCard
            icon={Bus}
            label="전체 버스"
            value={stats?.total ?? 0}
            loading={loading}
            iconClass="bg-blue-500"
          />
          <StatCard
            icon={Activity}
            label="운행 중"
            value={stats?.departed ?? 0}
            loading={loading}
            iconClass="bg-emerald-500"
          />
          <StatCard
            icon={CheckCircle2}
            label="대기 중"
            value={stats ? stats.total - stats.departed : 0}
            loading={loading}
            iconClass="bg-slate-400"
          />
        </div>

        {/* ── 역할 선택 카드 ───────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-3 max-w-3xl w-full">
          {ROLE_CONFIGS.map((cfg) => (
            <RoleCard key={cfg.href} config={cfg} t={t} />
          ))}
        </div>

      </div>
    </MainLayout>
  );
}
