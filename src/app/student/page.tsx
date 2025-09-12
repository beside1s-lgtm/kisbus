'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { getBuses, getStudents, getRoutes } from '@/lib/mock-data';
import { Bus, Student, Route, DayOfWeek, RouteType } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { DashboardShell } from '@/components/bus/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PartyPopper } from 'lucide-react';

// For demo, we'll hardcode the student's ID
const LOGGED_IN_STUDENT_ID = 'student6';

export default function StudentPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');

  const [boardedStudentIds, setBoardedStudentIds] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchData = async () => {
      const [busesData, studentsData, routesData] = await Promise.all([
        getBuses(),
        getStudents(),
        getRoutes(),
      ]);
      setBuses(busesData);
      setStudents(studentsData);
      setRoutes(routesData);
      if (busesData.length > 0) {
        setSelectedBusId(busesData[0].id);
      }
    };
    fetchData();
  }, []);

  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
  
  const currentRoute = useMemo(() => {
    return routes.find(r => 
      r.busId === selectedBusId && 
      r.dayOfWeek === selectedDay && 
      r.type === selectedRouteType
    );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  const handleSeatClick = (seatNumber: number, studentId: string | null) => {
    if (studentId === LOGGED_IN_STUDENT_ID) {
      setBoardedStudentIds(prev =>
        prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
      );
    }
  };
  
  const loggedInStudentOnThisBus = useMemo(() => {
    return currentRoute?.seating.some(s => s.studentId === LOGGED_IN_STUDENT_ID);
  }, [currentRoute]);


  if (!selectedBus || !currentRoute) {
    return <div className="p-4">로딩 중 또는 버스를 선택하세요...</div>;
  }

  const mainContent = (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">내 버스 좌석</CardTitle>
        <CardDescription>내 좌석을 찾아 탭하여 탑승 완료 표시를 하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        {loggedInStudentOnThisBus ? (
             <BusSeatMap 
                bus={selectedBus}
                seating={currentRoute.seating}
                students={students}
                draggable={false}
                onSeatClick={handleSeatClick}
                boardedStudentIds={boardedStudentIds}
             />
        ) : (
            <Alert>
                <AlertTitle>이 버스 노선에 배정되지 않았습니다.</AlertTitle>
                <AlertDescription>일정을 확인하거나 다른 버스/요일을 선택하세요.</AlertDescription>
            </Alert>
        )}
      </CardContent>
    </Card>
  );

  const sidePanel = (
    <div>
        <h3 className="text-lg font-semibold mb-2 font-headline">이용 안내</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>좌석표에서 내 이름을 찾으세요.</li>
            <li>버스에 타면 내 좌석을 탭하세요. 좌석이 녹색으로 바뀝니다.</li>
            <li>버스에서 내릴 때 다시 좌석을 탭하세요.</li>
            <li>본인만 좌석 상태를 변경할 수 있습니다.</li>
        </ul>
        <Alert className="mt-6 bg-accent/50 border-accent">
            <PartyPopper className="h-4 w-4" />
            <AlertTitle className="font-headline">현재 로그인한 학생:</AlertTitle>
            <AlertDescription className="font-semibold text-accent-foreground">
                {students.find(s=>s.id === LOGGED_IN_STUDENT_ID)?.name || '학생'}
            </AlertDescription>
        </Alert>
    </div>
  );

  return (
    <DashboardShell
      buses={buses}
      selectedBusId={selectedBusId}
      setSelectedBusId={setSelectedBusId}
      selectedDay={selectedDay}
      setSelectedDay={setSelectedDay}
      selectedRouteType={selectedRouteType}
      setSelectedRouteType={setSelectedRouteType}
      mainContent={mainContent}
      sidePanel={sidePanel}
      sidePanelTitle="사용 방법"
    />
  );
}
