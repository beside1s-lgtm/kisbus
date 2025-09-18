
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { getBuses, getStudents, onRoutesUpdate, getDestinations, onAttendanceUpdate } from '@/lib/firebase-data';
import type { Bus, Student, Route, DayOfWeek, RouteType, Destination } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MainLayout } from '@/components/layout/main-layout';
import { Label } from '@/components/ui/label';
import { format, getDay } from 'date-fns';

// This is the client component that will handle state and interactions
function StudentPageContent({
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
  const [loading, setLoading] = useState(true); // Still used for route loading
  const [today, setToday] = useState(format(new Date(), 'yyyy-MM-dd'));

  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayLabels: { [key in DayOfWeek]: string } = {
      Monday: '월요일',
      Tuesday: '화요일',
      Wednesday: '수요일',
      Thursday: '목요일',
      Friday: '금요일',
      Saturday: '토요일',
  }

  const formatStudentName = (student: Student) => {
    if (!student) return '';
    const grade = student.grade.replace(/\D/g, '');
    const studentClass = student.class.replace(/\D/g, '');
    return `${grade}${studentClass} ${student.name}`;
  }

  useEffect(() => {
    // Set selectedDay to today's day of the week
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
    } else if (vietnamHour >= 9) {
        setSelectedRouteType('Afternoon');
    } else {
        setSelectedRouteType('Morning');
    }
    
    // Routes are the main real-time data needed
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
    }
  }, [today, days]);

  const currentRoute = useMemo(() => {
     return routes.find(r => 
        r.busId === selectedBusId && 
        r.dayOfWeek === selectedDay && 
        r.type === selectedRouteType
     );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  // Real-time listener for attendance
  useEffect(() => {
    if (currentRoute) {
      const unsubscribe = onAttendanceUpdate(currentRoute.id, today, (attendance) => {
        setBoardedStudentIds(attendance?.boarded || []);
      });

      // Reset student selection when filters change
      setSelectedStudentId(null);
      
      return () => unsubscribe();
    }
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

  const headerContent = (
    <div className="flex flex-wrap items-end gap-2">
        <div className="w-[140px]">
          <Label className="text-xs">버스</Label>
          <Select value={selectedBusId} onValueChange={setSelectedBusId} disabled={loading}>
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
          <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)} disabled={loading}>
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
          <Select value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} disabled={loading}>
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
        <div className="w-[140px]">
            <Label className="text-xs">학생 이름</Label>
            <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ''} disabled={!currentRoute || loading}>
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
                버스, 요일, 경로를 선택한 후, 명단에서 이름을 선택하여 자녀의 탑승 여부를 확인하세요. 탑승 완료된 좌석은 초록색으로, 학생의 좌석은 파란색 테두리로 표시됩니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {currentRoute && selectedBus ? (
                    <BusSeatMap 
                        bus={selectedBus}
                        seating={currentRoute.seating}
                        students={allStudents}
                        destinations={destinations}
                        draggable={false}
                        highlightedStudentId={selectedStudentId}
                        boardedStudentIds={boardedStudentIds}
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


// This is the Server Component that fetches initial data
export default async function StudentPage() {
    const [buses, students, destinations] = await Promise.all([
        getBuses(),
        getStudents(),
        getDestinations(),
    ]);

    return (
        <StudentPageContent 
            initialBuses={buses}
            initialStudents={students}
            initialDestinations={destinations}
        />
    );
}
