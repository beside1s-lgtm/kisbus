
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    onRoutesUpdate, 
    getGroupLeaderRecords, saveGroupLeaderRecords,
    getAttendance,
    updateAttendance,
    updateRouteSeating,
    getBuses,
    getStudents,
    getDestinations,
    getTeachers,
    getLostItems
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, GroupLeaderRecord, Teacher, LostItem } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, UserX, ArrowLeftRight, Search } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { GroupLeaderManager } from './group-leader-manager';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MainLayout } from '@/components/layout/main-layout';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {format, differenceInDays, getDay} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { LostAndFound } from './lost-and-found';

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

interface TeacherPageContentProps {
}

export function TeacherPageContent({}: TeacherPageContentProps) {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);
  
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [boardedStudentIds, setBoardedStudentIds] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student & { isGroupLeader?: boolean } | null>(null);
  const [groupLeaderRecords, setGroupLeaderRecords] = useState<GroupLeaderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeat, setSelectedSeat] = useState<{ seatNumber: number; studentId: string | null } | null>(null);
  const [today, setToday] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [lastClickedStudentId, setLastClickedStudentId] = useState<string | null>(null);

  const { toast } = useToast();

  const days: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
  const dayLabels: { [key in DayOfWeek]: string } = useMemo(() =>({
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
    const dayIndex = getDay(new Date()); 
    if (dayIndex > 0 && dayIndex < 7) { 
        setSelectedDay(days[dayIndex - 1]);
    } else {
        setSelectedDay('Monday');
    }
    
    const now = new Date();
    const vietnamHour = (now.getUTCHours() + 7) % 24;
    if (vietnamHour >= 16) {
        setSelectedRouteType('AfterSchool');
    } else if (vietnamHour >= 11) {
        setSelectedRouteType('Afternoon');
    } else {
        setSelectedRouteType('Morning');
    }

    const fetchData = async () => {
        setLoading(true);
        try {
            const [busesData, studentsData, destinationsData, teachersData, lostItemsData] = await Promise.all([
                getBuses(),
                getStudents(),
                getDestinations(),
                getTeachers(),
                getLostItems(),
            ]);
            setBuses(sortBuses(busesData));
            setStudents(studentsData);
            setDestinations(destinationsData);
            setTeachers(teachersData);
            setLostItems(lostItemsData);
        } catch (error) {
            console.error("Failed to fetch initial data:", error);
            toast({ title: "데이터 로딩 오류", description: "초기 데이터를 불러오는 데 실패했습니다.", variant: "destructive" });
        }
    };

    fetchData();

  }, [days]);
  
  const currentRoute = useMemo(() => {
    return routes.find(r => 
      r.busId === selectedBusId && 
      r.dayOfWeek === selectedDay && 
      r.type === selectedRouteType
    );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);

  useEffect(() => {
    const unsubscribeRoutes = onRoutesUpdate((routesData) => {
        setRoutes(routesData);
        setLoading(false);
    });

    const dateCheckInterval = setInterval(async () => {
        const currentDate = format(new Date(), 'yyyy-MM-dd');
        if (currentDate !== today) {
            setToday(currentDate);
        }
    }, 60000); 

    return () => {
        unsubscribeRoutes();
        clearInterval(dateCheckInterval);
    };
  }, [today]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (currentRoute) {
        unsubscribe = onAttendanceUpdate(currentRoute.id, today, (attendance) => {
            setBoardedStudentIds(attendance?.boarded || []);
            setAbsentStudentIds(attendance?.absent || []);
        });
    } else {
        setBoardedStudentIds([]);
        setAbsentStudentIds([]);
    }
     return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentRoute, today]);

  useEffect(() => {
      if (lastClickedStudentId) {
          const student = students.find(s => s.id === lastClickedStudentId);
          if (student) {
              const isNowLeader = groupLeaderRecords.some(r => r.studentId === student.id && r.endDate === null);
              if (selectedStudent?.id === student.id) {
                setSelectedStudent(null);
                setLastClickedStudentId(null);
              } else {
                setSelectedStudent({ ...student, isGroupLeader: isNowLeader });
              }
          } else {
              setSelectedStudent(null);
          }
      } else {
          setSelectedStudent(null);
      }
  }, [lastClickedStudentId, students, groupLeaderRecords]);


    const assignedTeachers = useMemo(() => {
        if (!currentRoute || !currentRoute.teacherIds) return [];
        return currentRoute.teacherIds.map(id => teachers.find(t => t.id === id)).filter(Boolean) as Teacher[];
    }, [currentRoute, teachers]);

  useEffect(() => {
    if (currentRoute) {
      const fetchLeaderRecords = async () => {
          try {
              const records = await getGroupLeaderRecords(currentRoute.id);
              setGroupLeaderRecords(records);
          } catch(e) {
              console.error("Failed to fetch leader records", e);
              setGroupLeaderRecords([]); 
          }
      };
      fetchLeaderRecords();
    } else {
        setGroupLeaderRecords([]);
    }
  }, [currentRoute]);
  
  useEffect(() => {
    if (currentRoute && groupLeaderRecords) {
        const recordsToSave = groupLeaderRecords.map(({name, ...rest}) => rest);
        if (recordsToSave.length > 0) {
            saveGroupLeaderRecords(currentRoute.id, recordsToSave).catch(e => console.error("Failed to save leader records", e));
        }
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
          .sort((a,b) => a.name.localeCompare(b.name, 'ko'));
  }, [currentRoute, students]);
  
 const toggleAbsence = useCallback((student: Student) => {
    if (!currentRoute) {
        toast({ title: "오류", description: "현재 노선 정보를 찾을 수 없습니다.", variant: 'destructive'});
        return;
    }

    const isAbsent = absentStudentIds.includes(student.id);

    const newAbsentIds = isAbsent
        ? absentStudentIds.filter(id => id !== student.id)
        : [...absentStudentIds, student.id];
    
    const newBoardedIds = boardedStudentIds.filter(id => id !== student.id); // If absent, cannot be boarded

    updateAttendance(currentRoute.id, today, { absent: newAbsentIds, boarded: newBoardedIds })
      .then(() => {
        toast({ title: "성공", description: `${formatStudentName(student)} 학생의 결석 정보가 업데이트되었습니다.`});
      })
      .catch((error) => {
        console.error("Error updating absence:", error);
        toast({ title: "오류", description: `결석 처리 실패`, variant: "destructive"});
      });
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
        const currentLeaderIndex = newRecords.findIndex(r => r.endDate === null);
        if (currentLeaderIndex > -1) {
            newRecords[currentLeaderIndex].endDate = dateStr;
            newRecords[currentLeaderIndex].days = differenceInDays(new Date(dateStr), new Date(newRecords[currentLeaderIndex].startDate)) + 1;
        }

        newRecords.push({
            studentId,
            name: student.name,
            startDate: dateStr,
            endDate: null,
            days: 1,
        });
    }
    
    setGroupLeaderRecords(newRecords);
    // Update the selected student's leader status in the side panel if they are currently selected
    if (selectedStudent && selectedStudent.id === student.id) {
        setSelectedStudent(prev => prev ? {...prev, isGroupLeader: !prev.isGroupLeader} : null);
    }
  };
  
    const handleSeatClick = (seatNumber, studentId) => {
    if (!studentId) {
      setLastClickedStudentId(null);
      return;
    }
    
    if (!currentRoute) return;

    setLastClickedStudentId(studentId);

    const isBoarded = boardedStudentIds.includes(studentId);
    const newBoardedIds = isBoarded
        ? boardedStudentIds.filter(id => id !== studentId)
        : [...boardedStudentIds, studentId];
    
    const newAbsentIds = absentStudentIds.filter(id => id !== studentId); // If boarded, cannot be absent

    updateAttendance(currentRoute.id, today, { boarded: newBoardedIds, absent: newAbsentIds })
        .catch(() => {
            toast({ title: "오류", description: "탑승 처리 실패", variant: "destructive" });
        });
  };
    
  const handleSeatContextMenu = async (e: React.MouseEvent, seatNumber: number) => {
    e.preventDefault();
    if (!currentRoute) return;

    const newSeating = [...currentRoute.seating];
    const clickedSeat = newSeating.find(s => s.seatNumber === seatNumber);
    if (!clickedSeat) return;

    if (selectedSeat) {
        const sourceSeatIndex = newSeating.findIndex(s => s.seatNumber === selectedSeat.seatNumber);
        const targetSeatIndex = newSeating.findIndex(s => s.seatNumber === seatNumber);

        if (sourceSeatIndex === -1 || targetSeatIndex === -1 || sourceSeatIndex === targetSeatIndex) {
            setSelectedSeat(null);
            toast({ title: "취소", description: "좌석 교체가 취소되었습니다." });
            return;
        }

        const sourceStudentId = newSeating[sourceSeatIndex].studentId;
        const targetStudentId = newSeating[targetSeatIndex].studentId;
        newSeating[sourceSeatIndex].studentId = targetStudentId;
        newSeating[targetSeatIndex].studentId = sourceStudentId;
        
        try {
           await updateRouteSeating(currentRoute.id, newSeating);
           toast({ title: "성공", description: "학생 좌석이 교체되었습니다." });
        } catch {
             toast({ title: "오류", description: "좌석 교체 실패", variant: "destructive" });
        } finally {
            setSelectedSeat(null);
        }

    } else {
        setSelectedSeat(clickedSeat);
        toast({ title: "좌석 선택됨", description: "교체할 다른 좌석을 우클릭하세요. 취소하려면 아무 좌석이나 좌클릭하세요." });
    }
  };


  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const lowerCaseQuery = searchQuery.toLowerCase();
    return students.filter(s => 
        formatStudentName(s).toLowerCase().includes(lowerCaseQuery)
    );
  }, [searchQuery, students]);

  const handleSelectStudentFromSearch = useCallback((student: Student) => {
    setLastClickedStudentId(student.id);
    setSearchQuery('');
  }, []);


  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        handleSelectStudentFromSearch(searchResults[0]);
      }
    }
  };

  const filteredBuses = useMemo(() => {
    const configuredBusIds = new Set<string>();
    routes.forEach(route => {
        if (route.dayOfWeek === selectedDay && route.type === selectedRouteType && route.stops.length > 0) {
            configuredBusIds.add(route.busId);
        }
    });
    return buses.filter(bus => configuredBusIds.has(bus.id));
  }, [buses, routes, selectedDay, selectedRouteType]);

  useEffect(() => {
      if (selectedBusId && !filteredBuses.some(b => b.id === selectedBusId)) {
          setSelectedBusId(filteredBuses.length > 0 ? filteredBuses[0].id : '');
      } else if (!selectedBusId && filteredBuses.length > 0) {
          setSelectedBusId(filteredBuses[0].id);
      }
  }, [filteredBuses, selectedBusId]);


  const headerContent = (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
        <label className="text-sm font-medium">버스</label>
        <Select value={selectedBusId} onValueChange={setSelectedBusId} disabled={loading}>
            <SelectTrigger>
            <SelectValue placeholder="운행 버스를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
            {filteredBuses.map((bus) => (
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
    <div className="min-h-[300px]">
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
                        disabled={!currentRoute}
                    >
                        <Crown className="mr-2" /> {selectedStudent.isGroupLeader ? '조장 해제' : '조장 임명'}
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => setLastClickedStudentId(null)}
                    >
                        닫기
                    </Button>
                </div>
            </div>
        ) : (
            <div className="text-center text-muted-foreground pt-10">
                <p>학생을 선택하거나 검색하여 정보를 확인하세요.</p>
            </div>
        )}
    </div>
  );

  return (
    <MainLayout headerContent={headerContent}>
      {loading ? (
        <div className="flex justify-center items-center h-64"><p>실시간 노선 정보를 불러오는 중입니다...</p></div>
      ) : (
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
                <CardDescription>좌석을 클릭하면 탑승/미탑승 처리됩니다. 우클릭으로 좌석을 교체할 수 있습니다.</CardDescription>
            </CardHeader>
            <CardContent>
                {selectedBus && currentRoute ? (
                    <BusSeatMap 
                        bus={selectedBus}
                        seating={currentRoute.seating}
                        students={students}
                        destinations={destinations}
                        onSeatClick={handleSeatClick}
                        onSeatContextMenu={handleSeatContextMenu}
                        absentStudentIds={absentStudentIds}
                        boardedStudentIds={boardedStudentIds}
                        highlightedSeatNumber={selectedSeat?.seatNumber}
                        routeType={selectedRouteType}
                        dayOfWeek={selectedDay}
                        groupLeaderRecords={groupLeaderRecords}
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
                                onClick={() => setLastClickedStudentId(student.id)}
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

             <GroupLeaderManager records={groupLeaderRecords.map(r => ({...r, studentId: r.studentId, name: formatStudentName(students.find(s => s.id === r.studentId)!) || r.name, startDate: r.startDate, endDate: r.endDate, days: r.days }))} setRecords={setGroupLeaderRecords} />
        </div>
        </div>
      )}
      {!loading && (
        <div className="mt-6">
            <LostAndFound 
                lostItems={lostItems}
                setLostItems={setLostItems}
                buses={buses}
            />
        </div>
      )}
    </MainLayout>
  );
}
