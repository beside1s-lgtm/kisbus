

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    onBusesUpdate,
    onStudentsUpdate,
    onRoutesUpdate,
    onDestinationsUpdate,
    onTeachersUpdate,
    onLostItemsUpdate,
    getGroupLeaderRecords, 
    saveGroupLeaderRecords,
    updateAttendance,
    updateRouteSeating,
    onAttendanceUpdate,
    updateBus
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, GroupLeaderRecord, Teacher, LostItem, AttendanceRecord } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, UserX, ArrowLeftRight, Search, CheckCircle, Rocket, Undo2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { GroupLeaderManager } from './components/group-leader-manager';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MainLayout } from '@/components/layout/main-layout';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {format, differenceInDays, getDay, isSunday} from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { LostAndFound } from './components/lost-and-found';
import { useTranslation } from '@/hooks/use-translation';
import { Label } from '@/components/ui/label';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const getGradeValue = (grade: string): number => {
  const upperGrade = grade.toUpperCase();
  if (upperGrade.startsWith('K')) {
      const num = parseInt(upperGrade.replace('K', ''));
      return isNaN(num) ? 0 : -100 + num;
  }
  const num = parseInt(upperGrade.replace(/\D/g, ''));
  return isNaN(num) ? 999 : num;
};

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

