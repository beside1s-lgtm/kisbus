'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
    onBusesUpdate, onStudentsUpdate, onRoutesUpdate, onDestinationsUpdate, 
    onSuggestedDestinationsUpdate, onTeachersUpdate, onAfterSchoolTeachersUpdate,
    onSaturdayTeachersUpdate,
    onAfterSchoolClassesUpdate,
    getBuses, getStudents, getRoutes, getDestinations, getTeachers, getAfterSchoolTeachers,
    getSaturdayTeachers,
    getAfterSchoolClasses,
    updateStudentsInBatch, updateStudent, deleteStudentsInBatch
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, Teacher, DayOfWeek, RouteType, AfterSchoolClass } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Trash2, Check, Bell, ChevronDown, UserCog, Bus as BusIcon, Users, GraduationCap, Activity } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { BusRegistrationTab } from './components/bus-registration-tab';
import { TeacherManagementTab } from './components/teacher-management-tab';
import { BusConfigurationTab } from './components/bus-configuration-tab';
import { StudentManagementTab } from './components/student-management-tab';
import { AdminPageFilter } from './components/admin-page-filter';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const sortBuses = (buses: Bus[]): Bus[] => {
  return [...buses].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.name.localeCompare(b.name, 'ko');
  });
};

const sortDestinations = (destinations: Destination[]): Destination[] => {
    return destinations.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
};

import { AfterSchoolManagementTab } from './components/after-school-management-tab';

