

'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DragDropContext, OnDragEndResponder } from '@hello-pangea/dnd';
import { 
    getBuses, getStudents, getRoutes, getDestinations, 
    getGroupLeaderRecords, saveGroupLeaderRecords,
    getAttendance, onAttendanceUpdate, getRoutesByStop, getTeachers
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, GroupLeaderRecord, AttendanceRecord, Teacher } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, UserX, ArrowLeftRight, Search } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { GroupLeaderManager } from './components/group-leader-manager';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MainLayout } from '@/components/layout/main-layout';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {format, differenceInDays, getDay} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { updateAttendance } from '@/lib/firebase-data';
import { Input } from '@/components/ui/input';

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

export default function TeacherPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [boardedStudentIds, setBoardedStudentIds] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [groupLeaderRecords, setGroupLeaderRecords] = useState<GroupLeaderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { toast } = useToast();

  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayLabels: { [key in DayOfWeek]: string } = {
      Monday: '월요일',
      Tuesday: '화요일',
      Wednesday: '수요일',
      Thursday: '목요일',
      Friday: '금요일',
      Saturday: '토요일',
  }
  const today = format(new Date(), 'yyyy-MM-dd');

  const formatStudentName = (student: Student | null) => {
    if (!student) return '';
    const grade = student.grade.replace(/\D/g, '');
    const studentClass = student.class.replace(/\D/g, '');
    return `${grade}${studentClass} ${student.name}`;
  }

  useEffect(() => {
    // Set selectedDay to today's day of the week
    const dayIndex = getDay(new Date()); // 0 (Sun) - 6 (Sat)
    // Sunday (0) will default to Monday
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


    const fetchData = async () => {
        setLoading(true);
        try {
            const [busesData, studentsData, routesData, destinationsData, teachersData] = await Promise.all([
                getBuses(),
                getStudents(),
                getRoutes(),
                getDestinations(),
                getTeachers(),
            ]);
            const sortedBuses = sortBuses(busesData);
            setBuses(sortedBuses);
            setStudents(studentsData);
            setRoutes(routesData);
            setDestinations(destinationsData);
            setTeachers(teachersData);
            if (sortedBuses.length > 0 && !selectedBusId) {
                setSelectedBusId(sortedBuses[0].id);
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

    const assignedTeachers = useMemo(() => {
        if (!selectedBus || !selectedBus.teacherIds) return [];
        return selectedBus.teacherIds.map(id => teachers.find(t => t.id === id)).filter(Boolean) as Teacher[];
    }, [selectedBus, teachers]);

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
              const recordsWithName = records.map(r => ({
                  ...r,
                  name: formatStudentName(students.find(s => s.id === r.studentId)!)
              }))
              setGroupLeaderRecords(recordsWithName);
          } catch(e) {
              console.error("Failed to fetch leader records", e);
              setGroupLeaderRecords([]); // Reset on error
          }
      };
      fetchLeaderRecords();
    }
  }, [currentRoute, students]);
  
  // Save GroupLeaderRecords
  useEffect(() => {
    if (currentRoute && groupLeaderRecords.length > 0) {
      const recordsToSave = groupLeaderRecords.map(({name, ...rest}) => rest);
      saveGroupLeaderRecords(currentRoute.id, recordsToSave).catch(e => console.error("Failed to save leader records", e));
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
  
  const findRoutesForStudent = async (student: Student): Promise<Route[]> => {
    let destId: string | null = null;
    if (selectedRouteType === 'Morning') {
        destId = student.morningDestinationId;
    } else if (selectedRouteType === 'Afternoon') {
        destId = student.afternoonDestinationId;
    } else if (selectedRouteType === 'AfterSchool') {
        destId = student.afterSchoolDestinations?.[selectedDay] || null;
    }
      
    if (!destId) return [];
    
    const relevantRoutes = await getRoutesByStop(destId);
    
    const dayIndex = getDay(new Date());
    if (dayIndex === 0) return [];
    const todayDayOfWeek = days[dayIndex - 1];

    return relevantRoutes.filter(r => r.dayOfWeek === todayDayOfWeek);
  }

  const toggleAbsence = useCallback(async (student: Student) => {
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
        toast({ title: "성공", description: `${formatStudentName(student)} 학생의 결석 정보가 업데이트되었습니다.`});
      } catch (error) {
        console.error("Error updating absence:", error);
        toast({ title: "오류", description: `${route.id} 노선 결석 처리 실패`, variant: "destructive"});
      }
    });
  }, [today, toast, days, selectedRouteType, selectedDay]);
  
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
        // End any other active leader's term
        const currentLeaderIndex = newRecords.findIndex(r => r.endDate === null);
        if (currentLeaderIndex > -1) {
            newRecords[currentLeaderIndex].endDate = dateStr;
            newRecords[currentLeaderIndex].days = differenceInDays(new Date(dateStr), new Date(newRecords[currentLeaderIndex].startDate)) + 1;
        }

        newRecords.push({
            studentId,
            name: formatStudentName(student),
            startDate: dateStr,
            endDate: null,
            days: 1,
        });
    }

    setGroupLeaderRecords(newRecords);
    
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

      const newAbsentIds = boardedStudentIds.includes(studentId)
        ? absentStudentIds
        : absentStudentIds.filter(id => id !== studentId);

      if (currentRoute) {
        try {
          await updateAttendance(currentRoute.id, today, { absent: newAbsentIds, boarded: newBoardedIds });
        } catch (error) {
          console.error("Error updating boarding status:", error);
          toast({ title: "오류", description: "탑승 처리 실패", variant: "destructive"});
        }
      }
    } else {
      setSelectedStudent(null);
    }
  }, [students, groupLeaderRecords, boardedStudentIds, currentRoute, today, absentStudentIds, toast]);

  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const lowerCaseQuery = searchQuery.toLowerCase();
    return students.filter(s => 
        s.name.toLowerCase().includes(lowerCaseQuery)
    );
  }, [searchQuery, students]);

  const handleSelectStudentFromSearch = (student: Student) => {
    const isNowLeader = groupLeaderRecords.some(r => r.studentId === student.id && r.endDate === null);
    setSelectedStudent({...student, isGroupLeader: isNowLeader });
    setSearchQuery('');
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        handleSelectStudentFromSearch(searchResults[0]);
      }
    }
  };

  const onDragEnd: OnDragEndResponder = (result) => {
    // This is a placeholder. Teacher page does not implement dnd yet.
  }

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
            <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="Morning" disabled={loading}>등교</TabsTrigger>
            <TabsTrigger value="Afternoon" disabled={loading}>하교</TabsTrigger>
            <TabsTrigger value="AfterSchool" disabled={loading}>방과후</TabsTrigger>
            </TabsList>
        </Tabs>
        </div>
    </div>
  );

  const sidePanel = (
    <div>
        <div className="relative mb-4">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
                type="search"
                placeholder="학생 이름으로 검색..."
                className="pl-8 w-full"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
            />
            {searchResults.length > 0 && (
                <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
                    <CardContent className="p-2">
                        {searchResults.map(student => (
                            <div key={student.id} 
                                 className="p-2 text-sm hover:bg-accent rounded-md cursor-pointer"
                                 onClick={() => handleSelectStudentFromSearch(student)}>
                                {formatStudentName(student)}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>

        {selectedStudent ? (
            <div>
                <div className="flex flex-col items-center text-center">
                    <Avatar className="w-24 h-24 mb-4 border-4 border-primary/50">
                        <AvatarFallback className="text-4xl">{selectedStudent.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <h3 className="text-xl font-bold font-headline">{formatStudentName(selectedStudent)}</h3>
                    <p className="text-sm text-muted-foreground">
                        목적지: {destinations.find(d => {
                            let destId: string | null = null;
                            if (selectedRouteType === 'Morning') destId = selectedStudent.morningDestinationId;
                            else if (selectedRouteType === 'Afternoon') destId = selectedStudent.afternoonDestinationId;
                            else if (selectedRouteType === 'AfterSchool') destId = selectedStudent.afterSchoolDestinations?.[selectedDay] || null;
                            return d.id === destId;
                        })?.name || '해당 없음'}
                    </p>
                </div>
                <Separator className="my-4" />
                <div className="space-y-3">
                    <Button
                        variant={absentStudentIds.includes(selectedStudent.id) ? "destructive" : "outline"}
                        className="w-full"
                        onClick={() => toggleAbsence(selectedStudent)}
                    >
                        <UserX className="mr-2" /> 결석 처리
                    </Button>
                    <Button
                        variant={selectedStudent.isGroupLeader ? "default" : "outline"}
                        className="w-full"
                        onClick={() => toggleGroupLeader(selectedStudent)}
                        disabled={!currentRoute} // Disable if no route context
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
                <p>학생을 선택하거나 검색하여 정보를 확인하세요.</p>
            </div>
        )}
    </div>
  );

  return (
    <MainLayout headerContent={headerContent}>
      {loading ? (
        <div className="flex justify-center items-center h-64"><p>데이터를 불러오는 중입니다...</p></div>
      ) : (
      <DragDropContext onDragEnd={onDragEnd}>
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <Card>
            <CardHeader>
                <CardTitle className="font-headline flex items-center">
                    버스 좌석 및 탑승 현황
                    {assignedTeachers.length > 0 && (
                        <span className="text-sm font-medium text-muted-foreground ml-2">
                           - {assignedTeachers.map(t => t.name).join(', ')} 담당 선생님
                        </span>
                    )}
                </CardTitle>
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
                        routeType={selectedRouteType}
                        dayOfWeek={selectedDay}
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
                    <CardTitle className="font-headline">학생 정보</CardTitle>
                </CardHeader>
                <CardContent>
                    {sidePanel}
                </CardContent>
            </Card>
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
                                <TableCell>{formatStudentName(student)} {groupLeaderRecords.some(r => r.studentId === student.id && r.endDate === null) && "👑"}</TableCell>
                                <TableCell>
                                    <Badge variant={boardedStudentIds.includes(student.id) ? 'default' : (absentStudentIds.includes(student.id) ? 'destructive' : 'secondary')}>
                                        {boardedStudentIds.includes(student.id) ? '탑승' : (absentStudentIds.includes(student.id) ? '결석' : '미탑승')}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            </Card>

             <GroupLeaderManager records={groupLeaderRecords} setRecords={setGroupLeaderRecords} />
        </div>
        </div>
      </DragDropContext>
      )}
    </MainLayout>
  );
}
