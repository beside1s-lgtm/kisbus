'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { onBusesUpdate, onStudentsUpdate, onRoutesUpdate, onDestinationsUpdate, onLostItemsUpdate, getAttendance, updateAttendance, onAttendanceUpdate } from '@/lib/firebase-data';
import type { Bus, Student, Route, DayOfWeek, RouteType, Destination, LostItem, AttendanceRecord } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MainLayout } from '@/components/layout/main-layout';
import { format, getDay, isSaturday, isSunday, formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LostAndFound } from '@/app/teacher/components/lost-and-found';
import { useTranslation } from '@/hooks/use-translation';
import { Search, Info, CheckCircle, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

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
  const { t, i18n } = useTranslation();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const { toast } = useToast();
  const [studentToConfirm, setStudentToConfirm] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [isClient, setIsClient] = useState(false);

  const [assignedRoutes, setAssignedRoutes] = useState<Route[]>([]);
  const [viewingDay, setViewingDay] = useState<DayOfWeek | null>(null);
  const [viewingRouteType, setViewingRouteType] = useState<RouteType | null>(null);

  const days: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
  const routeTypeOrder: RouteType[] = useMemo(() => ['Morning', 'Afternoon', 'AfterSchool'], []);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  useEffect(() => {
    if (isClient && !selectedDate) {
        setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [isClient, selectedDate]);
  
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
    if (selectedStudent && allRoutes.length > 0 && selectedDate) {
        const studentRoutes = allRoutes.filter(route => 
            route.seating.some(seat => seat.studentId === selectedStudent.id)
        );
        setAssignedRoutes(studentRoutes);

        const targetDate = new Date(selectedDate);
        if (isSunday(targetDate)) {
             setViewingDay(null);
             setViewingRouteType(null);
             return;
        }

        const dayIndex = getDay(targetDate); 
        const dayOfWeek = days[dayIndex - 1];

        const routesForDay = studentRoutes
          .filter(r => r.dayOfWeek === dayOfWeek)
          .sort((a,b) => routeTypeOrder.indexOf(a.type) - routeTypeOrder.indexOf(b.type));

        if (routesForDay.length > 0) {
            setViewingDay(dayOfWeek);
            
            if (format(targetDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
                const now = new Date();
                const vietnamHour = (now.getUTCHours() + 7) % 24;
                
                if (vietnamHour >= 9 && vietnamHour < 15) {
                    setViewingRouteType('Afternoon');
                } else if (vietnamHour >= 15 && vietnamHour < 20) {
                    setViewingRouteType('AfterSchool');
                } else {
                    setViewingRouteType('Morning');
                }
            } else {
                setViewingRouteType(routesForDay[0].type); 
            }
        } else {
            setViewingDay(null);
            setViewingRouteType(null);
        }

    } else {
        setAssignedRoutes([]);
        setViewingDay(null);
        setViewingRouteType(null);
    }
}, [selectedStudent, allRoutes, selectedDate, days, routeTypeOrder]);

  
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
    
    if (!studentRoute || !selectedDate) {
        setAttendance(null);
        return;
    };

    const targetDayOfWeek = days[getDay(new Date(selectedDate)) - 1];

    if (studentRoute.dayOfWeek === targetDayOfWeek) {
      unsubscribe = onAttendanceUpdate(studentRoute.id, selectedDate, (attendance) => {
        setAttendance(attendance);
      });
    } else {
        setAttendance(null);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [studentRoute, selectedDate, days]);

  const boardedStudentIds = useMemo(() => attendance?.boarded || [], [attendance]);
  const notBoardingStudentIds = useMemo(() => attendance?.notBoarding || [], [attendance]);
  const disembarkedStudentIds = useMemo(() => attendance?.disembarked || [], [attendance]);
  const completedDestinations = useMemo(() => attendance?.completedDestinations || [], [attendance]);

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

  const toggleNotBoarding = useCallback(async (studentId: string) => {
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
      const attendance = await getAttendance(route.id, selectedDate);
      const currentBoarded = attendance?.boarded || [];
      const currentNotBoarding = attendance?.notBoarding || [];
      
      const isNotBoarding = currentNotBoarding.includes(student.id);

      const newNotBoardingIds = isNotBoarding
        ? currentNotBoarding.filter(id => id !== student.id)
        : [...currentNotBoarding, student.id];

      const newBoardedIds = isNotBoarding 
        ? currentBoarded
        : currentBoarded.filter(id => id !== student.id);

      try {
        await updateAttendance(route.id, selectedDate, { notBoarding: newNotBoardingIds, boarded: newBoardedIds });
        toast({ title: t('success'), description: t('student_page.not_boarding_update_success', { studentName: formatStudentName(student) })});
      } catch (error) {
        console.error("Error updating not-boarding status:", error);
        toast({ title: t('error'), description: t('student_page.not_boarding_update_error', { routeId: route.id }), variant: "destructive"});
      }
    });
  }, [selectedDate, toast, findRoutesForStudent, allStudents, boardedStudentIds, t, viewingDay, viewingRouteType]);

 const handleSeatClick = useCallback((seatNumber: number, studentId: string | null) => {
      if (!studentId || !selectedStudent || studentId !== selectedStudent.id) return;
      
      if (boardedStudentIds.includes(studentId)) {
        toast({ title: t('notice'), description: t('student_page.already_boarded_error'), variant: 'default' });
        return;
      }

      if (notBoardingStudentIds.includes(studentId)) {
          toggleNotBoarding(studentId);
      } else {
          setStudentToConfirm(selectedStudent);
      }
  }, [toggleNotBoarding, selectedStudent, notBoardingStudentIds, boardedStudentIds, toast, t]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
        setSearchResults([]);
        return;
    }
    const lowerQuery = searchQuery.toLowerCase();
    const queryDigits = searchQuery.replace(/\D/g, '');
    
    const results = allStudents.filter(s => {
        const nameMatch = s.name.toLowerCase().includes(lowerQuery);
        const contactMatch = queryDigits && s.contact && s.contact.replace(/\D/g, '').includes(queryDigits);
        return nameMatch || contactMatch;
    });
    setSearchResults(results);
  }, [searchQuery, allStudents]);

  const handleSelectStudentFromSearch = (student: Student) => {
      setSelectedStudent(student);
      setSearchQuery('');
      setSearchResults([]);
  };

  const getRouteTypeLabel = (routeType: RouteType) => {
      if (routeType === 'AfterSchool') {
        return t('route_type.after_school');
      }
      return t(`route_type.${routeType.toLowerCase()}`);
  }
  
  const getDayOfWeekString = (dateString: string) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        const dayIndex = getDay(date);
        if(isSunday(date)) return '';
        return `(${t(`day_short.${days[dayIndex - 1].toLowerCase()}`)})`;
    } catch(e) {
        return '';
    }
  };

  const getStudentDestination = useCallback((student: Student) => {
    if (!viewingDay || !viewingRouteType) return { id: null, name: null };
    
    let destId: string | null = null;
    if (viewingRouteType === 'Morning') destId = student.morningDestinationId;
    else if (viewingRouteType === 'Afternoon') destId = student.afternoonDestinationId;
    else if (viewingRouteType === 'AfterSchool') destId = student.afterSchoolDestinations?.[viewingDay] || null;

    if (!destId) return { id: null, name: null };
    
    const destination = destinations.find(d => d.id === destId);
    return { id: destId, name: destination?.name || null };
  }, [viewingDay, viewingRouteType, destinations]);

  const studentStatus = useMemo(() => {
    if (!selectedStudent || !selectedBus) return null;

    const studentDest = getStudentDestination(selectedStudent);

    if (disembarkedStudentIds.includes(selectedStudent.id)) {
        return { text: t('teacher_page.status_disembarked'), color: 'text-gray-500' };
    }
    if (studentDest.id && completedDestinations.includes(studentDest.id)) {
        return { text: t('student_page.status.destination_complete', { destination: studentDest.name }), color: 'text-blue-500' };
    }
    if (selectedBus.status === 'departed') {
        return { text: t('student_page.status.en_route'), color: 'text-green-600' };
    }
    if (selectedBus.status === 'ready' || !selectedBus.status) {
        return { text: t('student_page.status.ready'), color: 'text-yellow-600' };
    }

    return null;
  }, [selectedStudent, selectedBus, completedDestinations, disembarkedStudentIds, getStudentDestination, t]);
  
  const headerContent = (
    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
        <div className="relative w-full max-w-sm">
            <Label htmlFor="student-search" className="text-xs">{t('student.name')}</Label>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    id="student-search"
                    type="search"
                    placeholder={t('teacher_page.search_student_placeholder')}
                    className="pl-8 w-full"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>
            {searchResults.length > 0 && (
                <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
                    <CardContent className="p-2">
                        {searchResults.map(student => (
                            <div key={student.id} 
                                className="p-2 text-sm hover:bg-accent rounded-md cursor-pointer"
                                onClick={() => handleSelectStudentFromSearch(student)}>
                                {formatStudentName(student)}
                                {student.contact && <p className="text-xs text-muted-foreground">{student.contact}</p>}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
        {selectedStudent && (
            <div className="w-full sm:w-auto">
                <Label htmlFor="not-boarding-date" className="text-xs">{t('student_page.not_boarding_date_label')}</Label>
                 <div className="flex items-center rounded-md border border-input bg-background h-10 px-3">
                    <Input
                        id="not-boarding-date"
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-auto border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <span className="text-sm text-muted-foreground ml-2">{getDayOfWeekString(selectedDate)}</span>
                </div>
            </div>
        )}
    </div>
  );

  return (
    <MainLayout headerContent={headerContent}>
      <div className="w-full max-w-6xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center h-64">
              <p>{t('loading.data')}</p>
          </div>
        ) : (
          <div className="space-y-6">
              <AlertDialog
                  open={!!studentToConfirm}
                  onOpenChange={(open) => !open && setStudentToConfirm(null)}
              >
                  <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>{t('student_page.not_boarding_confirm_title')}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t('student_page.not_boarding_confirm_description', { studentName: studentToConfirm?.name })}
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                          <AlertDialogAction
                              onClick={() => {
                                  if (studentToConfirm) {
                                      toggleNotBoarding(studentToConfirm.id);
                                  }
                                  setStudentToConfirm(null);
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
                  {selectedStudent ? t('student_page.description.student_selected') : t('student_page.description.no_student')}
                  </CardDescription>
              </CardHeader>
              <CardContent>
                  <Alert className="mb-4 min-h-[68px]">
                      {selectedStudent ? (
                      <AlertTitle className="flex items-center gap-4">
                          <span>
                              {t('teacher_page.status')}: {selectedBus?.name || t('unassigned')}
                          </span>
                          {studentStatus && (
                              <span className={cn("font-bold", studentStatus.color)}>{studentStatus.text}</span>
                          )}
                      </AlertTitle>
                      ) : (
                          <AlertTitle>{t('student_page.select_student_prompt')}</AlertTitle>
                      )}
                  </Alert>
                  {selectedStudent && assignedRoutes.length > 0 && (
                      <div className="mb-4">
                          <div className="flex flex-wrap gap-2">
                            {days.map(day => 
                                  routeTypeOrder.map(type => {
                                      const route = assignedRoutes.find(r => r.dayOfWeek === day && r.type === type);
                                      if (!route) return null;
                                      return (
                                          <Button
                                              key={`${day}-${type}`}
                                              variant={viewingDay === day && viewingRouteType === type ? 'default' : 'outline'}
                                              onClick={() => {
                                                  setViewingDay(day);
                                                  setViewingRouteType(type);
                                              }}
                                          >
                                              {t(`day_short.${day.toLowerCase()}`)} {getRouteTypeLabel(type)}
                                          </Button>
                                      );
                                  })
                              )}
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
                          notBoardingStudentIds={notBoardingStudentIds}
                          routeType={viewingRouteType || 'Morning'}
                          dayOfWeek={viewingDay || 'Monday'}
                      />
                  ) : (
                      <div className="min-h-[300px] flex items-center justify-center">
                          <Alert className="max-w-md text-center">
                              <AlertTitle>{selectedStudent ? t('no_route_info') : t('student_page.select_student_prompt')}</AlertTitle>
                              <AlertDescription>
                                  {selectedStudent ? '선택한 날짜에 해당하는 학생의 노선 정보가 없습니다.' : t('student_page.select_student_description')}
                              </AlertDescription>
                          </Alert>
                      </div>
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
      </div>
    </MainLayout>
  );
}
