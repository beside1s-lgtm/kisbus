
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { getBuses, getStudents, getRoutes, getDestinations, onAttendanceUpdate } from '@/lib/firebase-data';
import type { Bus, Student, Route, DayOfWeek, RouteType, Destination } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MainLayout } from '@/components/layout/main-layout';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

export default function StudentPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [boardedStudentIds, setBoardedStudentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayLabels: { [key in DayOfWeek]: string } = {
      Monday: '월요일',
      Tuesday: '화요일',
      Wednesday: '수요일',
      Thursday: '목요일',
      Friday: '금요일',
  }
  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
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
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
      .sort((a,b) => a.name.localeCompare(b.name));
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
                        studentsOnCurrentRoute.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.grade})</SelectItem>)
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
            <p>데이터를 불러오는 중입니다...</p>
        </div>
      ) : (
        <div>
            <Card>
            <CardHeader>
                <CardTitle className="font-headline">내 버스 좌석 및 탑승 현황</CardTitle>
                <CardDescription>
                버스, 요일, 경로를 선택한 후, 명단에서 이름을 선택하여 내 좌석을 확인하세요. 탑승 완료된 좌석은 초록색으로, 내 좌석은 파란색 테두리로 표시됩니다.
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

    