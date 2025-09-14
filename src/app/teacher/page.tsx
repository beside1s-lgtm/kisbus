
'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { getBuses, getStudents, getRoutes, getDestinations } from '@/lib/mock-data';
import { Bus, Student, Route, Destination, DayOfWeek, RouteType, GroupLeaderRecord } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, UserX, ArrowLeftRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { GroupLeaderManager } from './components/group-leader-manager';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MainLayout } from '@/components/layout/main-layout';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {format, differenceInDays} from 'date-fns';

const getBoardingStorageKey = (routeId: string) => `boarding_status_${routeId}`;
const getLeaderStorageKey = (routeId: string) => `group_leader_records_${routeId}`;

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
  const [groupLeaderRecords, setGroupLeaderRecords] = useState<GroupLeaderRecord[]>([]);

  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayLabels: { [key in DayOfWeek]: string } = {
      Monday: '월요일',
      Tuesday: '화요일',
      Wednesday: '수요일',
      Thursday: '목요일',
      Friday: '금요일',
  }

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

  // Load and save boarding status and leader records from/to sessionStorage
  useEffect(() => {
    if (currentRoute) {
      const boardingKey = getBoardingStorageKey(currentRoute.id);
      const savedBoardingStatus = window.sessionStorage.getItem(boardingKey);
      if (savedBoardingStatus) {
        setBoardedStudentIds(JSON.parse(savedBoardingStatus));
      } else {
        setBoardedStudentIds([]); // Reset for new route
      }
      
      const leaderKey = getLeaderStorageKey(currentRoute.id);
      const savedLeaderRecords = window.sessionStorage.getItem(leaderKey);
      if (savedLeaderRecords) {
        setGroupLeaderRecords(JSON.parse(savedLeaderRecords));
      } else {
        setGroupLeaderRecords([]); // Reset for new route
      }
    }
  }, [currentRoute]);

  useEffect(() => {
    if (currentRoute) {
      const boardingKey = getBoardingStorageKey(currentRoute.id);
      window.sessionStorage.setItem(boardingKey, JSON.stringify(boardedStudentIds));
    }
  }, [boardedStudentIds, currentRoute]);

  useEffect(() => {
    if (currentRoute) {
      const leaderKey = getLeaderStorageKey(currentRoute.id);
      window.sessionStorage.setItem(leaderKey, JSON.stringify(groupLeaderRecords));
    }
  }, [groupLeaderRecords, currentRoute]);

  const studentsOnCurrentRoute = useMemo(() => {
      if (!currentRoute) return [];
      const studentIdsOnRoute = new Set<string>();
      currentRoute.seating.forEach(seat => {
          if(seat.studentId) {
              studentIdsOnRoute.add(seat.studentId);
          }
      });
      
      const uniqueStudentIds = Array.from(studentIdsOnRoute);

      return uniqueStudentIds
          .map(id => students.find(s => s.id === id))
          .filter((s): s is Student => s !== undefined)
          .sort((a,b) => a.name.localeCompare(b.name));
  }, [currentRoute, students]);

  const toggleAbsence = (studentId: string) => {
    setAbsentStudentIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };
  
  const toggleGroupLeader = (student: Student) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const studentId = student.id;

    setGroupLeaderRecords(prevRecords => {
      const newRecords = [...prevRecords];
      const existingRecordIndex = newRecords.findIndex(
        r => r.studentId === studentId && r.endDate === null
      );

      if (existingRecordIndex > -1) { // Demote: Student is an active leader
        const record = newRecords[existingRecordIndex];
        record.endDate = today;
        record.days = differenceInDays(new Date(today), new Date(record.startDate)) + 1;
        
        setStudents(prevStudents => prevStudents.map(s => 
          s.id === studentId ? { ...s, isGroupLeader: false } : s
        ));
        setSelectedStudent(prev => prev && prev.id === studentId ? {...prev, isGroupLeader: false} : prev);

      } else { // Promote: Student is not an active leader
        const newRecord: GroupLeaderRecord = {
          studentId: studentId,
          name: student.name,
          startDate: today,
          endDate: null,
          days: 1,
        };
        newRecords.push(newRecord);
        
        setStudents(prevStudents => prevStudents.map(s => 
          s.id === studentId ? { ...s, isGroupLeader: true } : s
        ));
         setSelectedStudent(prev => prev && prev.id === studentId ? {...prev, isGroupLeader: true} : prev);
      }
      return newRecords;
    });
  };

  
  const handleSeatClick = (seatNumber: number, studentId: string | null) => {
    if (studentId) {
      const student = students.find(s => s.id === studentId);
      const isActiveLeader = groupLeaderRecords.some(r => r.studentId === studentId && r.endDate === null);
      if(student) {
          setSelectedStudent({...student, isGroupLeader: isActiveLeader});
      } else {
          setSelectedStudent(null);
      }
      
      // Toggle boarding status
      setBoardedStudentIds(prev => 
          prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
      );
    } else {
      setSelectedStudent(null);
    }
  };

  const headerContent = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
        <label className="text-sm font-medium">버스</label>
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
        <div>
        <label className="text-sm font-medium">요일</label>
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
        <div>
        <label className="text-sm font-medium">경로</label>
        <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="Morning">등교</TabsTrigger>
            <TabsTrigger value="Afternoon">하교</TabsTrigger>
            </TabsList>
        </Tabs>
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
                onClick={() => toggleGroupLeader(selectedStudent)}
            >
                <Crown className="mr-2" /> {selectedStudent.isGroupLeader ? '조장 해제' : '조장 임명'}
            </Button>
             <Button variant="outline" className="w-full">
                <ArrowLeftRight className="mr-2" /> 좌석 교체
            </Button>
        </div>
    </div>
  ) : (
    <div className="text-center text-muted-foreground py-10">
        <p>학생을 선택하여 더 많은 정보를 확인하세요.</p>
    </div>
  );

  return (
    <MainLayout headerContent={headerContent}>
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <Card>
            <CardHeader>
                <CardTitle className="font-headline">버스 좌석 및 탑승 현황</CardTitle>
                <CardDescription>학생 좌석을 클릭하여 탑승 여부를 표시하세요. 탑승한 학생은 초록색으로 표시됩니다.</CardDescription>
            </CardHeader>
            <CardContent>
                {selectedBus && currentRoute ? (
                    <BusSeatMap 
                        bus={selectedBus}
                        seating={currentRoute.seating}
                        students={students}
                        destinations={destinations}
                        draggable={false}
                        onSeatClick={handleSeatClick}
                        absentStudentIds={absentStudentIds}
                        boardedStudentIds={boardedStudentIds}
                    />
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                        로딩 중이거나 유효한 노선 정보가 없습니다.
                    </div>
                )}
            </CardContent>
            </Card>
        </div>
        <div className="lg:col-span-1 space-y-6">
            <Card>
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
                            <TableRow 
                                key={student.id} 
                                onClick={() => handleSeatClick(0, student.id)}
                                className="cursor-pointer"
                            >
                                <TableCell>{student.name} {groupLeaderRecords.some(r => r.studentId === student.id && r.endDate === null) && "👑"}</TableCell>
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

            <Card>
                <CardHeader>
                    <CardTitle className="font-headline">학생 정보</CardTitle>
                </CardHeader>
                <CardContent className='max-h-[75vh] overflow-y-auto'>
                    {sidePanel}
                </CardContent>
                </Card>
             <GroupLeaderManager records={groupLeaderRecords} setRecords={setGroupLeaderRecords} />
        </div>
        </div>
    </MainLayout>
  );
}