const AdminPageContent: React.FC<{
    buses: Bus[];
    students: Student[];
    routes: Route[];
    destinations: Destination[];
    suggestedDestinations: Destination[];
    teachers: Teacher[];
    afterSchoolTeachers: Teacher[];
    saturdayTeachers: Teacher[];
    afterSchoolClasses: AfterSchoolClass[];
    pendingStudents: Student[];
}> = ({
    buses,
    students,
    routes,
    destinations,
    suggestedDestinations,
    teachers,
    afterSchoolTeachers,
    saturdayTeachers,
    afterSchoolClasses,
    pendingStudents,
}) => {
    const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
    const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
    const [activeTab, setActiveTab] = useState('student-management');
    const [selectedGlobalStudent, setSelectedGlobalStudent] = useState<Student | null>(null);
    const { toast } = useToast();
    const { t } = useTranslation();
    const [isClient, setIsClient] = useState(false);
    
    useEffect(() => {
        setIsClient(true);
        
        const now = new Date();
        const vTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60000);
        const h = vTime.getHours();
        const d = vTime.getDay();

        let tDate = new Date(vTime);
        let tType: RouteType = 'Morning';

        if (d >= 1 && d <= 5) {
            if (h < 9) {
                tType = 'Morning';
            } else if (h < 16) {
                tType = 'Afternoon';
            } else if (h < 19) {
                tType = 'AfterSchool';
            } else {
                tDate.setDate(tDate.getDate() + (d === 5 ? 1 : 1));
                tType = 'Morning';
            }
        } else if (d === 6) {
            if (h < 9) {
                tType = 'Morning';
            } else if (h < 14) {
                tType = 'Afternoon';
            } else {
                tDate.setDate(tDate.getDate() + 2);
                tType = 'Morning';
            }
        } else {
            tDate.setDate(tDate.getDate() + 1);
            tType = 'Morning';
        }

        const dayIdx = (tDate.getDay() + 6) % 7;
        setSelectedDay(DAYS[dayIdx < 6 ? dayIdx : 0]);
        setSelectedRouteType(tType);
    }, []);

    const handleAcknowledgeAll = async () => {
        const pendingStudentIds = pendingStudents.map(s => s.id);
        if (pendingStudentIds.length === 0) return;

        try {
            await updateStudentsInBatch(pendingStudentIds.map(id => ({ id, data: { applicationStatus: 'reviewed' } })));
            toast({ title: t('success'), description: t('admin.new_applications.acknowledge_success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.new_applications.acknowledge_error'), variant: "destructive" });
        }
    };
    
    const handleAcknowledgeSingle = async (studentId: string) => {
        try {
            await updateStudent(studentId, { applicationStatus: 'reviewed' });
            toast({ title: t('success'), description: "신청 건을 확인 처리했습니다." });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.new_applications.acknowledge_error'), variant: "destructive" });
        }
    };

    const handleDeleteSingle = async (studentId: string) => {
        try {
            await deleteStudentsInBatch([studentId]);
            toast({ title: t('success'), description: "신청 건을 삭제했습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "신청 건 삭제 중 오류가 발생했습니다.", variant: "destructive" });
        }
    }

    const getDestinationName = (destId: string | null | undefined) => {
        if (!destId) return null;
        return destinations.find(d => d.id === destId)?.name || null;
    }

    const hasNewSuggestion = (student: Student) => {
        return student.suggestedMorningDestination || 
               student.suggestedAfternoonDestination || 
               student.suggestedSatMorningDestination || 
               student.suggestedSatAfternoonDestination;
    };

    const handleManageStudent = (student: Student) => {
        setActiveTab('student-management');
        setSelectedGlobalStudent(student);
        
        setTimeout(() => {
            const el = document.getElementById('student-management-panel');
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 150);
    };
    
    const activeBuses = buses.filter(b => b.isActive !== false);
    const departedBuses = activeBuses.filter(b => b.status === 'departed');

    return (
        <>
            {/* ── 실시간 통계 배너 ── */}
            <div className="flex flex-wrap gap-3 mb-6">
                {[
                    { icon: BusIcon, label: '전체 버스', value: activeBuses.length, iconClass: 'bg-blue-500' },
                    { icon: Activity, label: '운행 중', value: departedBuses.length, iconClass: 'bg-emerald-500' },
                    { icon: Users, label: '전체 학생', value: students.length, iconClass: 'bg-sky-500' },
                    { icon: GraduationCap, label: '교사', value: teachers.length + afterSchoolTeachers.length + saturdayTeachers.length, iconClass: 'bg-violet-500' },
                ].map(({ icon: Icon, label, value, iconClass }) => (
                    <div key={label} className="flex items-center gap-3 bg-card border border-border/50 rounded-xl px-4 py-3 shadow-sm">
                        <div className={cn('p-2 rounded-lg', iconClass)}><Icon className="w-4 h-4 text-white" /></div>
                        <div className="flex flex-col">
                            <span className="text-[11px] text-muted-foreground font-medium leading-none mb-1">{label}</span>
                            <span className="text-base font-bold leading-none">{value}</span>
                        </div>
                    </div>
                ))}
            </div>

            {pendingStudents.length > 0 && (
                 <Collapsible defaultOpen={true} className="mb-6">
                    <Alert>
                        <Bell className="h-4 w-4" />
                        <div className="flex justify-between items-center w-full">
                            <CollapsibleTrigger asChild>
                                <div className="flex items-center cursor-pointer">
                                    <AlertTitle className="flex items-center gap-2">
                                        {t('admin.new_applications.title')}
                                        <Badge variant="destructive" className="animate-pulse">NEW</Badge>
                                    </AlertTitle>
                                    <AlertDescription className="ml-2">({t('admin.new_applications.description', {count: pendingStudents.length})})</AlertDescription>
                                    <ChevronDown className="h-4 w-4 ml-1 transition-transform [&[data-state=open]]:rotate-180" />
                                </div>
                            </CollapsibleTrigger>
                             <Button onClick={handleAcknowledgeAll} size="sm">
                                <Check className="mr-2" /> {t('admin.new_applications.acknowledge_button')}
                            </Button>
                        </div>
                         <CollapsibleContent className="mt-4 space-y-2">
                             {pendingStudents.map(student => (
                                <Card key={student.id} className={cn("p-3 border-l-4", hasNewSuggestion(student) ? "border-l-amber-500 bg-amber-50/30" : "border-l-primary")}>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">{student.name} ({student.grade} {student.class})</p>
                                                {hasNewSuggestion(student) && <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-700 bg-amber-50">신규 목적지 포함</Badge>}
                                            </div>
                                            <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                <p>등교: {getDestinationName(student.morningDestinationId) || (student.suggestedMorningDestination ? <span className="font-bold text-amber-600">{student.suggestedMorningDestination} (신규 요청)</span> : "변경 없음")}</p>
                                                <p>하교: {getDestinationName(student.afternoonDestinationId) || (student.suggestedAfternoonDestination ? <span className="font-bold text-amber-600">{student.suggestedAfternoonDestination} (신규 요청)</span> : "변경 없음")}</p>
                                                <p>토요 등교: {getDestinationName(student.satMorningDestinationId) || (student.suggestedSatMorningDestination ? <span className="font-bold text-amber-600">{student.suggestedSatMorningDestination} (신규 요청)</span> : "변경 없음")}</p>
                                                <p>토요 하교: {getDestinationName(student.satAfternoonDestinationId) || (student.suggestedSatAfternoonDestination ? <span className="font-bold text-amber-600">{student.suggestedSatAfternoonDestination} (신규 요청)</span> : "변경 없음")}</p>
                                                <p>방과후: {Object.entries(student.afterSchoolDestinations || {}).filter(([, destId]) => destId).map(([day, destId]) => `${t(`day_short.${day.toLowerCase()}`)}: ${getDestinationName(destId)}`).join(', ') || "변경 없음"}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => handleManageStudent(student)}>
                                                <UserCog className="mr-1 h-3 w-3" /> 관리
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => handleAcknowledgeSingle(student.id)}>
                                                <Check className="mr-1 h-3 w-3" /> 확인
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button size="sm" variant="destructive">
                                                        <Trash2 className="mr-1 h-3 w-3" /> 삭제
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>정말 이 신청을 삭제하시겠습니까?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {student.name} 학생의 신청 정보가 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteSingle(student.id)}>삭제</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </CollapsibleContent>
                    </Alert>
                </Collapsible>
            )}
            <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="student-management" id="admin-tabs-root" className="w-full">
                <TabsList className="flex flex-wrap h-auto w-full bg-muted p-1 gap-1 sm:grid sm:grid-cols-5">
                    <TabsTrigger value="bus-registration" className="flex-1 text-[10px] sm:text-xs md:text-sm px-2 py-1.5 h-auto min-w-[70px] whitespace-normal sm:whitespace-nowrap">{t('admin.tabs.bus_registration')}</TabsTrigger>
                    <TabsTrigger value="teacher-management" className="flex-1 text-[10px] sm:text-xs md:text-sm px-2 py-1.5 h-auto min-w-[70px] whitespace-normal sm:whitespace-nowrap">{t('admin.tabs.teacher_management')}</TabsTrigger>
                    <TabsTrigger value="bus-configuration" className="flex-1 text-[10px] sm:text-xs md:text-sm px-2 py-1.5 h-auto min-w-[70px] whitespace-normal sm:whitespace-nowrap">{t('admin.tabs.bus_configuration')}</TabsTrigger>
                    <TabsTrigger value="student-management" className="flex-1 text-[10px] sm:text-xs md:text-sm px-2 py-1.5 h-auto min-w-[70px] whitespace-normal sm:whitespace-nowrap">{t('admin.tabs.student_management')}</TabsTrigger>
                    <TabsTrigger value="after-school-management" className="flex-1 text-[10px] sm:text-xs md:text-sm px-2 py-1.5 h-auto min-w-[70px] whitespace-normal sm:whitespace-nowrap">방과후 수업 관리</TabsTrigger>
                </TabsList>
                <TabsContent value="bus-registration" className="mt-6">
                    <BusRegistrationTab buses={buses} routes={routes} destinations={destinations} />
                </TabsContent>
                 <TabsContent value="teacher-management" className="mt-6">
                    <TeacherManagementTab teachers={teachers} afterSchoolTeachers={afterSchoolTeachers} saturdayTeachers={saturdayTeachers} buses={buses} routes={routes} destinations={destinations} />
                </TabsContent>
                <TabsContent value="bus-configuration" className="mt-6">
                     <AdminPageFilter
                        buses={buses}
                        routes={routes}
                        selectedBusId={selectedBusId}
                        setSelectedBusId={setSelectedBusId}
                        selectedDay={selectedDay}
                        setSelectedDay={setSelectedDay}
                        selectedRouteType={selectedRouteType}
                        setSelectedRouteType={setSelectedRouteType}
                        days={DAYS}
                    />
                    <BusConfigurationTab
                        buses={buses}
                        routes={routes}
                        destinations={destinations}
                        suggestedDestinations={suggestedDestinations}
                        selectedDay={selectedDay}
                        selectedRouteType={selectedRouteType}
                        selectedBusId={selectedBusId}
                    />
                </TabsContent>
                <TabsContent value="student-management" className="mt-6">
                    <div id="student-management-panel" className="scroll-mt-20">
                        <AdminPageFilter
                            buses={buses}
                            routes={routes}
                            selectedBusId={selectedBusId}
                            setSelectedBusId={setSelectedBusId}
                            selectedDay={selectedDay}
                            setSelectedDay={setSelectedDay}
                            selectedRouteType={selectedRouteType}
                            setSelectedRouteType={setSelectedRouteType}
                            days={DAYS}
                            filterConfiguredBusesOnly={true}
                            showRouteStops={true}
                            destinations={destinations}
                        />
                        <StudentManagementTab 
                            students={students} 
                            buses={buses}
                            routes={routes} 
                            destinations={destinations}
                            selectedBusId={selectedBusId}
                            selectedDay={selectedDay}
                            selectedRouteType={selectedRouteType}
                            days={DAYS}
                            selectedGlobalStudent={selectedGlobalStudent}
                            setSelectedGlobalStudent={setSelectedGlobalStudent}
                            afterSchoolClasses={afterSchoolClasses}
                            teachers={teachers}
                            afterSchoolTeachers={afterSchoolTeachers}
                            saturdayTeachers={saturdayTeachers}
                        />
                    </div>
                </TabsContent>
                <TabsContent value="after-school-management" className="mt-6">
                    <AfterSchoolManagementTab
                        afterSchoolClasses={afterSchoolClasses}
                        students={students}
                        buses={buses}
                        routes={routes}
                        teachers={teachers}
                        afterSchoolTeachers={afterSchoolTeachers}
                        destinations={destinations}
                    />
                </TabsContent>
            </Tabs>
        </>
    );
};

export default function AdminPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [buses, setBuses] = useState<Bus[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [suggestedDestinations, setSuggestedDestinations] = useState<Destination[]>([]);
    const [afterSchoolClasses, setAfterSchoolClasses] = useState<AfterSchoolClass[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [afterSchoolTeachers, setAfterSchoolTeachers] = useState<Teacher[]>([]);
    const [saturdayTeachers, setSaturdayTeachers] = useState<Teacher[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [pendingStudents, setPendingStudents] = useState<Student[]>([]);
    const { t } = useTranslation();
    
    useEffect(() => {
        if (!authLoading && !user) {
          router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (!user || authLoading) return;
        
        setDataLoading(true);
        const unsubscribers = [
            onBusesUpdate(data => setBuses(sortBuses(data))),
            onStudentsUpdate(data => {
                setStudents(data);
                setPendingStudents(data.filter(s => s.applicationStatus === 'pending'));
            }),
            onRoutesUpdate(setRoutes),
            onDestinationsUpdate(data => setDestinations(sortDestinations(data))),
            onSuggestedDestinationsUpdate(setSuggestedDestinations),
            onTeachersUpdate(data => setTeachers([...data].sort((a, b) => a.name.localeCompare(b.name, 'ko')))),
            onAfterSchoolTeachersUpdate(data => setAfterSchoolTeachers([...data].sort((a, b) => a.name.localeCompare(b.name, 'ko')))),
            onSaturdayTeachersUpdate(data => setSaturdayTeachers([...data].sort((a, b) => a.name.localeCompare(b.name, 'ko')))),
            onAfterSchoolClassesUpdate(setAfterSchoolClasses),
        ];

        Promise.all([
            getBuses(),
            getStudents(),
            getRoutes(),
            getDestinations(),
            getTeachers(),
            getAfterSchoolTeachers(),
            getSaturdayTeachers(),
        ]).then(() => {
            setDataLoading(false);
        }).catch(error => {
            console.error("Error fetching initial data:", error);
            setDataLoading(false);
        });

        return () => {
            unsubscribers.forEach(unsubscribe => unsubscribe());
        };
    }, [user, authLoading]);

    if (authLoading || dataLoading) {
        return (
            <MainLayout>
                <div className="space-y-6">
                    {/* 통계 배너 Skeleton */}
                    <div className="flex flex-wrap gap-3">
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="flex items-center gap-3 bg-card border border-border/50 rounded-xl px-4 py-3 shadow-sm">
                                <Skeleton className="w-9 h-9 rounded-lg" />
                                <div className="flex flex-col gap-1.5">
                                    <Skeleton className="h-3 w-14 rounded" />
                                    <Skeleton className="h-5 w-8 rounded" />
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* 탭 Skeleton */}
                    <div className="space-y-4">
                        <Skeleton className="h-10 w-full rounded-lg" />
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="bg-card border border-border/50 rounded-xl p-5 space-y-3 shadow-sm">
                                    <Skeleton className="h-4 w-2/3 rounded" />
                                    <Skeleton className="h-3 w-full rounded" />
                                    <Skeleton className="h-3 w-4/5 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </MainLayout>
        );
    }

    return (
        <MainLayout>
            <AdminPageContent
                buses={buses}
                students={students}
                routes={routes}
                destinations={destinations}
                suggestedDestinations={suggestedDestinations}
                teachers={teachers}
                afterSchoolTeachers={afterSchoolTeachers}
                saturdayTeachers={saturdayTeachers}
                pendingStudents={pendingStudents}
                afterSchoolClasses={afterSchoolClasses}
            />
        </MainLayout>
    );
}
