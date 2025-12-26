

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
  const [routes, setRoutes] = useState<Route[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [boardedStudentIds, setBoardedStudentIds] = useState<string[]>([]);
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { toast } = useToast();
  const [studentToConfirmAbsence, setStudentToConfirmAbsence] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);

  const days: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
  
  useEffect(() => {
    setLoading(true);
    const unsubscribers = [
      onBusesUpdate((data) => setBuses(sortBuses(data))),
      onStudentsUpdate(setAllStudents),
      onRoutesUpdate(setRoutes),
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
    const dayIndex = getDay(new Date()); // 0:Sun, 1:Mon, ..., 6:Sat

    const currentDay = (dayIndex > 0 && dayIndex < 7) ? days[dayIndex - 1] : 'Monday';
    setSelectedDay(currentDay);
    
    if (dayIndex === 6) { // Saturday
        setSelectedRouteType('AfterSchool');
    } else {
        const now = new Date();
        const vietnamHour = (now.getUTCHours() + 7) % 24;
        if (vietnamHour >= 16) {
            setSelectedRouteType('AfterSchool');
        } else if (vietnamHour >= 11) {
            setSelectedRouteType('Afternoon');
        } else {
            setSelectedRouteType('Morning');
        }
    }
  }, [days]);

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
    if (!selectedStudent) return null;
    return routes.find(r => 
        r.dayOfWeek === selectedDay && 
        r.type === selectedRouteType && 
        r.seating.some(s => s.studentId === selectedStudent.id)
    );
  }, [routes, selectedStudent, selectedDay, selectedRouteType]);

  const selectedBus = useMemo(() => {
      if (!studentRoute) return null;
      return buses.find(b => b.id === studentRoute.busId);
  }, [buses, studentRoute]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (studentRoute && today) {
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
  }, [studentRoute, today]);

  const findRoutesForStudent = useCallback(async (student: Student): Promise<Route[]> => {
    const studentDay = selectedDay;

    let destId: string | null = null;
    if (selectedRouteType === 'Morning') destId = student.morningDestinationId;
    else if (selectedRouteType === 'Afternoon') destId = student.afternoonDestinationId;
    else if (selectedRouteType === 'AfterSchool') destId = student.afterSchoolDestinations?.[studentDay] || null;

    if (!destId) return [];
    
    return routes.filter(r =>
      r.stops.includes(destId!) &&
      r.dayOfWeek === studentDay &&
      r.type === selectedRouteType
    );
  }, [selectedDay, selectedRouteType, routes]);

  const toggleAbsence = useCallback(async (studentId: string) => {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    if (boardedStudentIds.includes(studentId)) {
        toast({ title: t('notice'), description: t('student_page.already_boarded_error'), variant: 'default' });
        return;
    }
    
    const studentRoutes = await findRoutesForStudent(student);
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
  }, [today, toast, findRoutesForStudent, allStudents, boardedStudentIds, t]);

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
                        routeType={selectedRouteType}
                        dayOfWeek={selectedDay}
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

