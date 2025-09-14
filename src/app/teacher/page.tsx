
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    getBuses, getStudents, getRoutes, getDestinations, 
    getGroupLeaderRecords, saveGroupLeaderRecords,
    getAttendance, onAttendanceUpdate 
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, GroupLeaderRecord, AttendanceRecord } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';
import { updateAttendance } from '@/lib/firebase-data';


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
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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
            setStudents(studentsData);
            setRoutes(routesData);
            setDestinations(destinationsData);
            if (busesData.length > 0 && !selectedBusId) {
                setSelectedBusId(busesData[0].id);
            }
        } catch (error) {
            console.error("Failed to fetch data", error);
            toast({ title: "오류", description: "데이터 로딩 실패", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };
    fetchData();
  }, [toast]);

  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
  
  const currentRoute = useMemo(() => {
    return routes.find(r => 
      r.busId === selectedBusId && 
      r.dayOfWeek === selectedDay && 
      r.type === selectedRouteType
    );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  // Firestore real-time listener for attendance
  useEffect(() => {
    if (currentRoute) {
      const unsubscribe = onAttendanceUpdate(currentRoute.id, today, (attendance) => {
        setBoardedStudentIds(attendance?.boarded || []);
        setAbsentStudentIds(attendance?.absent || []);
      });
      return () => unsubscribe();
    }
  }, [currentRoute, today]);

  // Load GroupLeaderRecords
  useEffect(() => {
    if (currentRoute) {
      const fetchLeaderRecords = async () => {
          try {
              const records = await getGroupLeaderRecords(currentRoute.id);
              setGroupLeaderRecords(records);
          } catch(e) {
              console.error("Failed to fetch leader records", e);
              setGroupLeaderRecords([]); // Reset on error
          }
      };
      fetchLeaderRecords();
    }
  }, [currentRoute]);
  
  // Save GroupLeaderRecords
  useEffect(() => {
    if (currentRoute && groupLeaderRecords.length) {
      saveGroupLeaderRecords(currentRoute.id, groupLeaderRecords).catch(e => console.error("Failed to save leader records", e));
    }
  }, [groupLeaderRecords, currentRoute]);

  const studentsOnCurrentRoute = useMemo(() => {
      if (!currentRoute) return [];
      const studentIdsOnRoute = new Set<string>();
      currentRoute.seating.forEach(seat => {
          if(seat.studentId) studentIdsOnRoute.add(seat.studentId);
      });
      
      return Array.from(studentIdsOnRoute)
          .map(id => students.find(s => s.id === id))
          .filter((s): s is Student => !!s)
          .sort((a,b) => a.name.localeCompare(b.name));
  }, [currentRoute, students]);

  const toggleAbsence = useCallback(async (studentId: string) => {
    if (!currentRoute) return;
    const newAbsentIds = absentStudentIds.includes(studentId)
      ? absentStudentIds.filter(id => id !== studentId)
      : [...absentStudentIds, studentId];
    
    setAbsentStudentIds(newAbsentIds); // Optimistic update
    try {
      await updateAttendance(currentRoute.id, today, { absent: newAbsentIds, boarded: boardedStudentIds });
    } catch (error) {
      console.error("Error updating absence:", error);
      setAbsentStudentIds(absentStudentIds); // Revert on error
      toast({ title: "오류", description: "결석 처리 실패", variant: "destructive"});
    }
  }, [currentRoute, today, absentStudentIds, boardedStudentIds, toast]);
  
  const toggleGroupLeader = (student: Student) => {
    if(!currentRoute) return;
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const studentId = student.id;

    const newRecords = [...groupLeaderRecords];
    const existingRecordIndex = newRecords.findIndex(r => r.studentId === studentId && r.endDate === null);

    if (existingRecordIndex > -1) { // Demote
        const record = newRecords[existingRecordIndex];
        record.endDate = dateStr;
        record.days = differenceInDays(new Date(dateStr), new Date(record.startDate)) + 1;
    } else { // Promote
        newRecords.push({
            studentId,
            name: student.name,
            startDate: dateStr,
            endDate: null,
            days: 1,
        });
    }

    setGroupLeaderRecords(newRecords); // This will trigger the save effect
    
    // Update local student state for immediate UI feedback
    const isNowLeader = newRecords.some(r => r.studentId === studentId && r.endDate === null);
    setStudents(prevStudents => prevStudents.map(s => 
      s.id === studentId ? { ...s, isGroupLeader: isNowLeader } : s
    ));
    setSelectedStudent(prev => prev && prev.id === studentId ? {...prev, isGroupLeader: isNowLeader} : prev);
  };

  
  const handleSeatClick = useCallback(async (seatNumber: number, studentId: string | null) => {
    if (studentId) {
      const student = students.find(s => s.id === studentId);
      if(student) {
        const isActiveLeader = groupLeaderRecords.some(r => r.studentId === studentId && r.endDate === null);
        setSelectedStudent({...student, isGroupLeader: isActiveLeader});
      } else {
        setSelectedStudent(null);
      }
      
      const newBoardedIds = boardedStudentIds.includes(studentId)
        ? boardedStudentIds.filter(id => id !== studentId)
        : [...boardedStudentIds, studentId];

      setBoardedStudentIds(newBoardedIds); // Optimistic update

      if (currentRoute) {
        try {
          await updateAttendance(currentRoute.id, today, { absent: absentStudentIds, boarded: newBoardedIds });
        } catch (error) {
          console.error("Error updating boarding status:", error);
          setBoardedStudentIds(boardedStudentIds); // Revert on error
          toast({ title: "오류", description: "탑승 처리 실패", variant: "destructive"});
        }
      }
    } else {
      setSelectedStudent(null);
    }
  }, [students, groupLeaderRecords, boardedStudentIds, currentRoute, today, absentStudentIds, toast]);

  const headerContent = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
        <label className="text-sm font-medium">버스</label>
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
        <div>
        <label className="text-sm font-medium">요일</label>
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
        <div>
        <label className="text-sm font-medium">경로</label>
        <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="Morning" disabled={loading}>등교</TabsTrigger>
            <TabsTrigger value="Afternoon" disabled={loading}>하교</TabsTrigger>
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
      {loading ? (
        <div className="flex justify-center items-center h-64"><p>데이터를 불러오는 중입니다...</p></div>
      ) : (
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
      )}
    </MainLayout>
  );
}

    