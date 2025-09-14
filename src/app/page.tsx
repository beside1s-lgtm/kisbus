
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, Bus, ClipboardPenLine, User, UserCog } from "lucide-react";
import Link from "next/link";

interface FeatureCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

function FeatureCard({ href, icon: Icon, title, description }: FeatureCardProps) {
  return (
    <Link href={href} className="block group">
      <Card className="h-full hover:border-primary transition-colors">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold font-headline">{title}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
         <div className="flex justify-end p-4 pt-0">
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </div>
      </Card>
    </Link>
  );
}

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
        <header className="flex items-center gap-4">
             <div className="bg-primary p-3 rounded-lg flex items-center justify-center">
              <Bus className="text-primary-foreground size-8" />
            </div>
            <div>
                <h1 className="text-3xl font-bold font-headline">KIS 스쿨버스 시스템</h1>
                <p className="text-muted-foreground">스쿨버스 좌석 배정 및 탑승 관리를 위한 통합 대시보드</p>
            </div>
        </header>
        <main className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FeatureCard 
                href="/admin"
                icon={UserCog}
                title="관리자"
                description="버스, 노선, 학생 정보를 관리하고 좌석을 배정합니다."
            />
            <FeatureCard 
                href="/teacher"
                icon={UserCog}
                title="선생님"
                description="학생들의 탑승 여부를 확인하고 출결을 관리합니다."
            />
            <FeatureCard 
                href="/student"
                icon={User}
                title="탑승 확인"
                description="배정된 좌석과 실시간 탑승 현황을 조회합니다."
            />
            <FeatureCard 
                href="/apply"
                icon={ClipboardPenLine}
                title="탑승 신청"
                description="스쿨버스 탑승을 신청하거나 신규 목적지를 제안합니다."
            />
        </main>
    </div>
  );
}
