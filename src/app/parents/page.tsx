
'use client';
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/main-layout";
import { CheckSquare, Edit } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/hooks/use-translation";

export default function ParentsPage() {
  const { t } = useTranslation();
  return (
    <MainLayout>
      <div className="flex flex-col gap-8 items-center justify-center h-full">
        <header className="text-center">
          <h1 className="text-4xl font-bold font-headline">{t('main.title')}</h1>
          <p className="text-muted-foreground mt-2">
            {t('parents.description')}
          </p>
        </header>
        <main className="grid gap-6 md:grid-cols-2 max-w-lg w-full">
          <Button asChild className="h-28 text-lg">
            <Link href="/student">
              <CheckSquare className="mr-4 size-8" /> {t('parents.boarding_check')}
            </Link>
          </Button>
          <Button asChild className="h-28 text-lg">
            <Link href="/apply">
              <Edit className="mr-4 size-8" /> {t('parents.boarding_application')}
            </Link>
          </Button>
        </main>
      </div>
    </MainLayout>
  );
}
