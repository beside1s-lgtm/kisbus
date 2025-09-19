
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { onRoutesUpdate, onAttendanceUpdate, getRoutesByStop, getAttendance, updateAttendance } from '@/lib/firebase-data';
import type { Bus, Student, Route, DayOfWeek, RouteType, Destination } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MainLayout } from '@/components/layout/main-layout';
import { Label } from '@/components/ui/label';
import { format, getDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// This is the client component that will handle state and interactions
export function StudentPageContent({
    initialBuses,
    initialStudents,
    initialDestinations,
}: {
    initialBuses: Bus[],
    initialStudents: Student[],
    initialDestinations: Destination[],
}) {
  const [buses, setBuses] = useState<Bus[]>(initialBuses);
  const [allStudents, setAllStudents] = useState<Student[]>(initialStudents);
  const [destinations, setDestinations] = useState<Destination[]>(initialDestinations);
  const [routes, setRoutes] = useState<Route[]>([]);
  
  const [selectedBusId, setSelectedBusId] = useState<string>(initialBuses.length > 0 ? initialBuses[0].id : '');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [boardedStudentIds, setBoardedStudentIds] = useState<string[]>([]);
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true); // Still used for route loading
  const [today, setToday] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { toast } = useToast();

  const days: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
  const dayLabels: { [key in DayOfWeek]: string } = useMemo(() => ({
      Monday: '월요일',
      Tuesday: '화요일',
      Wednesday: '수요일',
      Thursday: '목요일',
      Friday: '금요일',
      Saturday: '토요일',
  }), []);

  const formatStudentName = (student: Student | null) => {
    if (!student) return '';
    const grade = student.grade.replace(/\D/g, '');
    const studentClass = student.class.replace(/\D/g, '');
    return `${grade}${studentClass} ${student.name}`;
  }

   useEffect(() => {
    // Set selectedDay to today's day of the week, and routeType based on time. Runs only once on mount.
    const dayIndex = getDay(new Date()); // 0 (Sun) - 6 (Sat)
    if (dayIndex > 0 && dayIndex < 7) { // Monday(1) to Saturday(6)
        setSelectedDay(days[dayIndex - 1]);
    } else {
        setSelectedDay('Monday');
    }
    
    // Set route type based on Vietnam time
    const now = new Date();
    const vietnamHour = (now.getUTCHours() + 7) % 24;
    if (vietnamHour >= 16) {
        setSelectedRouteType('AfterSchool');
    } else if (vietnamHour >= 12) {
        setSelectedRouteType('Afternoon');
    } else {
        setSelectedRouteType('Morning');
    }
  }, []); // Empty array ensures this runs only once on mount

  useEffect(() => {
    const unsubscribeRoutes = onRoutesUpdate((routesData) => {
      setRoutes(routesData);
      setLoading(false);
    });

    const dateCheckInterval = setInterval(() => {
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      if (currentDate !== today) {
        setToday(currentDate);
      }
    }, 60000); // Check every minute

    return () => {
      unsubscribeRoutes();
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

  // Real-time listener for attendance
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (currentRoute) {
      unsubscribe = onAttendanceUpdate(currentRoute.id, today, (attendance) => {
        setBoardedStudentIds(attendance?.boarded || []);
        setAbsentStudentIds(attendance?.absent || []);
      });

      // Reset student selection when filters change
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
      
      const allRoutesWithStop = await getRoutesByStop(destId);

      return allRoutesWithStop.filter(r => 
        r.dayOfWeek === studentDay &&
        r.type === selectedRouteType
      );
  }, [selectedDay, selectedRouteType]);

  const toggleAbsence = useCallback(async (studentId: string) => {
    const student = allStudents.find(s => s.id === studentId);
    if (!student) return;

    if (boardedStudentIds.includes(studentId)) {
        toast({ title: "알림", description: "이미 탑승 처리된 학생입니다. 변경할 수 없습니다.", variant: 'default' });
        return;
    }
    
    const studentRoutes = await findRoutesForStudent(student);
    if (studentRoutes.length === 0) {
      toast({ title: "알림", description: "해당 학생의 오늘 노선 정보를 찾을 수 없습니다.", variant: 'destructive'});
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
        toast({ title: "성공", description: `${formatStudentName(student)} 학생의 '탑승 안 함' 정보가 업데이트되었습니다.`});
      } catch (error) {
        console.error("Error updating absence:", error);
        toast({ title: "오류", description: `${route.id} 노선 정보 업데이트 실패`, variant: "destructive"});
      }
    });
  }, [today, toast, findRoutesForStudent, allStudents, boardedStudentIds]);

  const handleSeatClick = useCallback((seatNumber: number, studentId: string | null) => {
      if (!studentId) return;
      toggleAbsence(studentId);
  }, [toggleAbsence]);

  const headerContent = (
    <div className="flex flex-wrap items-end gap-2">
        <div className="w-[140px]">
          <Label className="text-xs">버스</Label>
          <Select value={selectedBusId} onValueChange={setSelectedBusId}>
            <SelectTrigger>
              <SelectValue placeholder="버스를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              {buses.map((bus) => (
                <SelectItem key={bus.id} value={bus.id}>
                  {bus.name} ({bus.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-[140px]">
          <Label className="text-xs">요일</Label>
          <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
            <SelectTrigger>
              <SelectValue placeholder="요일을 선택하세요" />
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
          <Label className="text-xs">경로</Label>
          <Select value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)}>
            <SelectTrigger>
              <SelectValue placeholder="경로를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Morning">등교</SelectItem>
              <SelectItem value="Afternoon">하교</SelectItem>
              <SelectItem value="AfterSchool">방과후</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-[200px]">
            <Label className="text-xs">학생 이름</Label>
            <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ''} disabled={!currentRoute}>
                <SelectTrigger>
                    <SelectValue placeholder="학생 이름을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                    {studentsOnCurrentRoute.length > 0 ? (
                        studentsOnCurrentRoute.map(s => <SelectItem key={s.id} value={s.id}>{formatStudentName(s)}</SelectItem>)
                    ) : (
                        <SelectItem value="no-student" disabled>학생 없음</SelectItem>
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
            <p>실시간 노선 정보를 불러오는 중입니다...</p>
        </div>
      ) : (
        <div>
            <Card>
            <CardHeader>
                <CardTitle className="font-headline">학생 탑승 현황</CardTitle>
                <CardDescription>
                자녀의 좌석을 클릭하여 '탑승 안 함'을 표시할 수 있습니다. 탑승 완료된 좌석은 초록색, 탑승 안 함은 파란색, 자녀의 좌석은 테두리로 표시됩니다.
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
                        <AlertTitle>노선 정보 없음</AlertTitle>
                        <AlertDescription>
                            선택하신 조건에 해당하는 버스 노선 정보가 없습니다. 다른 버스나 요일을 선택해보세요.
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
            </Card>
        </div>
      )}
    </MainLayout>
  );
}
