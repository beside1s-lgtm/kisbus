'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
    onBusesUpdate, onStudentsUpdate, onRoutesUpdate, onDestinationsUpdate, 
    onSuggestedDestinationsUpdate, onTeachersUpdate,
    getBuses, getStudents, getRoutes, getDestinations, getTeachers,
    updateStudentsInBatch, updateStudent, deleteStudentsInBatch
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, Teacher, DayOfWeek, RouteType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, Check, Bell, ChevronDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';
import { useTranslation } from '@/hooks/use-translation';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getDay, isSunday, format } from 'date-fns';

// 분리한 컴포넌트 임포트
import { BusRegistrationTab } from './components/bus-registration-tab';
import { TeacherManagementTab } from './components/teacher-management-tab';
import { BusConfigurationTab } from './components/bus-configuration-tab';
import { StudentManagementTab } from './components/student-management-tab';
import { AdminPageFilter } from './components/admin-page-filter';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const sortBuses = (buses: Bus[]): Bus[] => {
  return buses.sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.name.localeCompare(b.name);
  });
};

const sortDestinations = (destinations: Destination[]): Destination[] => {
    return destinations.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
};

const AdminPageContent: React.FC<{
    buses: Bus[];
    students: Student[];
    routes: Route[];
    destinations: Destination[];
    suggestedDestinations: Destination[];
    teachers: Teacher[];
    pendingStudents: Student[];
}> = ({
    buses,
    students,
    routes,
    destinations,
    suggestedDestinations,
    teachers,
    pendingStudents,
}) => {
    const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
    const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
    const [activeTab, setActiveTab] = useState('student-management');
    const { toast } = useToast();
    const { t } = useTranslation();
    const [isClient, setIsClient] = useState(false);
    
    // 사용자가 수동으로 선택한 값을 보호하기 위해 마지막으로 처리한 날짜를 추적
    const lastProcessedDateRef = useRef<string | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (isClient && !selectedDate) {
            setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
        }
    }, [isClient, selectedDate]);

    useEffect(() => {
        if (selectedDate) {
            const isNewDate = selectedDate !== lastProcessedDateRef.current;
            const targetDate = new Date(selectedDate);
            
            // 요일은 날짜가 바뀔 때마다 업데이트 (항상 날짜와 동기화되어야 함)
            if (isSunday(targetDate)) {
                setSelectedDay('Monday');
            } else {
                const dayIndex = getDay(targetDate);
                setSelectedDay(DAYS[dayIndex - 1]);
            }

            // 노선 타입은 날짜가 실제로 변경되었을 때만 기본값으로 설정
            // 이를 통해 리렌더링 시 사용자의 수동 선택이 유지됨
            if (isNewDate) {
                lastProcessedDateRef.current = selectedDate;
                
                if (format(targetDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
                    const now = new Date();
                    const vietnamHour = (now.getUTCHours() + 7) % 24;

                    if (vietnamHour >= 9 && vietnamHour < 15) {
                        setSelectedRouteType('Afternoon');
                    } else if (vietnamHour >= 15 && vietnamHour < 20) {
                        setSelectedRouteType('AfterSchool');
                    } else {
                        setSelectedRouteType('Morning');
                    }
                } else {
                    setSelectedRouteType('Morning');
                }
            }
        }
    }, [selectedDate]);

    const handleAcknowledgeAll = async () => {
        const pendingStudentIds = pendingStudents.map(s => s.id);
        if (pendingStudentIds.length === 0) return;

        try {
            await updateStudentsInBatch(pendingStudentIds.map(id => ({ id, applicationStatus: 'reviewed' })));
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
    
    return (
        <>
            {pendingStudents.length > 0 && (
                 <Collapsible defaultOpen={true} className="mb-6">
                    <Alert>
                        <Bell className="h-4 w-4" />
                        <div className="flex justify-between items-center w-full">
                            <CollapsibleTrigger asChild>
                                <div className="flex items-center cursor-pointer">
                                    <AlertTitle>{t('admin.new_applications.title')}</AlertTitle>
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
                                <Card key={student.id} className="p-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">{student.name} ({student.grade} {student.class})</p>
                                            <div className="text-xs text-muted-foreground mt-1 space-y-1">
                                                <p>등교: {getDestinationName(student.morningDestinationId) || student.suggestedMorningDestination || "변경 없음"}</p>
                                                <p>하교: {getDestinationName(student.afternoonDestinationId) || student.suggestedAfternoonDestination || "변경 없음"}</p>
                                                <p>방과후: {Object.entries(student.afterSchoolDestinations || {}).filter(([, destId]) => destId).map(([day, destId]) => `${t(`day_short.${day.toLowerCase()}`)}: ${getDestinationName(destId)}`).join(', ') || "변경 없음"}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
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
            <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="student-management">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="bus-registration">{t('admin.tabs.bus_registration')}</TabsTrigger>
                    <TabsTrigger value="teacher-management">{t('admin.tabs.teacher_management')}</TabsTrigger>
                    <TabsTrigger value="bus-configuration">{t('admin.tabs.bus_configuration')}</TabsTrigger>
                    <TabsTrigger value="student-management">{t('admin.tabs.student_management')}</TabsTrigger>
                </TabsList>
                <TabsContent value="bus-registration" className="mt-6">
                    <BusRegistrationTab buses={buses} routes={routes} destinations={destinations} />
                </TabsContent>
                 <TabsContent value="teacher-management" className="mt-6">
                    <TeacherManagementTab teachers={teachers} buses={buses} routes={routes} />
                </TabsContent>
                <TabsContent value="bus-configuration" className="mt-6">
                     <AdminPageFilter
                        buses={buses}
                        routes={routes}
                        selectedBusId={selectedBusId}
                        setSelectedBusId={setSelectedBusId}
                        selectedDate={selectedDate}
                        setSelectedDate={setSelectedDate}
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
                    <AdminPageFilter
                        buses={buses}
                        routes={routes}
                        selectedBusId={selectedBusId}
                        setSelectedBusId={setSelectedBusId}
                        selectedDate={selectedDate}
                        setSelectedDate={setSelectedDate}
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
    const [teachers, setTeachers] = useState<Teacher[]>([]);
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
            onTeachersUpdate(data => setTeachers(data.sort((a, b) => a.name.localeCompare(b.name, 'ko')))),
        ];

        Promise.all([
            getBuses(),
            getStudents(),
            getRoutes(),
            getDestinations(),
            getTeachers(),
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
                <div className="flex justify-center items-center h-64">
                    <p>{t('loading.data')}</p>
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
                pendingStudents={pendingStudents}
            />
        </MainLayout>
    );
}
