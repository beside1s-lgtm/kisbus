
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { getBuses, getStudents, getRoutes, getDestinations } from '@/lib/mock-data';
import { Bus, Student, Route, DayOfWeek, RouteType, Destination } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { DashboardShell } from '@/components/bus/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function StudentPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [busesData, studentsData, routesData, destinationsData] = await Promise.all([
        getBuses(),
        getStudents(),
        getRoutes(),
        getDestinations(),
      ]);
      setBuses(busesData);
      setAllStudents(studentsData);
      setRoutes(routesData);
      setDestinations(destinationsData);
      if (busesData.length > 0 && !selectedBusId) {
        setSelectedBusId(busesData[0].id);
      }
    };
    fetchData();
  }, [selectedBusId]);

  // Reset student selection when filters change
  useEffect(() => {
    setSelectedStudentId(null);
  }, [selectedBusId, selectedDay, selectedRouteType]);
  
  const currentRoute = useMemo(() => {
     return routes.find(r => 
        r.busId === selectedBusId && 
        r.dayOfWeek === selectedDay && 
        r.type === selectedRouteType
     );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  const studentsOnCurrentRoute = useMemo(() => {
    if (!currentRoute) return [];
    const studentIdsOnRoute = currentRoute.seating
      .map(seat => seat.studentId)
      .filter((id): id is string => id !== null);

    return allStudents
      .filter(student => studentIdsOnRoute.includes(student.id))
      .sort((a,b) => a.name.localeCompare(b.name));
  }, [currentRoute, allStudents]);

  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);

  const mainContent = (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">내 버스 좌석</CardTitle>
        <CardDescription>
          버스, 요일, 경로를 선택한 후, 명단에서 이름을 선택하여 내 좌석을 확인하세요. 내 좌석은 파란색으로 강조 표시됩니다.
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
            <Select onValueChange={setSelectedStudentId} value={selectedStudentId || ''} disabled={!currentRoute}>
                <SelectTrigger className="w-full">
                    <SelectValue placeholder="학생 이름을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                    {studentsOnCurrentRoute.length > 0 ? (
                        studentsOnCurrentRoute.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.grade})</SelectItem>)
                    ) : (
                        <SelectItem value="no-student" disabled>이 노선에 배정된 학생이 없습니다</SelectItem>
                    )}
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
