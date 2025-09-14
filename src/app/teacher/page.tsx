'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { getBuses, getStudents, getRoutes, getDestinations } from '@/lib/mock-data';
import { Bus, Student, Route, Destination, DayOfWeek, RouteType } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { DashboardShell } from '@/components/bus/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, UserX, ArrowLeftRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { VolunteerTimeCalculator } from './components/volunteer-time-calculator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function TeacherPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [boardedStudentIds, setBoardedStudentIds] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [busesData, studentsData, routesData, destinationsData] = await Promise.all([
        getBuses(),
        getStudents(),
        getRoutes(),
        getDestinations(),
      ]);
      setBuses(busesData);
      setStudents(studentsData);
      setRoutes(routesData);
      setDestinations(destinationsData);
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

  const studentsOnCurrentRoute = useMemo(() => {
      if (!currentRoute) return [];
      return currentRoute.seating
          .map(s => students.find(student => student.id === s.studentId))
          .filter((s): s is Student => s !== undefined)
          .sort((a,b) => a.name.localeCompare(b.name));
  }, [currentRoute, students]);

  const toggleAbsence = (studentId: string) => {
    setAbsentStudentIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };
  
  const toggleGroupLeader = (studentId: string) => {
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, isGroupLeader: !s.isGroupLeader } : s
    ));
    const student = students.find(s => s.id === studentId);
    if(student){
        setSelectedStudent({...student, isGroupLeader: !student.isGroupLeader});
    }
  };
  
  const handleSeatClick = (seatNumber: number, studentId: string | null) => {
    if (studentId) {
      const student = students.find(s => s.id === studentId);
      setSelectedStudent(student || null);
      
      // Toggle boarding status
      setBoardedStudentIds(prev => 
          prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
      );
    } else {
      setSelectedStudent(null);
    }
  };

  if (!selectedBus || !currentRoute) {
    return (
        <DashboardShell
            buses={buses}
            selectedBusId={selectedBusId}
            setSelectedBusId={setSelectedBusId}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            selectedRouteType={selectedRouteType}
            setSelectedRouteType={setSelectedRouteType}
            mainContent={<div className="p-4 text-center">로딩 중 또는 유효한 노선을 선택하세요...</div>}
        />
    );
  }

  const mainContent = (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline">버스 좌석 및 탑승 현황</CardTitle>
            <CardDescription>학생 좌석을 클릭하여 탑승 여부를 표시하세요. 탑승한 학생은 초록색으로 표시됩니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <BusSeatMap 
              bus={selectedBus}
              seating={currentRoute.seating}
              students={students}
              draggable={false}
              onSeatClick={handleSeatClick}
              absentStudentIds={absentStudentIds}
              boardedStudentIds={boardedStudentIds}
            />
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-1">
        <Card className="sticky top-20">
          <CardHeader>
            <CardTitle className="font-headline">탑승 학생 명단</CardTitle>
          </CardHeader>
          <CardContent className='max-h-[60vh] overflow-y-auto'>
             <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>이름</TableHead>
                        <TableHead>상태</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {studentsOnCurrentRoute.map(student => (
                        <TableRow key={student.id}>
                            <TableCell>{student.name} {student.isGroupLeader && "👑"}</TableCell>
                            <TableCell>
                                <Badge variant={boardedStudentIds.includes(student.id) ? 'default' : 'secondary'}>
                                    {boardedStudentIds.includes(student.id) ? '탑승' : '미탑승'}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
             </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const sidePanel = selectedStudent ? (
    <div>
        <div className="flex flex-col items-center text-center">
            <Avatar className="w-24 h-24 mb-4 border-4 border-primary/50">
                <AvatarFallback className="text-4xl">{selectedStudent.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-bold font-headline">{selectedStudent.name}</h3>
            <p className="text-sm text-muted-foreground">
                목적지: {destinations.find(d => d.id === selectedStudent.destinationId)?.name || '해당 없음'}
            </p>
        </div>
        <Separator className="my-4" />
        <div className="space-y-3">
            <Button
                variant={absentStudentIds.includes(selectedStudent.id) ? "destructive" : "outline"}
                className="w-full"
                onClick={() => toggleAbsence(selectedStudent.id)}
            >
                <UserX className="mr-2" /> 결석 처리
            </Button>
            <Button
                variant={selectedStudent.isGroupLeader ? "default" : "outline"}
                className="w-full"
                onClick={() => toggleGroupLeader(selectedStudent.id)}
            >
                <Crown className="mr-2" /> {selectedStudent.isGroupLeader ? '조장 해제' : '조장 설정'}
            </Button>
             <Button variant="outline" className="w-full">
                <ArrowLeftRight className="mr-2" /> 좌석 교체
            </Button>
        </div>
        {selectedStudent.isGroupLeader && (
            <>
                <Separator className="my-4" />
                <VolunteerTimeCalculator student={selectedStudent} setStudents={setStudents} />
            </>
        )}
    </div>
  ) : (
    <div className="text-center text-muted-foreground py-10">
        <p>학생을 선택하여 더 많은 정보를 확인하세요.</p>
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
      sidePanelTitle="학생 정보"
    />
  );
}
