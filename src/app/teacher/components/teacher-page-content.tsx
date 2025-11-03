

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    getGroupLeaderRecords, saveGroupLeaderRecords,
    updateAttendance,
    updateRouteSeating,
    onAttendanceUpdate,
    getBuses,
    getStudents,
    getRoutes,
    getDestinations,
    getTeachers,
    getLostItems,
    updateBus
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, GroupLeaderRecord, Teacher, LostItem } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, UserX, ArrowLeftRight, Search } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { GroupLeaderManager } from './group-leader-manager';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MainLayout } from '@/components/layout/main-layout';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {format, differenceInDays, getDay} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { LostAndFound } from './lost-and-found';
import { useTranslation } from '@/hooks/use-translation';
import { Label } from '@/components/ui/label';

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

export function TeacherPageContent() {
  const { t } = useTranslation();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
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
      Monday: t('day.monday'),
      Tuesday: t('day.tuesday'),
      Wednesday: t('day.wednesday'),
      Thursday: t('day.thursday'),
      Friday: t('day.friday'),
      Saturday: t('day.saturday'),
  }), [t]);

  useEffect(() => {
    async function fetchData() {
        setLoading(true);
        try {
            let busesData = await getBuses();
            
            // Data migration from 15 to 16
            const busesToUpdate = busesData.filter(b => b.capacity === 15);
            if (busesToUpdate.length > 0) {
                await Promise.all(busesToUpdate.map(bus => 
                    updateBus(bus.id, { capacity: 16, type: '16-seater' })
                ));
                busesData = await getBuses();
            }

            const [studentsData, routesData, destinationsData, teachersData, lostItemsData] = await Promise.all([
                getStudents(),
                getRoutes(),
                getDestinations(),
                getTeachers(),
                getLostItems(),
            ]);

            setBuses(sortBuses(busesData));
            setStudents(studentsData);
            setAllRoutes(routesData);
            setDestinations(destinationsData);
            setTeachers(teachersData);
            setLostItems(lostItemsData);
        } catch (error) {
            console.error("Failed to fetch initial data:", error);
            toast({ title: t('error'), description: t('loading.initial_data_error'), variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }

    fetchData();
  }, [t, toast]);
  

  const formatStudentName = (student: Student) => {
    if (!student) return '';
    const grade = student.grade.toUpperCase();
    const studentClass = student.class;
    return `${grade}${studentClass} ${student.name}`;
  }

  useEffect(() => {
    const dayIndex = getDay(new Date()); // 0:Sun, 1:Mon, ..., 6:Sat
    
    const currentDay = (dayIndex > 0 && dayIndex < 7) ? days[dayIndex - 1] : 'Monday';
    setSelectedDay(currentDay);
    
    if (dayIndex === 6) { // Saturday
        setSelectedRouteType('AfterSchool');
    } else {
        const now = new Date();
        const vietnamHour = (now.getUTCHours() + 7) % 24;
        if (vietnamHour >= 16) {
            setSelectedRouteType('AfterSchool');
        } else if (vietnamHour >= 11) {
            setSelectedRouteType('Afternoon');
        } else {
            setSelectedRouteType('Morning');
        }
    }
  }, [days]);

  
  const currentRoute = useMemo(() => {
    return allRoutes.find(r => 
      r.busId === selectedBusId && 
      r.dayOfWeek === selectedDay && 
      r.type === selectedRouteType
    );
  }, [allRoutes, selectedBusId, selectedDay, selectedRouteType]);

  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);

  useEffect(() => {
    const dateCheckInterval = setInterval(async () => {
        const currentDate = format(new Date(), 'yyyy-MM-dd');
        if (currentDate !== today) {
            setToday(currentDate);
        }
    }, 60000); 

    return () => {
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
            setSelectedStudent({ ...student, isGroupLeader: isNowLeader });
        } else {
            setSelectedStudent(null);
        }
    } else {
        setSelectedStudent(null);
    }
  }, [lastClickedStudentId, students, groupLeaderRecords]);

  useEffect(() => {
    if (selectedStudent) {
        const student = students.find(s => s.id === selectedStudent.id);
        if (student) {
            const isNowLeader = groupLeaderRecords.some(r => r.studentId === student.id && r.endDate === null);
            if (isNowLeader !== selectedStudent.isGroupLeader) {
                setSelectedStudent({ ...student, isGroupLeader: isNowLeader });
            }
        }
    }
}, [groupLeaderRecords, selectedStudent, students]);


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
      
      const getGradePriority = (grade: string) => {
        const upperGrade = grade.toUpperCase();
        if (upperGrade.startsWith('K')) return 1;
        if (upperGrade.startsWith('G')) return 2;
        return 3;
      };

      return Array.from(studentIdsOnRoute)
          .map(id => students.find(s => s.id === id))
          .filter((s): s is Student => !!s)
          .sort((a,b) => {
              const gradePriorityA = getGradePriority(a.grade);
              const gradePriorityB = getGradePriority(b.grade);
              if (gradePriorityA !== gradePriorityB) return gradePriorityA - gradePriorityB;

              const gradeCompare = a.grade.localeCompare(b.grade, undefined, { numeric: true });
              if (gradeCompare !== 0) return gradeCompare;

              const classCompare = a.class.localeCompare(b.class, undefined, { numeric: true });
              if (classCompare !== 0) return classCompare;

              return a.name.localeCompare(b.name, 'ko');
          });
  }, [currentRoute, students]);
  
 const toggleAbsence = useCallback((student: Student) => {
    if (!currentRoute) {
        toast({ title: t("error"), description: t("teacher_page.no_route_info"), variant: 'destructive'});
        return;
    }

    const isAbsent = absentStudentIds.includes(student.id);

    const newAbsentIds = isAbsent
        ? absentStudentIds.filter(id => id !== student.id)
        : [...absentStudentIds, student.id];
    
    const newBoardedIds = boardedStudentIds.filter(id => id !== student.id); // If absent, cannot be boarded

    updateAttendance(currentRoute.id, today, { absent: newAbsentIds, boarded: newBoardedIds })
      .then(() => {
        toast({ title: t("success"), description: `${formatStudentName(student)} ${t('teacher_page.absence_updated')}`});
      })
      .catch((error) => {
        console.error("Error updating absence:", error);
        toast({ title: t("error"), description: t('teacher_page.boarding_error'), variant: "destructive"});
      });
  }, [currentRoute, today, absentStudentIds, boardedStudentIds, toast, t]);

  
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
  
    const handleSeatClick = (seatNumber: number, studentId: string | null) => {
      if (!studentId) {
        setLastClickedStudentId(null);
        setSelectedStudent(null);
        return;
      }
      
      if (!currentRoute) return;
  
      const isBoarded = boardedStudentIds.includes(studentId);
      const newBoardedIds = isBoarded
          ? boardedStudentIds.filter(id => id !== studentId)
          : [...boardedStudentIds, studentId];
      
      const newAbsentIds = absentStudentIds.filter(id => id !== studentId);
  
      updateAttendance(currentRoute.id, today, { boarded: newBoardedIds, absent: newAbsentIds })
          .then(() => {
              setLastClickedStudentId(studentId);
          })
          .catch(() => {
              toast({ title: t("error"), description: t('teacher_page.boarding_error'), variant: "destructive" });
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
            toast({ title: t("cancelled"), description: t('teacher_page.swap_cancelled') });
            return;
        }

        const sourceStudentId = newSeating[sourceSeatIndex].studentId;
        const targetStudentId = newSeating[targetSeatIndex].studentId;
        newSeating[sourceSeatIndex].studentId = targetStudentId;
        newSeating[targetSeatIndex].studentId = sourceStudentId;
        
        try {
           await updateRouteSeating(currentRoute.id, newSeating);
           setAllRoutes(prev => prev.map(r => r.id === currentRoute.id ? {...r, seating: newSeating} : r));
           toast({ title: t("success"), description: t('teacher_page.swap_success') });
        } catch {
             toast({ title: t("error"), description: t('teacher_page.swap_error'), variant: "destructive" });
        } finally {
            setSelectedSeat(null);
        }

    } else {
        setSelectedSeat(clickedSeat);
        toast({ title: t('teacher_page.seat_selected'), description: t('teacher_page.seat_selected_description') });
    }
  };


  const searchResults = useMemo(() => {
    if (!searchQuery) return [];
    const lowerCaseQuery = searchQuery.toLowerCase();
    
    return students
        .filter(s => formatStudentName(s).toLowerCase().includes(lowerCaseQuery))
        .map(student => {
            const studentRoute = allRoutes.find(route => 
                route.seating.some(seat => seat.studentId === student.id)
            );
            const busName = studentRoute ? buses.find(b => b.id === studentRoute.busId)?.name : undefined;

            let destId: string | null = null;
            if (selectedRouteType === 'Morning') destId = student.morningDestinationId;
            else if (selectedRouteType === 'Afternoon') destId = student.afternoonDestinationId;
            else if (selectedRouteType === 'AfterSchool') destId = student.afterSchoolDestinations?.[selectedDay] || null;
            const destinationName = destinations.find(d => d.id === destId)?.name || t('unassigned');

            return {
                ...student,
                busName,
                destinationName
            };
        });
  }, [searchQuery, students, allRoutes, buses, selectedRouteType, selectedDay, destinations, t]);

  const handleSelectStudentFromSearch = useCallback((student: Student) => {
    setLastClickedStudentId(student.id);
    setSearchQuery('');

    const routeForStudent = allRoutes.find(route => 
        route.dayOfWeek === selectedDay &&
        route.type === selectedRouteType &&
        route.seating.some(seat => seat.studentId === student.id)
    );

    if (routeForStudent) {
        setSelectedBusId(routeForStudent.busId);
    } else {
        setSelectedBusId(''); // Unassigned
    }
  }, [allRoutes, selectedDay, selectedRouteType]);


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
    allRoutes.forEach(route => {
        if (route.dayOfWeek === selectedDay && route.type === selectedRouteType && route.stops.length > 0) {
            configuredBusIds.add(route.busId);
        }
    });
    return buses.filter(bus => configuredBusIds.has(bus.id));
  }, [buses, allRoutes, selectedDay, selectedRouteType]);

  useEffect(() => {
      if (selectedBusId && !filteredBuses.some(b => b.id === selectedBusId)) {
          setSelectedBusId(filteredBuses.length > 0 ? filteredBuses[0].id : '');
      } else if (!selectedBusId && filteredBuses.length > 0) {
          setSelectedBusId(filteredBuses[0].id);
      }
  }, [filteredBuses, selectedBusId]);


  const headerContent = (
    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1 min-w-[120px]">
            <Label className="text-xs">{t('bus')}</Label>
            <Select value={selectedBusId} onValueChange={setSelectedBusId} disabled={loading}>
                <SelectTrigger>
                    <SelectValue placeholder={t('teacher_page.select_bus')} />
                </SelectTrigger>
                <SelectContent>
                    {filteredBuses.map((bus) => (
                        <SelectItem key={bus.id} value={bus.id}>
                            {bus.name} ({t(`bus_type.${bus.capacity}`)})
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
        <div className="flex-1 min-w-[120px]">
            <Label className="text-xs">{t('day')}</Label>
            <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)} disabled={loading}>
                <SelectTrigger>
                    <SelectValue placeholder={t('select_day')} />
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
        <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">{t('route')}</Label>
            <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="Morning" disabled={loading}>{t('route_type.morning')}</TabsTrigger>
                    <TabsTrigger value="Afternoon" disabled={loading}>{t('route_type.afternoon')}</TabsTrigger>
                    <TabsTrigger value="AfterSchool" disabled={loading}>{t(`route_type.AfterSchool`)}</TabsTrigger>
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
                placeholder={t('teacher_page.search_student_placeholder')}
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
                                <p className="text-xs text-muted-foreground">
                                    {student.destinationName}
                                    {student.busName && `, ${student.busName}`}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>

        {selectedStudent ? (
            <div>
                <div className="text-center my-4">
                    <h3 className="text-xl font-bold font-headline">{formatStudentName(selectedStudent)}</h3>
                    <p className="text-sm text-muted-foreground">
                        {t('destination')}: {destinations.find(d => {
                            let destId: string | null = null;
                            if (selectedRouteType === 'Morning') destId = selectedStudent.morningDestinationId;
                            else if (selectedRouteType === 'Afternoon') destId = selectedStudent.afternoonDestinationId;
                            else if (selectedRouteType === 'AfterSchool') destId = selectedStudent.afterSchoolDestinations?.[selectedDay] || null;
                            return d.id === destId;
                        })?.name || t('unassigned')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {t('student.contact')}: {selectedStudent.contact || t('no_selection')}
                    </p>
                </div>
                <Separator className="my-4" />
                <div className="space-y-3">
                    <Button
                        variant={absentStudentIds.includes(selectedStudent.id) ? "destructive" : "outline"}
                        className="w-full"
                        onClick={() => toggleAbsence(selectedStudent)}
                    >
                        <UserX className="mr-2" /> {t('teacher_page.mark_absent')}
                    </Button>
                    <Button
                        variant={selectedStudent.isGroupLeader ? "default" : "outline"}
                        className="w-full"
                        onClick={() => toggleGroupLeader(selectedStudent)}
                        disabled={!currentRoute}
                    >
                        <Crown className="mr-2" /> {selectedStudent.isGroupLeader ? t('teacher_page.demote_leader') : t('teacher_page.promote_leader')}
                    </Button>
                    <Button
                        variant="ghost"
                        className="w-full"
                        onClick={() => { setLastClickedStudentId(null); setSelectedStudent(null); }}
                    >
                        {t('close')}
                    </Button>
                </div>
            </div>
        ) : (
            <div className="text-center text-muted-foreground pt-10">
                <p>{t('teacher_page.select_student_prompt')}</p>
            </div>
        )}
    </div>
  );

  if (loading) {
    return (
        <MainLayout headerContent={headerContent}>
            <div className="flex justify-center items-center h-64"><p>{t('loading.data')}</p></div>
        </MainLayout>
    );
  }

  return (
    <MainLayout headerContent={headerContent}>
       <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex flex-col gap-6 lg:w-1/3">
            <div className="lg:order-1">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">{t('teacher_page.boarding_list_title')}</CardTitle>
                    </CardHeader>
                    <CardContent className='max-h-[60vh] overflow-y-auto'>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>{t('student.name')}</TableHead>
                                    <TableHead>{t('teacher_page.status')}</TableHead>
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
                                            <Badge 
                                                variant={boardedStudentIds.includes(student.id) ? 'default' : (absentStudentIds.includes(student.id) ? 'destructive' : 'secondary')}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSeatClick(0, student.id);
                                                }}
                                                className="cursor-pointer"
                                            >
                                                {boardedStudentIds.includes(student.id) ? t('teacher_page.status_boarded') : (absentStudentIds.includes(student.id) ? t('teacher_page.status_absent') : t('teacher_page.status_not_boarded'))}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <div className="lg:order-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="font-headline">{t('teacher_page.student_info_title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {sidePanel}
                    </CardContent>
                </Card>
            </div>
             <div className="lg:order-4">
                <GroupLeaderManager records={groupLeaderRecords.map(r => ({...r, studentId: r.studentId, name: formatStudentName(students.find(s => s.id === r.studentId)!) || r.name, startDate: r.startDate, endDate: r.endDate, days: r.days }))} setRecords={setGroupLeaderRecords} />
            </div>
            <div className="lg:order-3">
                 <Card>
                    <CardHeader>
                        <CardTitle className="font-headline flex items-center">
                            {t('teacher_page.seat_map_title')}
                            {assignedTeachers.length > 0 && (
                                <span className="text-sm font-medium text-muted-foreground ml-2">
                                - {assignedTeachers.map(t => t.name).join(', ')} {t('teacher_page.assigned_teacher_suffix')}
                                </span>
                            )}
                        </CardTitle>
                        <CardDescription className="hidden md:block">{t('teacher_page.seat_map_description')}</CardDescription>
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
                                {filteredBuses.length === 0 && !loading ? t('teacher_page.no_assigned_routes') : t('teacher_page.no_route_info') }
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
        <div className="lg:w-2/3">
           
        </div>
        </div>
      <div className="mt-6">
          <LostAndFound 
              lostItems={lostItems}
              setLostItems={setLostItems}
              buses={buses}
          />
      </div>
    </MainLayout>
  );
}
