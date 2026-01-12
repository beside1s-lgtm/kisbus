
'use client';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, UserCog, User, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { useTranslation } from "@/hooks/use-translation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';

interface RoleCardProps {
  href: string;
  icon: React.ElementType;
  title: string;
  description: string;
}

function RoleCard({ href, icon: Icon, title, description }: RoleCardProps) {
  return (
    <Link href={href} className="block group">
      <Card className="h-full hover:border-primary transition-colors">
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
          <div className="bg-primary p-3 rounded-lg flex items-center justify-center">
            <Icon className="text-primary-foreground size-6" />
          </div>
          <div>
            <CardTitle className="font-headline">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex justify-end pt-4">
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </CardContent>
      </Card>
    </Link>
  );
}

function HomeComponent() {
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isParent = sessionStorage.getItem('isParent');
      if (isParent) {
        router.replace('/parents');
      }
    }
  }, [router]);

  return (
    <MainLayout>
      <div className="flex flex-col gap-8 items-center justify-center h-full">
        <header className="text-center">
          <h1 className="text-4xl font-bold font-headline" dangerouslySetInnerHTML={{ __html: t("main.title") }} />
          <p className="text-muted-foreground mt-2">{t("main.select_role")}</p>
        </header>

        <main className="grid gap-6 md:grid-cols-3 max-w-4xl w-full">
          <RoleCard
            href="/login"
            icon={ShieldCheck}
            title={t("role.admin")}
            description={t("role.admin.description")}
          />
          <RoleCard
            href="/teacher"
            icon={UserCog}
            title={t("role.teacher")}
            description={t("role.teacher.description")}
          />
          <RoleCard
            href="/parents"
            icon={User}
            title={t("role.parent")}
            description={t("role.parent.description")}
          />
        </main>
      </div>
    </MainLayout>
  );
}

export default dynamic(() => Promise.resolve(HomeComponent), { ssr: false });
