
'use client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { ArrowRight, UserCog, User, ShieldCheck, CheckSquare, Edit } from "lucide-react";
import Link from "next/link";
import { MainLayout } from "@/components/layout/main-layout";
import { useState }from 'react';
import { Button } from "@/components/ui/button";

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

export default function Home() {
    const [showStudentOptions, setShowStudentOptions] = useState(false);

  return (
    <MainLayout>
        <div className="flex flex-col gap-8 items-center justify-center h-full">
            <header className="text-center">
                <h1 className="text-4xl font-bold font-headline">KIS 스쿨버스 시스템</h1>
                <p className="text-muted-foreground mt-2">역할을 선택하여 시작하세요.</p>
            </header>
            <main className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-4xl w-full">
                <RoleCard 
                    href="/login"
                    icon={ShieldCheck}
                    title="관리자"
                    description="버스, 노선, 학생 등 시스템 전체를 관리합니다."
                />
                <RoleCard 
                    href="/teacher"
                    icon={UserCog}
                    title="선생님"
                    description="학생들의 탑승 여부를 확인하고 출결을 관리합니다."
                />
                 <Card className="h-full">
                    <div onClick={() => setShowStudentOptions(!showStudentOptions)} className="cursor-pointer group">
                        <CardHeader className="flex flex-row items-center gap-4 pb-2">
                            <div className="bg-primary p-3 rounded-lg flex items-center justify-center">
                                <User className="text-primary-foreground size-6" />
                            </div>
                            <div>
                                <CardTitle className="font-headline">학부모/학생</CardTitle>
                                <CardDescription>배정된 좌석을 확인하고 탑승을 신청합니다.</CardDescription>
                            </div>
                        </CardHeader>
                        {!showStudentOptions && (
                             <CardContent className="flex justify-end pt-4">
                                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </CardContent>
                        )}
                    </div>
                    {showStudentOptions && (
                        <CardContent className="flex flex-col sm:flex-row gap-2 pt-4">
                            <Button asChild className="w-full">
                                <Link href="/student">
                                    <CheckSquare className="mr-2"/> 탑승 확인
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="w-full">
                                <Link href="/apply">
                                    <Edit className="mr-2"/> 탑승 신청
                                </Link>
                            </Button>
                        </CardContent>
                    )}
                </Card>
            </main>
        </div>
    </MainLayout>
  );
}
