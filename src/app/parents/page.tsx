
import { Button } from "@/components/ui/button";
import { MainLayout } from "@/components/layout/main-layout";
import { CheckSquare, Edit } from "lucide-react";
import Link from "next/link";

export default function ParentsPage() {
  return (
    <MainLayout>
      <div className="flex flex-col gap-8 items-center justify-center h-full">
        <header className="text-center">
          <h1 className="text-4xl font-bold font-headline">학부모 / 학생</h1>
          <p className="text-muted-foreground mt-2">
            원하시는 서비스를 선택하세요.
          </p>
        </header>
        <main className="grid gap-6 md:grid-cols-2 max-w-lg w-full">
          <Button asChild className="h-28 text-lg">
            <Link href="/student">
              <CheckSquare className="mr-4 size-8" /> 탑승 확인
            </Link>
          </Button>
          <Button asChild className="h-28 text-lg">
            <Link href="/apply">
              <Edit className="mr-4 size-8" /> 탑승 신청
            </Link>
          </Button>
        </main>
      </div>
    </MainLayout>
  );
}
