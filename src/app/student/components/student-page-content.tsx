
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getBuses, getStudents, getRoutes, getDestinations, getLostItems, getAttendance, updateAttendance, onAttendanceUpdate } from '@/lib/firebase-data';
import type { Bus, Student, Route, DayOfWeek, RouteType, Destination, LostItem } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MainLayout } from '@/components/layout/main-layout';
import { Label } from '@/components/ui/label';
import { format, getDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LostAndFound } from '@/app/teacher/components/lost-and-found';
import { useTranslation } from '@/hooks/use-translation';

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
  
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [boardedStudentIds, setBoardedStudentIds] = useState<string[]>([]);
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { toast } = useToast();
  const [studentToConfirmAbsence, setStudentToConfirmAbsence] = useState<Student | null>(null);

  const days: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
  const dayLabels: { [key in DayOfWeek]: string } = useMemo(() => ({
    Monday: t('day.monday'),
    Tuesday: t('day.tuesday'),
    Wednesday: t('day.wednesday'),
    Thursday: t('day.thursday'),
    Friday: t('day.friday'),
    Saturday: t('day.saturday'),
  }), [t]);

  useEffect(() => {
    async function fetchData() {
        setLoading(true);
        try {
            const [busesData, studentsData, routesData, destinationsData, lostItemsData] = await Promise.all([
                getBuses(),
                getStudents(),
                getRoutes(),
                getDestinations(),
                getLostItems(),
            ]);

            setBuses(sortBuses(busesData));
            setAllStudents(studentsData);
            setRoutes(routesData);
            setDestinations(destinationsData);
            setLostItems(lostItemsData);
        } catch (error) {
            console.error("Failed to fetch initial data:", error);
            toast({ title: t('error'), description: t('loading.initial_data_error'), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    fetchData();
  }, [t, toast]);


  const formatStudentName = (student: Student | null) => {
    if (!student) return '';
    const grade = student.grade.replace(/\D/g, '');
    const studentClass = student.class.replace(/\D/g, '');
    return `${grade}${studentClass} ${student.name}`;
  }

   useEffect(() => {
    const dayIndex = getDay(new Date());
    if (dayIndex > 0 && dayIndex < 7) {
        setSelectedDay(days[dayIndex - 1]);
    } else {
        setSelectedDay('Monday');
    }
    
    const now = new Date();
    const vietnamHour = (now.getUTCHours() + 7) % 24;
    if (vietnamHour >= 16) {
        setSelectedRouteType('AfterSchool');
    } else if (vietnamHour >= 11) {
        setSelectedRouteType('Afternoon');
    } else {
        setSelectedRouteType('Morning');
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

  const currentRoute = useMemo(() => {
     return routes.find(r => 
        r.busId === selectedBusId && 
        r.dayOfWeek === selectedDay && 
        r.type === selectedRouteType
     );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (currentRoute && today) {
      unsubscribe = onAttendanceUpdate(currentRoute.id, today, (attendance) => {
        setBoardedStudentIds(attendance?.boarded || []);
        setAbsentStudentIds(attendance?.absent || []);
      });

      setSelectedStudentId(null);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentRoute, today]);
  
  const studentsOnCurrentRoute = useMemo(() => {
    if (!currentRoute) return [];
    const studentIdsOnRoute = currentRoute.seating
      .map(seat => seat.studentId)
      .filter((id): id is string => id !== null);

    return allStudents
      .filter(student => studentIdsOnRoute.includes(student.id))
      .sort((a,b) => a.name.localeCompare(b.name, 'ko'));
  }, [currentRoute, allStudents]);

  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
  
  const findRoutesForStudent = useCallback(async (student: Student): Promise<Route[]> => {
    const studentDay = selectedDay;

    let destId: string | null = null;
    if (selectedRouteType === 'Morning') destId = student.morningDestinationId;
    else if (selectedRouteType === 'Afternoon') destId = student.afternoonDestinationId;
    else if (selectedRouteType === 'AfterSchool') destId = student.afterSchoolDestinations?.[studentDay] || null;

    if (!destId) return [];

    // Since we already have all routes, we can filter them on the client
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
      if (!studentId) return;
      const student = allStudents.find(s => s.id === studentId);
      if (!student) return;
      
      if (boardedStudentIds.includes(studentId)) {
        toast({ title: t('notice'), description: t('student_page.already_boarded_error'), variant: 'default' });
        return;
      }

      if (absentStudentIds.includes(studentId)) {
          toggleAbsence(studentId);
      } else {
          setStudentToConfirmAbsence(student);
      }
  }, [toggleAbsence, allStudents, absentStudentIds, boardedStudentIds, toast, t]);

  const filteredBuses = useMemo(() => {
    const configuredBusIds = new Set<string>();
    routes.forEach(route => {
        if (route.dayOfWeek === selectedDay && route.type === selectedRouteType && route.stops.length > 0) {
            configuredBusIds.add(route.busId);
        }
    });
    return buses.filter(bus => configuredBusIds.has(bus.id));
  }, [buses, routes, selectedDay, selectedRouteType]);

  useEffect(() => {
    if (selectedBusId && !filteredBuses.some(b => b.id === selectedBusId)) {
        setSelectedBusId(filteredBuses.length > 0 ? filteredBuses[0].id : '');
    } else if (!selectedBusId && filteredBuses.length > 0) {
        setSelectedBusId(filteredBuses[0].id);
    }
  }, [filteredBuses, selectedBusId]);


  const headerContent = (
    <div className="flex flex-wrap items-end gap-2">
        <div className="w-[140px]">
          <Label className="text-xs">{t('bus')}</Label>
          <Select value={selectedBusId} onValueChange={setSelectedBusId}>
            <SelectTrigger>
              <SelectValue placeholder={t('select_bus')} />
            </SelectTrigger>
            <SelectContent>
              {filteredBuses.map((bus) => (
                <SelectItem key={bus.id} value={bus.id}>
                  {bus.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[140px]">
          <Label className="text-xs">{t('day')}</Label>
          <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
            <SelectTrigger>
              <SelectValue placeholder={t('select_day')} />
            </SelectTrigger>
            <SelectContent>
              {days.map((day) => (
                <SelectItem key={day} value={day}>
                  {dayLabels[day]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[140px]">
          <Label className="text-xs">{t('route')}</Label>
          <Select value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)}>
            <SelectTrigger>
              <SelectValue placeholder={t('select_route')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Morning">{t('route_type.morning')}</SelectItem>
              <SelectItem value="Afternoon">{t('route_type.afternoon')}</SelectItem>
              <SelectItem value="AfterSchool">{t('route_type.after_school')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
            <Label className="text-xs">{t('student.name')}</Label>
            <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ''} disabled={!currentRoute}>
                <SelectTrigger>
                    <SelectValue placeholder={t('select_student')} />
                </SelectTrigger>
                <SelectContent>
                    {studentsOnCurrentRoute.length > 0 ? (
                        studentsOnCurrentRoute.map(s => <SelectItem key={s.id} value={s.id}>{formatStudentName(s)}</SelectItem>)
                    ) : (
                        <SelectItem value="no-student" disabled>{t('no_students')}</SelectItem>
                    )}
                </SelectContent>
            </Select>
        </div>
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
                {t('student_page.description')}
                </CardDescription>
            </CardHeader>
            <CardContent>
                {currentRoute && selectedBus ? (
                    <BusSeatMap 
                        bus={selectedBus}
                        seating={currentRoute.seating}
                        students={allStudents}
                        destinations={destinations}
                        onSeatClick={handleSeatClick}
                        highlightedStudentId={selectedStudentId}
                        boardedStudentIds={boardedStudentIds}
                        absentStudentIds={absentStudentIds}
                        routeType={selectedRouteType}
                        dayOfWeek={selectedDay}
                    />
                ) : (
                    <Alert>
                        <AlertTitle>{t('no_route_info')}</AlertTitle>
                        <AlertDescription>
                            {t('no_route_info_description')}
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
