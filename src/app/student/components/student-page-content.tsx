

'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { onBusesUpdate, onStudentsUpdate, onRoutesUpdate, onDestinationsUpdate, onLostItemsUpdate, getAttendance, updateAttendance, onAttendanceUpdate } from '@/lib/firebase-data';
import type { Bus, Student, Route, DayOfWeek, RouteType, Destination, LostItem } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MainLayout } from '@/components/layout/main-layout';
import { format, getDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LostAndFound } from '@/app/teacher/components/lost-and-found';
import { useTranslation } from '@/hooks/use-translation';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

export function StudentPageContent() {
  const { t } = useTranslation();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [boardedStudentIds, setBoardedStudentIds] = useState<string[]>([]);
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { toast } = useToast();
  const [studentToConfirmAbsence, setStudentToConfirmAbsence] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isClient, setIsClient] = useState(false);

  const [assignedRoutes, setAssignedRoutes] = useState<Route[]>([]);
  const [viewingDay, setViewingDay] = useState<DayOfWeek | null>(null);
  const [viewingRouteType, setViewingRouteType] = useState<RouteType | null>(null);

  const days: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    setLoading(true);
    const unsubscribers = [
      onBusesUpdate((data) => setBuses(sortBuses(data))),
      onStudentsUpdate(setAllStudents),
      onRoutesUpdate(setAllRoutes),
      onDestinationsUpdate(setDestinations),
      onLostItemsUpdate(setLostItems),
    ];
    setLoading(false);

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);


  const formatStudentName = (student: Student | null) => {
    if (!student) return '';
    const grade = student.grade.toUpperCase();
    const studentClass = student.class;
    return `${grade}${studentClass} ${student.name}`;
  }

   useEffect(() => {
    if (selectedStudent && allRoutes.length > 0) {
        const studentRoutes = allRoutes.filter(route => 
            route.seating.some(seat => seat.studentId === selectedStudent.id)
        );
        setAssignedRoutes(studentRoutes);

        if (studentRoutes.length > 0) {
            const todayIndex = getDay(new Date()); // 0:Sun, 1:Mon
            const dayOrder: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Monday'];
            
            let closestDay: DayOfWeek | null = null;
            let closestRouteType: RouteType | null = null;
            
            for(let i=0; i < 7; i++) {
                const checkDayIndex = (todayIndex -1 + i) % 7;
                const checkDay = dayOrder[checkDayIndex];
                const routesForDay = studentRoutes.filter(r => r.dayOfWeek === checkDay).sort((a,b) => {
                    if(a.type === 'Morning') return -1;
                    if(b.type === 'Morning') return 1;
                    if(a.type === 'Afternoon') return -1;
                    if(b.type === 'Afternoon') return 1;
                    return 0;
                });
                
                if(routesForDay.length > 0){
                    closestDay = routesForDay[0].dayOfWeek;
                    closestRouteType = routesForDay[0].type;
                    break;
                }
            }
            setViewingDay(closestDay);
            setViewingRouteType(closestRouteType);
        } else {
            setViewingDay(null);
            setViewingRouteType(null);
        }
    } else {
        setAssignedRoutes([]);
        setViewingDay(null);
        setViewingRouteType(null);
    }
}, [selectedStudent, allRoutes]);

  useEffect(() => {
    const dateCheckInterval = setInterval(() => {
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      if (currentDate !== today) {
        setToday(currentDate);
      }
    }, 60000);

    return () => {
      clearInterval(dateCheckInterval);
    };
  }, [today]);
  
  const studentRoute = useMemo(() => {
    if (!selectedStudent || !viewingDay || !viewingRouteType) return null;
    return assignedRoutes.find(r => 
        r.dayOfWeek === viewingDay && 
        r.type === viewingRouteType
    );
  }, [assignedRoutes, selectedStudent, viewingDay, viewingRouteType]);

  const selectedBus = useMemo(() => {
      if (!studentRoute) return null;
      return buses.find(b => b.id === studentRoute.busId);
  }, [buses, studentRoute]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (studentRoute && today && studentRoute.dayOfWeek === days[getDay(new Date()) - 1]) {
      unsubscribe = onAttendanceUpdate(studentRoute.id, today, (attendance) => {
        setBoardedStudentIds(attendance?.boarded || []);
        setAbsentStudentIds(attendance?.absent || []);
      });
    } else {
        setBoardedStudentIds([]);
        setAbsentStudentIds([]);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [studentRoute, today, days]);

  const findRoutesForStudent = useCallback(async (student: Student, day: DayOfWeek, routeType: RouteType): Promise<Route[]> => {
    let destId: string | null = null;
    if (routeType === 'Morning') destId = student.morningDestinationId;
    else if (routeType === 'Afternoon') destId = student.afternoonDestinationId;
    else if (routeType === 'AfterSchool') destId = student.afterSchoolDestinations?.[day] || null;

    if (!destId) return [];
    
    return allRoutes.filter(r =>
      r.stops.includes(destId!) &&
      r.dayOfWeek === day &&
      r.type === routeType
    );
  }, [allRoutes]);

  const toggleAbsence = useCallback(async (studentId: string) => {
    const student = allStudents.find(s => s.id === studentId);
    if (!student || !viewingDay || !viewingRouteType) return;

    if (boardedStudentIds.includes(studentId)) {
        toast({ title: t('notice'), description: t('student_page.already_boarded_error'), variant: 'default' });
        return;
    }
    
    const studentRoutes = await findRoutesForStudent(student, viewingDay, viewingRouteType);
    if (studentRoutes.length === 0) {
      toast({ title: t('notice'), description: t('student_page.no_route_info_error'), variant: 'destructive'});
      return;
    }
    
    studentRoutes.forEach(async (route) => {
      const attendance = await getAttendance(route.id, today);
      const currentBoarded = attendance?.boarded || [];
      const currentAbsent = attendance?.absent || [];
      
      const isAbsent = currentAbsent.includes(student.id);

      const newAbsentIds = isAbsent
        ? currentAbsent.filter(id => id !== student.id)
        : [...currentAbsent, student.id];

      const newBoardedIds = isAbsent 
        ? currentBoarded
        : currentBoarded.filter(id => id !== student.id);

      try {
        await updateAttendance(route.id, today, { absent: newAbsentIds, boarded: newBoardedIds });
        toast({ title: t('success'), description: t('student_page.absence_update_success', { studentName: formatStudentName(student) })});
      } catch (error) {
        console.error("Error updating absence:", error);
        toast({ title: t('error'), description: t('student_page.absence_update_error', { routeId: route.id }), variant: "destructive"});
      }
    });
  }, [today, toast, findRoutesForStudent, allStudents, boardedStudentIds, t, viewingDay, viewingRouteType]);

 const handleSeatClick = useCallback((seatNumber: number, studentId: string | null) => {
      if (!studentId || !selectedStudent || studentId !== selectedStudent.id) return;
      
      if (boardedStudentIds.includes(studentId)) {
        toast({ title: t('notice'), description: t('student_page.already_boarded_error'), variant: 'default' });
        return;
      }

      if (absentStudentIds.includes(studentId)) {
          toggleAbsence(studentId);
      } else {
          setStudentToConfirmAbsence(selectedStudent);
      }
  }, [toggleAbsence, selectedStudent, absentStudentIds, boardedStudentIds, toast, t]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
        setSearchResults([]);
        return;
    }
    const lowerCaseQuery = searchQuery.toLowerCase();
    const results = allStudents.filter(s => s.name.toLowerCase().includes(lowerCaseQuery));
    setSearchResults(results);
  }, [searchQuery, allStudents]);

  const handleSelectStudentFromSearch = (student: Student) => {
      setSelectedStudent(student);
      setSearchQuery('');
      setSearchResults([]);
  };

  const getRouteTypeLabel = (routeType: RouteType) => {
    return t(`route_type.${routeType.toLowerCase()}`);
  }

  const headerContent = (
    <div className="relative w-full max-w-sm">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
          type="search"
          placeholder={t('teacher_page.search_student_placeholder')}
          className="pl-8 w-full"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
      />
      {searchResults.length > 0 && (
          <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
              <CardContent className="p-2">
                  {searchResults.map(student => (
                      <div key={student.id} 
                           className="p-2 text-sm hover:bg-accent rounded-md cursor-pointer"
                           onClick={() => handleSelectStudentFromSearch(student)}>
                          {formatStudentName(student)}
                      </div>
                  ))}
              </CardContent>
          </Card>
      )}
    </div>
  );

  return (
    <MainLayout headerContent={headerContent}>
      {loading ? (
        <div className="flex justify-center items-center h-64">
            <p>{t('loading.data')}</p>
        </div>
      ) : (
        <div className="space-y-6">
            <AlertDialog
                open={!!studentToConfirmAbsence}
                onOpenChange={(open) => !open && setStudentToConfirmAbsence(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('student_page.absence_confirm_title')}</AlertDialogTitle>
                        <AlertDialogDescription>
                           {t('student_page.absence_confirm_description', { studentName: studentToConfirmAbsence?.name })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (studentToConfirmAbsence) {
                                    toggleAbsence(studentToConfirmAbsence.id);
                                }
                                setStudentToConfirmAbsence(null);
                            }}
                        >
                            {t('confirm')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <Card>
            <CardHeader>
                <CardTitle className="font-headline">{t('student_page.title')}</CardTitle>
                <CardDescription>
                {selectedStudent ? t('student_page.description') : '학생 이름을 검색하여 탑승 정보를 확인하세요.'}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {selectedStudent && assignedRoutes.length > 0 && (
                    <div className="mb-4">
                        <div className="flex flex-wrap gap-2">
                            {days.map(day => {
                                const routesForDay = assignedRoutes.filter(r => r.dayOfWeek === day);
                                if (routesForDay.length === 0) return null;
                                return routesForDay.map(route => (
                                    <Button
                                        key={`${day}-${route.type}`}
                                        variant={viewingDay === day && viewingRouteType === route.type ? 'default' : 'outline'}
                                        onClick={() => {
                                            setViewingDay(day);
                                            setViewingRouteType(route.type);
                                        }}
                                    >
                                        {t(`day_short.${day.toLowerCase()}`)} {getRouteTypeLabel(route.type)}
                                    </Button>
                                ));
                            })}
                        </div>
                    </div>
                )}
                {selectedStudent && studentRoute && selectedBus ? (
                    <BusSeatMap 
                        bus={selectedBus}
                        seating={studentRoute.seating}
                        students={allStudents}
                        destinations={destinations}
                        onSeatClick={handleSeatClick}
                        highlightedStudentId={selectedStudent.id}
                        boardedStudentIds={boardedStudentIds}
                        absentStudentIds={absentStudentIds}
                        routeType={viewingRouteType || 'Morning'}
                        dayOfWeek={viewingDay || 'Monday'}
                    />
                ) : (
                    <Alert>
                        <AlertTitle>{selectedStudent ? t('no_route_info') : '학생을 선택하세요'}</AlertTitle>
                        <AlertDescription>
                            {selectedStudent ? t('no_route_info_description') : '상단 검색창에서 학생 이름을 검색하여 선택해주세요.'}
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            </Card>
            
            <LostAndFound 
                lostItems={lostItems}
                setLostItems={setLostItems}
                buses={buses}
                isReadOnly={true}
            />
        </div>
      )}
    </MainLayout>
  );
}

