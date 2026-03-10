
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { onBusesUpdate, onStudentsUpdate, onRoutesUpdate, onDestinationsUpdate, onLostItemsUpdate, onAttendanceUpdate } from '@/lib/firebase-data';
import type { Bus, Student, Route, DayOfWeek, RouteType, Destination, LostItem, AttendanceRecord } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MainLayout } from '@/components/layout/main-layout';
import { format, getDay, isSunday } from 'date-fns';
import { LostAndFound } from '@/app/teacher/components/lost-and-found';
import { useTranslation } from '@/hooks/use-translation';
import { Search } from 'lucide-react';
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
  const { t } = useTranslation();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
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
  
  const selectedDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);
  
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

  useEffect(() => {
    if (isClient && allStudents.length > 0 && !selectedStudent) {
        const savedStudentId = localStorage.getItem('lastCheckedStudentId');
        if (savedStudentId) {
            const student = allStudents.find(s => s.id === savedStudentId);
            if (student) {
                setSelectedStudent(student);
            }
        }
    }
  }, [isClient, allStudents, selectedStudent]);


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
        let dayOfWeek: DayOfWeek;
        
        if (isSunday(targetDate)) {
             dayOfWeek = 'Monday';
        } else {
            const dayIndex = getDay(targetDate); 
            dayOfWeek = days[dayIndex - 1];
        }

        const routesForDay = studentRoutes
          .filter(r => r.dayOfWeek === dayOfWeek)
          .sort((a,b) => routeTypeOrder.indexOf(a.type) - routeTypeOrder.indexOf(b.type));

        if (routesForDay.length > 0) {
            setViewingDay(dayOfWeek);
            
            const now = new Date();
            const vietnamHour = (now.getUTCHours() + 7) % 24;
            
            let preferredType: RouteType;
            if (vietnamHour >= 9 && vietnamHour < 15) {
                preferredType = 'Afternoon';
            } else if (vietnamHour >= 15 && vietnamHour < 20) {
                preferredType = 'AfterSchool';
            } else {
                preferredType = 'Morning';
            }

            const matchedRoute = routesForDay.find(r => r.type === preferredType);
            if (matchedRoute) {
                setViewingRouteType(matchedRoute.type);
            } else {
                setViewingRouteType(routesForDay[0].type);
            }
        } else if (studentRoutes.length > 0) {
            setViewingDay(studentRoutes[0].dayOfWeek);
            setViewingRouteType(studentRoutes[0].type);
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

    const targetDate = new Date(selectedDate);
    const dayIndex = isSunday(targetDate) ? 1 : getDay(targetDate);
    const targetDayOfWeek = days[dayIndex - 1];

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

  const handleSeatClick = useCallback((seatNumber: number, studentId: string | null) => {
      // Parent interaction disabled as requested.
  }, []);

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
      if (typeof window !== 'undefined') {
          localStorage.setItem('lastCheckedStudentId', student.id);
      }
  };

  const getRouteTypeLabel = (routeType: RouteType) => {
      if (routeType === 'AfterSchool') {
        return t('route_type.after_school');
      }
      return t(`route_type.${routeType.toLowerCase()}`);
  }
  
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

    if (disembarkedStudentIds.includes(selectedStudent.id)) {
        return { text: t('student_page.status.arrived'), color: 'text-gray-500' };
    }
    
    if (notBoardingStudentIds.includes(selectedStudent.id)) {
        return { text: t('teacher_page.status_not_riding_today'), color: 'text-destructive' };
    }

    if (selectedBus.status === 'departed') {
        return { text: t('student_page.status.departed'), color: 'text-blue-600' };
    }

    if (boardedStudentIds.includes(selectedStudent.id)) {
        return { text: t('student_page.status.ready_boarded'), color: 'text-green-600' };
    }

    return { text: t('student_page.status.ready_not_boarded'), color: 'text-yellow-600' };
  }, [selectedStudent, selectedBus, disembarkedStudentIds, notBoardingStudentIds, boardedStudentIds, t]);
  
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
                              {t('teacher_page.status')}: {selectedBus ? `${selectedBus.name} (${getRouteTypeLabel(viewingRouteType!)})` : t('unassigned')}
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
                                  {selectedStudent ? '선택한 조건에 해당하는 자녀의 노선 배정 정보가 없습니다. 관리자에게 문의하거나 신청 내역을 확인해 주세요.' : t('student_page.select_student_description')}
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
