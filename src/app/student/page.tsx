'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { getBuses, getStudents, getRoutes } from '@/lib/mock-data';
import { Bus, Student, Route, DayOfWeek, RouteType } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { DashboardShell } from '@/components/bus/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function StudentPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  // These states will be derived from the selected student
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');

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
      if (busesData.length > 0 && !selectedBusId) {
        setSelectedBusId(busesData[0].id);
      }
    };
    fetchData();
  }, []);

  const studentRouteInfo = useMemo(() => {
    if (!selectedStudentId) return null;

    // Find the route for the specific day and type
    const routeForStudent = routes.find(route => {
        const isMatch = route.dayOfWeek === selectedDay && route.type === selectedRouteType;
        if (!isMatch) return false;
        return route.seating.some(s => s.studentId === selectedStudentId);
    });

    if (routeForStudent) {
        const seatingInfo = routeForStudent.seating.find(s => s.studentId === selectedStudentId);
        return {
            route: routeForStudent,
            busId: routeForStudent.busId,
            seatNumber: seatingInfo?.seatNumber,
        };
    }
    
    return null;
  }, [routes, selectedStudentId, selectedDay, selectedRouteType]);

  useEffect(() => {
    if (studentRouteInfo) {
      setSelectedBusId(studentRouteInfo.busId);
    }
  }, [studentRouteInfo]);
  
  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);

  const currentRouteForDisplay = useMemo(() => {
     return routes.find(r => 
        r.busId === selectedBusId && 
        r.dayOfWeek === selectedDay && 
        r.type === selectedRouteType
     );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  const mainContent = (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">내 버스 좌석</CardTitle>
        <CardDescription>이름을 선택하여 내 좌석을 확인하세요. 내 좌석은 파란색으로 강조 표시됩니다.</CardDescription>
      </CardHeader>
      <CardContent>
        {selectedStudentId && currentRouteForDisplay && selectedBus ? (
             <BusSeatMap 
                bus={selectedBus}
                seating={currentRouteForDisplay.seating}
                students={students}
                draggable={false}
                highlightedStudentId={selectedStudentId}
             />
        ) : (
            <Alert>
                <AlertTitle>{selectedStudentId ? "배정 정보 없음" : "학생을 선택하세요"}</AlertTitle>
                <AlertDescription>
                    {selectedStudentId 
                        ? "선택하신 날짜와 경로에 배정된 버스 정보가 없습니다. 다른 요일이나 경로를 선택해보세요."
                        : "버스 노선 및 좌석 정보를 보려면 목록에서 이름을 선택하세요."
                    }
                </AlertDescription>
            </Alert>
        )}
      </CardContent>
    </Card>
  );

  const sidePanel = (
    <div>
        <h3 className="text-lg font-semibold mb-2 font-headline">이용 안내</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>상단 필터에서 버스, 요일, 경로를 선택하세요.</li>
            <li>학생 이름 목록에서 내 이름을 찾아 선택하세요.</li>
            <li>배정된 버스와 좌석이 표시됩니다.</li>
            <li>내 좌석은 파란색으로 강조 표시됩니다.</li>
        </ul>
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
      topActions={
        <div className="w-full sm:w-64">
            <Select onValueChange={setSelectedStudentId} value={selectedStudentId || undefined}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="학생 이름을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.grade})</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      }
      mainContent={mainContent}
      sidePanel={sidePanel}
      sidePanelTitle="사용 방법"
    />
  );
}