const AllStudentsBoardingStatus = ({
    relevantRoutes,
    students,
    buses,
    allAttendance,
    formatStudentName,
    t
}: {
    relevantRoutes: Route[];
    students: Student[];
    buses: Bus[];
    allAttendance: Record<string, AttendanceRecord | null>;
    formatStudentName: (student: Student) => string;
    t: (key: string) => string;
}) => {
    const allStudentsOnDay = useMemo(() => {
        const studentsList: (Student & { busName: string; status: 'boarded' | 'notRiding' | 'disembarked' | 'not_boarded' })[] = [];
        
        relevantRoutes.forEach(route => {
            const bus = buses.find(b => b.id === route.busId);
            if (!bus) return;

            const seatingStudents = route.seating.map(seat => {
                if (!seat.studentId) return null;
                return students.find(s => s.id === seat.studentId);
            }).filter((s): s is Student => !!s);

            seatingStudents.forEach(student => {
                const attendanceRecord = allAttendance[route.id];
                const boarded = attendanceRecord?.boarded || [];
                const notBoarding = attendanceRecord?.notBoarding || [];
                const disembarked = attendanceRecord?.disembarked || [];
                
                let status: 'boarded' | 'notRiding' | 'disembarked' | 'not_boarded' = 'not_boarded';
                if (boarded.includes(student.id)) status = 'boarded';
                else if (notBoarding.includes(student.id)) status = 'notRiding';
                else if (disembarked.includes(student.id)) status = 'disembarked';
                
                if (!studentsList.some(s => s.id === student.id)) {
                    studentsList.push({ ...student, busName: bus.name, status });
                }
            });
        });

        studentsList.sort((a,b) => {
              const getStatusPriority = (status: string) => {
                if (status === 'not_boarded') return 1;
                return 2;
              };
              const statusPriorityA = getStatusPriority(a.status);
              const statusPriorityB = getStatusPriority(b.status);
              if (statusPriorityA !== statusPriorityB) return statusPriorityA - statusPriorityB;
              
              const gradeA = getGradeValue(a.grade);
              const gradeB = getGradeValue(b.grade);
              if (gradeA !== gradeB) return gradeA - gradeB;

              const classCompare = a.class.localeCompare(b.class, undefined, { numeric: true });
              if (classCompare !== 0) return classCompare;

              return a.name.localeCompare(b.name, 'ko');
        });
        
        return studentsList;
    }, [relevantRoutes, students, buses, allAttendance]);

    const getStatusBadge = (status: 'boarded' | 'notRiding' | 'disembarked' | 'not_boarded') => {
        switch(status) {
            case 'boarded':
                return <Badge variant="default">{t('teacher_page.status_boarded')}</Badge>;
            case 'notRiding':
                return <Badge variant="destructive">{t('teacher_page.status_not_riding_today')}</Badge>;
            case 'disembarked':
                 return <Badge variant="outline">{t('teacher_page.status_disembarked')}</Badge>;
            case 'not_boarded':
                 return <Badge variant="secondary">{t('teacher_page.status_not_boarded')}</Badge>;
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('teacher_page.all_buses_view.title')}</CardTitle>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('student.name')}</TableHead>
                            <TableHead>{t('bus')}</TableHead>
                            <TableHead>{t('teacher_page.status')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allStudentsOnDay.map(student => (
                            <TableRow key={student.id}>
                                <TableCell>{formatStudentName(student)}</TableCell>
                                <TableCell>{student.busName}</TableCell>
                                <TableCell>
                                    {getStatusBadge(student.status)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 {allStudentsOnDay.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                       {t('no_students')}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


export default function TeacherPage() {
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
  
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [allAttendance, setAllAttendance] = useState<Record<string, AttendanceRecord | null>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student & { isGroupLeader?: boolean } | null>(null);
  const [groupLeaderRecords, setGroupLeaderRecords] = useState<GroupLeaderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSeat, setSelectedSeat] = useState<{ seatNumber: number; studentId: string | null } | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [lastClickedStudentId, setLastClickedStudentId] = useState<string | null>(null);
  const [studentToConfirm, setStudentToConfirm] = useState<Student | null>(null);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);


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
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !selectedDate) {
        setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [isClient, selectedDate]);


  useEffect(() => {
    const unsubscribers = [
      onBusesUpdate((data) => setBuses(sortBuses(data))),
      onStudentsUpdate(setStudents),
      onRoutesUpdate(setAllRoutes),
      onDestinationsUpdate(setDestinations),
      onTeachersUpdate(setTeachers),
      onLostItemsUpdate(setLostItems),
    ];

    setLoading(false);

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, []);
  

  const formatStudentName = (student: Student) => {
    if (!student) return '';
    const grade = student.grade.toUpperCase();
    const studentClass = student.class;
    return `${grade}${studentClass} ${student.name}`;
  }

  useEffect(() => {
    if (selectedDate) {
        const targetDate = new Date(selectedDate);
        if (isSunday(targetDate)) {
            setSelectedDay('Monday');
            return;
        }

        const dayIndex = getDay(targetDate);
        const currentDay = days[dayIndex - 1];
        setSelectedDay(currentDay);

        if (format(targetDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')) {
            const now = new Date();
            const vietnamHour = (now.getUTCHours() + 7) % 24;

            if (vietnamHour >= 9 && vietnamHour < 15) {
                setSelectedRouteType('Afternoon');
            } else if (vietnamHour >= 15 && vietnamHour < 20) {
                setSelectedRouteType('AfterSchool');
            } else {
                setSelectedRouteType('Morning');
            }
        } else {
            // For past or future dates, default to Morning
            setSelectedRouteType('Morning');
        }
    }
  }, [selectedDate, days]);

  
  const currentRoute = useMemo(() => {
    if (selectedBusId === 'all') return null;
    return allRoutes.find(r => 
      r.busId === selectedBusId && 
      r.dayOfWeek === selectedDay && 
      r.type === selectedRouteType
    );
  }, [allRoutes, selectedBusId, selectedDay, selectedRouteType]);

  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);

  const relevantRoutesForDay = useMemo(() => {
    return allRoutes.filter(r => 
        r.dayOfWeek === selectedDay && r.type === selectedRouteType
    );
  }, [allRoutes, selectedDay, selectedRouteType]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (currentRoute) {
        unsubscribe = onAttendanceUpdate(currentRoute.id, selectedDate, (att) => {
            setAttendance(att);
        });
        setSelectedDestinationId(null);
    } else {
        setAttendance(null);
    }
     return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [currentRoute, selectedDate]);
  
  useEffect(() => {
    if (selectedBusId !== 'all') {
        setAllAttendance({});
        return;
    }

    const unsubscribers: (() => void)[] = [];
    
    relevantRoutesForDay.forEach(route => {
        const unsub = onAttendanceUpdate(route.id, selectedDate, (record) => {
            setAllAttendance(prev => ({
                ...prev,
                [route.id]: record
            }));
        });
        unsubscribers.push(unsub);
    });

    return () => {
        unsubscribers.forEach(unsub => unsub());
    }
  }, [selectedBusId, relevantRoutesForDay, selectedDate]);

  const boardedStudentIds = useMemo(() => attendance?.boarded || [], [attendance]);
  const notBoardingStudentIds = useMemo(() => attendance?.notBoarding || [], [attendance]);
  const disembarkedStudentIds = useMemo(() => attendance?.disembarked || [], [attendance]);
  const completedDestinations = useMemo(() => attendance?.completedDestinations || [], [attendance]);

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
    if (currentRoute) {
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
      
      const getStatusPriority = (studentId: string) => {
        if (boardedStudentIds.includes(studentId) || notBoardingStudentIds.includes(studentId)) {
            return 2; // Processed
        }
        return 1; // Unprocessed
      };

      return Array.from(studentIdsOnRoute)
          .map(id => students.find(s => s.id === id))
          .filter((s): s is Student => !!s)
          .sort((a,b) => {
              const statusPriorityA = getStatusPriority(a.id);
              const statusPriorityB = getStatusPriority(b.id);
              if (statusPriorityA !== statusPriorityB) return statusPriorityA - statusPriorityB;

              const gradeA = getGradeValue(a.grade);
              const gradeB = getGradeValue(b.grade);
              if (gradeA !== gradeB) return gradeA - gradeB;
              
              const classCompare = a.class.localeCompare(b.class, undefined, { numeric: true });
              if (classCompare !== 0) return classCompare;

              return a.name.localeCompare(b.name, 'ko');
          });
  }, [currentRoute, students, boardedStudentIds, notBoardingStudentIds]);
  
 const toggleNotBoarding = useCallback((student: Student) => {
    if (!currentRoute) {
        toast({ title: t("error"), description: t("teacher_page.no_route_info"), variant: 'destructive'});
        return;
    }

    const isNotBoarding = notBoardingStudentIds.includes(student.id);

    const newNotBoardingIds = isNotBoarding
        ? notBoardingStudentIds.filter(id => id !== student.id)
        : [...notBoardingStudentIds, student.id];
    
    const newBoardedIds = boardedStudentIds.filter(id => id !== student.id);

    updateAttendance(currentRoute.id, selectedDate, { notBoarding: newNotBoardingIds, boarded: newBoardedIds, disembarked: disembarkedStudentIds, completedDestinations })
      .then(() => {
        toast({ title: t("success"), description: `${formatStudentName(student)} ${t('teacher_page.not_boarding_updated')}`});
      })
      .catch((error) => {
        console.error("Error updating not-boarding status:", error);
        toast({ title: t("error"), description: t('teacher_page.boarding_error'), variant: "destructive"});
      });
  }, [currentRoute, selectedDate, notBoardingStudentIds, boardedStudentIds, disembarkedStudentIds, completedDestinations, toast, t]);

  const toggleDisembark = useCallback(async (studentId: string, destinationId: string) => {
    if (!currentRoute) return;

    const isDisembarked = disembarkedStudentIds.includes(studentId);
    
    const newDisembarkedIds = isDisembarked
        ? disembarkedStudentIds.filter(id => id !== studentId)
        : [...disembarkedStudentIds, studentId];
      
    const newBoardedIds = isDisembarked
        ? [...boardedStudentIds, studentId] // Re-boarding
        : boardedStudentIds.filter(id => id !== studentId); // Disembarking

    let newCompletedDestinations = [...completedDestinations];
    
    // Check if this destination is now complete
    const studentsForDestination = studentsOnCurrentRoute.filter(s => {
        let destId: string | null = null;
        if (selectedRouteType === 'Morning') destId = s.morningDestinationId;
        else if (selectedRouteType === 'Afternoon') destId = s.afternoonDestinationId;
        else if (selectedRouteType === 'AfterSchool') destId = s.afterSchoolDestinations?.[selectedDay] || null;
        return destId === destinationId;
    });

    const disembarkedForDestination = studentsForDestination.filter(s => newDisembarkedIds.includes(s.id));

    if (disembarkedForDestination.length === studentsForDestination.length) {
        if (!newCompletedDestinations.includes(destinationId)) {
            newCompletedDestinations.push(destinationId);
        }
    } else {
        newCompletedDestinations = newCompletedDestinations.filter(id => id !== destinationId);
    }
      
    try {
        await updateAttendance(currentRoute.id, selectedDate, { 
            boarded: newBoardedIds, 
            disembarked: newDisembarkedIds,
            completedDestinations: newCompletedDestinations
        });
    } catch (error) {
        console.error("Error updating disembark status", error);
        toast({ title: "Error", description: "Failed to update disembark status.", variant: "destructive" });
    }
  }, [currentRoute, selectedDate, studentsOnCurrentRoute, selectedRouteType, selectedDay, boardedStudentIds, disembarkedStudentIds, completedDestinations, toast]);

  
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
      
      const newNotBoardingIds = notBoardingStudentIds.filter(id => id !== studentId);
  
      updateAttendance(currentRoute.id, selectedDate, { boarded: newBoardedIds, notBoarding: newNotBoardingIds, disembarked: disembarkedStudentIds, completedDestinations })
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
    const operationalBusIds = new Set<string>();
    allRoutes.forEach(route => {
        if (route.dayOfWeek === selectedDay && route.type === selectedRouteType) {
            // A bus is considered operational if it has stops configured OR if it has students assigned.
            if (route.stops.length > 0 || route.seating.some(s => s.studentId !== null)) {
                operationalBusIds.add(route.busId);
            }
        }
    });
    return buses.filter(bus => operationalBusIds.has(bus.id));
}, [buses, allRoutes, selectedDay, selectedRouteType]);


  useEffect(() => {
      if (selectedBusId && selectedBusId !== 'all' && !filteredBuses.some(b => b.id === selectedBusId)) {
          setSelectedBusId(filteredBuses.length > 0 ? filteredBuses[0].id : '');
      } else if (!selectedBusId && filteredBuses.length > 0) {
          setSelectedBusId(filteredBuses[0].id);
      }
  }, [filteredBuses, selectedBusId]);

  const studentsToDisembark = useMemo(() => {
    if (!selectedDestinationId) return [];
    
    const getStudentDestinationId = (student: Student) => {
        if (selectedRouteType === 'Morning') return student.morningDestinationId;
        if (selectedRouteType === 'Afternoon') return student.afternoonDestinationId;
        if (selectedRouteType === 'AfterSchool') return student.afterSchoolDestinations?.[selectedDay] || null;
        return null;
    }

    return studentsOnCurrentRoute.filter(student => 
        getStudentDestinationId(student) === selectedDestinationId &&
        boardedStudentIds.includes(student.id) &&
        !disembarkedStudentIds.includes(student.id)
    );
  }, [selectedDestinationId, studentsOnCurrentRoute, boardedStudentIds, disembarkedStudentIds, selectedRouteType, selectedDay]);

  const getDayOfWeekString = (dateString: string) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        // Check if date is valid
        if (isNaN(date.getTime())) return '';
        const dayIndex = getDay(date);
        if(isSunday(date)) return '';
        return `(${t(`day_short.${days[dayIndex - 1].toLowerCase()}`)})`;
    } catch(e) {
        return '';
    }
  };
  
  const handleToggleDeparture = async () => {
    if (!selectedBus) return;
    if (selectedBus.status === 'departed') {
        await updateBus(selectedBus.id, { status: 'ready', departureTime: null });
    } else {
        await updateBus(selectedBus.id, { status: 'departed', departureTime: new Date().toISOString() });
    }
  }

  const headerContent = (
    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1 min-w-[120px]">
            <Label className="text-xs">{t('bus')}</Label>
            <Select value={selectedBusId} onValueChange={setSelectedBusId} disabled={loading}>
                <SelectTrigger>
                    <SelectValue placeholder={t('teacher_page.select_bus')} />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('teacher_page.all_buses')}</SelectItem>
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
            <div className="flex items-center rounded-md border border-input bg-background h-10 px-3">
                <Input 
                    type="date" 
                    value={selectedDate} 
                    onChange={e => setSelectedDate(e.target.value)}
                    className="w-auto border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                <span className="text-sm text-muted-foreground ml-2">{getDayOfWeekString(selectedDate)}</span>
            </div>
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
                        variant={notBoardingStudentIds.includes(selectedStudent.id) ? "destructive" : "outline"}
                        className="w-full"
                        onClick={() => setStudentToConfirm(selectedStudent)}
                    >
                        <UserX className="mr-2" /> {t('teacher_page.status_not_riding_today')}
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
        <AlertDialog
            open={!!studentToConfirm}
            onOpenChange={(open) => !open && setStudentToConfirm(null)}
        >
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{t('teacher_page.not_boarding_confirm.title')}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {studentToConfirm ? t('teacher_page.not_boarding_confirm.description', {studentName: formatStudentName(studentToConfirm)}) : ''}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            if (studentToConfirm) {
                                toggleNotBoarding(studentToConfirm);
                            }
                            setStudentToConfirm(null);
                        }}
                    >
                        {t('confirm')}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        {selectedBusId === 'all' ? (
            <AllStudentsBoardingStatus
                relevantRoutes={relevantRoutesForDay}
                students={students}
                buses={buses}
                allAttendance={allAttendance}
                formatStudentName={formatStudentName}
                t={t}
            />
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6 order-last lg:order-first">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                                <div>
                                    <CardTitle className="font-headline flex items-center">
                                        {t('teacher_page.seat_map_title')}
                                        {assignedTeachers.length > 0 && (
                                            <span className="text-sm font-medium text-muted-foreground ml-2">
                                            - {assignedTeachers.map(t => t.name).join(', ')} {t('teacher_page.assigned_teacher_suffix')}
                                            </span>
                                        )}
                                    </CardTitle>
                                    <CardDescription className="hidden md:block">{t('teacher_page.seat_map_description')}</CardDescription>
                                </div>
                            </div>
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
                                    notBoardingStudentIds={notBoardingStudentIds}
                                    boardedStudentIds={boardedStudentIds}
                                    highlightedStudentId={selectedStudent?.id}
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
                    <div className="lg:hidden">
                        <GroupLeaderManager records={groupLeaderRecords.map(r => ({...r, studentId: r.studentId, name: formatStudentName(students.find(s => s.id === r.studentId)!) || r.name, startDate: r.startDate, endDate: r.endDate, days: r.days }))} setRecords={setGroupLeaderRecords} />
                    </div>
                    <div className="lg:hidden">
                        <LostAndFound 
                        lostItems={lostItems}
                        setLostItems={setLostItems}
                        buses={buses}
                        />
                    </div>
                </div>
                <div className="hidden lg:flex lg:flex-col lg:gap-6">
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
                                                    variant={disembarkedStudentIds.includes(student.id) ? 'outline' : boardedStudentIds.includes(student.id) ? 'default' : (notBoardingStudentIds.includes(student.id) ? 'destructive' : 'secondary')}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!disembarkedStudentIds.includes(student.id)) {
                                                            handleSeatClick(0, student.id);
                                                        }
                                                    }}
                                                    className="cursor-pointer"
                                                >
                                                    {disembarkedStudentIds.includes(student.id) ? t('teacher_page.status_disembarked') : boardedStudentIds.includes(student.id) ? t('teacher_page.status_boarded') : (notBoardingStudentIds.includes(student.id) ? t('teacher_page.status_not_riding_today') : t('teacher_page.status_not_boarded'))}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                        <CardFooter>
                            {selectedBus && (
                                <Button 
                                    onClick={handleToggleDeparture}
                                    variant={selectedBus.status === 'departed' ? 'destructive' : 'default'}
                                    className="w-full"
                                >
                                    {selectedBus.status === 'departed' ? <Undo2 className="mr-2"/> : <Rocket className="mr-2" />}
                                    {selectedBus.status === 'departed' ? "출발 취소" : "버스 출발"}
                                </Button>
                            )}
                        </CardFooter>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('teacher_page.disembark_management.title')}</CardTitle>
                            <CardDescription>{t('teacher_page.disembark_management.description')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {(currentRoute?.stops || []).map(stopId => {
                                    const dest = destinations.find(d => d.id === stopId);
                                    return dest ? (
                                        <Button key={stopId} variant={selectedDestinationId === stopId ? "default" : "outline"} onClick={() => setSelectedDestinationId(prev => prev === stopId ? null : stopId)}>
                                            {dest.name}
                                        </Button>
                                    ) : null;
                                })}
                            </div>
                            {selectedDestinationId && (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>{t('student.name')}</TableHead>
                                            <TableHead>{t('teacher_page.disembark_management.disembark')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {studentsToDisembark.map(student => (
                                            <TableRow key={student.id} onClick={() => toggleDisembark(student.id, selectedDestinationId)} className="cursor-pointer">
                                                <TableCell>{formatStudentName(student)}</TableCell>
                                                <TableCell>
                                                    <Button size="sm" variant="ghost">
                                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                        {studentsToDisembark.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center text-muted-foreground">
                                                    {t('teacher_page.disembark_management.no_students')}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">{t('teacher_page.student_info_title')}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {sidePanel}
                        </CardContent>
                    </Card>
                    <div>
                        <GroupLeaderManager records={groupLeaderRecords.map(r => ({...r, studentId: r.studentId, name: formatStudentName(students.find(s => s.id === r.studentId)!) || r.name, startDate: r.startDate, endDate: r.endDate, days: r.days }))} setRecords={setGroupLeaderRecords} />
                    </div>
                    <div>
                        <LostAndFound 
                        lostItems={lostItems}
                        setLostItems={setLostItems}
                        buses={buses}
                        />
                    </div>
                </div>
                <div className="contents lg:hidden">
                    <div className="order-first lg:order-none">
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
                                                        variant={disembarkedStudentIds.includes(student.id) ? 'outline' : boardedStudentIds.includes(student.id) ? 'default' : (notBoardingStudentIds.includes(student.id) ? 'destructive' : 'secondary')}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (!disembarkedStudentIds.includes(student.id)) {
                                                                handleSeatClick(0, student.id);
                                                            }
                                                        }}
                                                        className="cursor-pointer"
                                                    >
                                                        {disembarkedStudentIds.includes(student.id) ? t('teacher_page.status_disembarked') : boardedStudentIds.includes(student.id) ? t('teacher_page.status_boarded') : (notBoardingStudentIds.includes(student.id) ? t('teacher_page.status_not_riding_today') : t('teacher_page.status_not_boarded'))}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                            <CardFooter>
                                {selectedBus && (
                                    <Button 
                                        onClick={handleToggleDeparture}
                                        variant={selectedBus.status === 'departed' ? 'destructive' : 'default'}
                                        className="w-full"
                                    >
                                        {selectedBus.status === 'departed' ? <Undo2 className="mr-2"/> : <Rocket className="mr-2" />}
                                        {selectedBus.status === 'departed' ? "출발 취소" : "버스 출발"}
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    </div>
                    <div className="lg:order-none">
                        <Card>
                            <CardHeader>
                                <CardTitle>{t('teacher_page.disembark_management.title')}</CardTitle>
                                <CardDescription>{t('teacher_page.disembark_management.description')}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {(currentRoute?.stops || []).map(stopId => {
                                        const dest = destinations.find(d => d.id === stopId);
                                        return dest ? (
                                            <Button key={stopId} variant={selectedDestinationId === stopId ? "default" : "outline"} onClick={() => setSelectedDestinationId(prev => prev === stopId ? null : stopId)}>
                                                {dest.name}
                                            </Button>
                                        ) : null;
                                    })}
                                </div>
                                {selectedDestinationId && (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>{t('student.name')}</TableHead>
                                                <TableHead>{t('teacher_page.disembark_management.disembark')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {studentsToDisembark.map(student => (
                                                <TableRow key={student.id} onClick={() => toggleDisembark(student.id, selectedDestinationId)} className="cursor-pointer">
                                                    <TableCell>{formatStudentName(student)}</TableCell>
                                                    <TableCell>
                                                        <Button size="sm" variant="ghost">
                                                            <CheckCircle className="h-5 w-5 text-green-600" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {studentsToDisembark.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                                                        {t('teacher_page.disembark_management.no_students')}
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                    <div className="lg:order-none">
                        <Card>
                            <CardHeader>
                                <CardTitle className="font-headline">{t('teacher_page.student_info_title')}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {sidePanel}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        )}
    </MainLayout>
  );
}









