
'use client';

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, UserCog, User, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { useTranslation } from "@/hooks/use-translation";
import { useRouter } from "next/navigation";

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

export default function HomePage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    if (typeof window !== 'undefined') {
      const isParent = sessionStorage.getItem('isParent');
      if (isParent) {
        router.replace('/parents');
      }
    }
  }, [router]);
  
  useEffect(() => {
    // Clear the parent flag when returning to the home page
    // This allows users to switch roles if they navigate back to home.
    if (typeof window !== 'undefined' && window.location.pathname === '/') {
      sessionStorage.removeItem('isParent');
    }
  }, []);

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

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
