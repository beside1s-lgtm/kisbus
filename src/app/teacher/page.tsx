'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    onBusesUpdate,
    onStudentsUpdate,
    onRoutesUpdate,
    onDestinationsUpdate,
    onTeachersUpdate,
    onAfterSchoolTeachersUpdate,
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
import { Crown, UserX, ArrowLeftRight, Search, CheckCircle, Rocket, Undo2, Users, Trash2, Download } from 'lucide-react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getGradeValue = (grade: string): number => {
  const upperGrade = grade.toUpperCase();
  if (upperGrade.startsWith('K')) {
      const num = parseInt(upperGrade.replace('K', ''), 10);
      return isNaN(num) ? 0 : -100 + num;
  }
  const num = parseInt(upperGrade.replace(/\D/g, ''), 10);
  return isNaN(num) ? 999 : num;
};

const sortBuses = (buses: Bus[]): Bus[] => {
  return [...buses].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.name.localeCompare(b.name);
  });
};

const ClassListDownloadDialog = ({
    students,
    allRoutes,
    buses,
    destinations,
    t
}: {
    students: Student[];
    allRoutes: Route[];
    buses: Bus[];
    destinations: Destination[];
    t: any;
}) => {
    const [grade, setGrade] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [category, setCategory] = useState<'commute' | 'afterschool' | 'saturday'>('commute');
    const { toast } = useToast();

    const handleDownload = () => {
        if (!grade || !studentClass) {
            toast({ title: t('error'), description: "학년과 반을 모두 입력해주세요.", variant: 'destructive' });
            return;
        }

        let effectiveType: RouteType = 'Afternoon';
        let relevantDays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        if (category === 'afterschool') {
            effectiveType = 'AfterSchool';
            relevantDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];
        } else if (category === 'saturday') {
            effectiveType = 'AfterSchool';
            relevantDays = ['Saturday'];
        }

        const isSaturday = category === 'saturday';

        const filteredStudents = students.filter(s => 
            s.grade.toLowerCase() === grade.trim().toLowerCase() && 
            s.class.toLowerCase() === studentClass.trim().toLowerCase()
        );

        if (filteredStudents.length === 0) {
            toast({ title: t('notice'), description: "해당 학년/반의 학생을 찾을 수 없습니다." });
            return;
        }
        
        const assignedStudentsData = filteredStudents.map(student => {
            const routes = allRoutes.filter(r => 
                relevantDays.includes(r.dayOfWeek) && 
                r.type === effectiveType && 
                r.seating.some(seat => seat.studentId === student.id)
            );
            
            if (routes.length === 0) return null;
            
            const firstBus = buses.find(b => b.id === routes[0].busId);
            if (!firstBus) return null;

            return { student, bus: firstBus, routes };
        }).filter((item): item is NonNullable<typeof item> => item !== null);

        if (assignedStudentsData.length === 0) {
            toast({ title: t('notice'), description: "해당 조건에 배정된 학생이 없습니다." });
            return;
        }

        assignedStudentsData.sort((a, b) => {
            const nameA = a.bus.name;
            const nameB = b.bus.name;
            const numA = parseInt(nameA.replace(/\D/g, ''), 10);
            const numB = parseInt(nameB.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
            const busCompare = nameA.localeCompare(nameB);
            if (busCompare !== 0) return busCompare;
            return a.student.name.localeCompare(b.student.name, 'ko');
        });

        const headers = ["이름", "학년", "반", "버스", "목적지"];
        if (!isSaturday) {
            headers.push(t('day_short.monday'), t('day_short.tuesday'), t('day_short.wednesday'), t('day_short.thursday'), t('day_short.friday'));
        }

        const rows = assignedStudentsData.map(({ student, bus, routes }) => {
            let destId: string | null = null;
            if (isSaturday) {
                destId = student.satAfternoonDestinationId;
            } else {
                if (category === 'commute') destId = student.afternoonDestinationId;
                else destId = student.afterSchoolDestinations?.[routes[0].dayOfWeek] || null;
            }
            const destinationName = destinations.find(d => d.id === destId)?.name || t('unassigned');

            const escape = (val: string) => `"${val.toString().replace(/"/g, '""')}"`;
            const studentRow = [
                escape(student.name),
                escape(student.grade),
                escape(student.class),
                escape(bus.name),
                escape(destinationName)
            ];

            if (!isSaturday) {
                const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
                weekdays.forEach(day => {
                    const isAssignedOnDay = routes.some(r => r.dayOfWeek === day);
                    studentRow.push(isAssignedOnDay ? 'O' : 'X');
                });
            }

            return studentRow;
        });

        const csvContent = "\uFEFF" + headers.join(',') + "\n" + rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement("a"));
        
        const categoryLabels = {
            'commute': '등하교',
            'afterschool': '평일방과후',
            'saturday': '주말방과후'
        };
        const prefix = isSaturday ? "KIS_KoreanSchool" : "KIS_Class";
        const fileName = `${prefix}_Bus_List_${grade}_${studentClass}_${categoryLabels[category]}_${format(new Date(), 'yyyyMMdd')}.csv`;
        
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.click();
        document.body.removeChild(link);
        
        toast({ title: t('success'), description: "파일 다운로드가 시작되었습니다." });
    };

    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle>{t('teacher_page.download_class_list_dialog.title')}</DialogTitle>
                <CardDescription>{t('teacher_page.download_class_list_dialog.description')}</CardDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="grade" className="text-right">{t('teacher_page.download_class_list_dialog.grade_label')}</Label>
                    <Input id="grade" value={grade} onChange={e => setGrade(e.target.value)} className="col-span-3" placeholder="예: G1" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="class" className="text-right">{t('teacher_page.download_class_list_dialog.class_label')}</Label>
                    <Input id="class" value={studentClass} onChange={e => setStudentClass(e.target.value)} className="col-span-3" placeholder="예: C1" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right">노선</Label>
                    <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                        <SelectTrigger className="col-span-3">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="commute">등하교 (평일)</SelectItem>
                            <SelectItem value="afterschool">방과후 (평일)</SelectItem>
                            <SelectItem value="saturday">방과후 (주말)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <DialogFooter>
                <Button onClick={handleDownload}>{t('teacher_page.download_class_list_button')}</Button>
            </DialogFooter>
        </DialogContent>
    );
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
                return <Badge variant="default" className="text-[10px] sm:text-xs py-0 h-5 whitespace-nowrap">{t('teacher_page.status_boarded')}</Badge>;
            case 'notRiding':
                return <Badge variant="destructive" className="text-[10px] sm:text-xs py-0 h-5 whitespace-nowrap">{t('teacher_page.status_not_riding_today')}</Badge>;
            case 'disembarked':
                 return <Badge variant="outline" className="text-[10px] sm:text-xs py-0 h-5 whitespace-nowrap">{t('teacher_page.status_disembarked')}</Badge>;
            case 'not_boarded':
                 return <Badge variant="secondary" className="text-[10px] sm:text-xs py-0 h-5 whitespace-nowrap">{t('teacher_page.status_not_boarded')}</Badge>;
        }
    }

    return (
        <Card className="border-none shadow-none lg:border lg:shadow-sm w-full h-full">
            <CardHeader className="px-2 py-3 sm:px-4">
                <CardTitle className="text-base sm:text-lg">{t('teacher_page.all_buses_view.title')}</CardTitle>
            </CardHeader>
            <CardContent className="px-1 sm:px-2 max-h-[70vh] overflow-y-auto">
                <Table className="w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="whitespace-nowrap w-px">{t('student.name')}</TableHead>
                            <TableHead className="whitespace-nowrap w-px">{t('bus')}</TableHead>
                            <TableHead className="whitespace-nowrap">{t('teacher_page.status')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {allStudentsOnDay.map(student => (
                            <TableRow key={student.id}>
                                <TableCell className="whitespace-nowrap font-medium text-xs">{formatStudentName(student)}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{student.busName}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                    {getStatusBadge(student.status)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 {allStudentsOnDay.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-8">
                       {t('no_students')}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

const AllGroupLeadersStatus = ({
    relevantRoutes,
    students,
    buses,
    formatStudentName,
    t
}: {
    relevantRoutes: Route[];
    students: Student[];
    buses: Bus[];
    formatStudentName: (student: Student) => string;
    t: any;
}) => {
    const { toast } = useToast();
    const [leadersMap, setLeadersMap] = useState<Record<string, { name: string; days: number } | null>>({});
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    useEffect(() => {
        const fetchAllLeaders = async () => {
            const results: Record<string, { name: string; days: number } | null> = {};
            const promises = relevantRoutes.map(async (route) => {
                try {
                    const records = await getGroupLeaderRecords(route.id);
                    const activeLeader = records.find(r => r.endDate === null);
                    if (activeLeader) {
                        const days = differenceInDays(new Date(), new Date(activeLeader.startDate)) + 1;
                        const student = students.find(s => s.id === activeLeader.studentId);
                        const displayName = student ? formatStudentName(student) : (activeLeader.name || "알 수 없는 학생");
                        results[route.id] = { name: displayName, days };
                    } else {
                        results[route.id] = null;
                    }
                } catch (e) {
                    console.error("Error fetching leader for route", route.id, e);
                    results[route.id] = null;
                }
            });
            await Promise.all(promises);
            setLeadersMap(results);
        };

        if (relevantRoutes.length > 0) {
            fetchAllLeaders();
        } else {
            setLeadersMap({});
        }
    }, [relevantRoutes, students, formatStudentName, refreshTrigger]);

    const handleDeleteRecords = async (routeId: string) => {
        try {
            await saveGroupLeaderRecords(routeId, []);
            setRefreshTrigger(prev => prev + 1);
            toast({ title: t('success'), description: "해당 노선의 조장 기록이 삭제되었습니다." });
        } catch (e) {
            console.error("Failed to delete records", e);
            toast({ title: t('error'), description: "기록 삭제 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const sortedBusesWithLeaders = useMemo(() => {
        const list = relevantRoutes.map(route => {
            const bus = buses.find(b => b.id === route.busId);
            const leaderInfo = leadersMap[route.id];
            return {
                routeId: route.id,
                busName: bus?.name || '?',
                leaderName: leaderInfo?.name || t('unassigned'),
                days: leaderInfo?.days || 0
            };
        });

        return list.sort((a, b) => {
            const numA = parseInt(a.busName.replace(/\D/g, ''), 10);
            const numB = parseInt(b.busName.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.busName.localeCompare(b.busName);
        });
    }, [relevantRoutes, buses, leadersMap, t]);

    return (
        <Card className="border-none shadow-none lg:border lg:shadow-sm w-full h-full">
            <CardHeader className="px-2 py-3 sm:px-4">
                <CardTitle className="text-base sm:text-lg">{t('teacher_page.all_group_leaders_view.title')}</CardTitle>
            </CardHeader>
            <CardContent className="px-1 sm:px-2 max-h-[70vh] overflow-y-auto">
                <Table className="w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="whitespace-nowrap w-px">{t('bus')}</TableHead>
                            <TableHead className="whitespace-nowrap">{t('teacher_page.group_leader_management.name')}</TableHead>
                            <TableHead className="whitespace-nowrap w-px">{t('teacher_page.group_leader_management.days')}</TableHead>
                            <TableHead className="text-right whitespace-nowrap w-px">{t('actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedBusesWithLeaders.map((item, idx) => (
                            <TableRow key={idx}>
                                <TableCell className="font-medium whitespace-nowrap text-xs">{item.busName}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs truncate max-w-[100px] sm:max-w-none">{item.leaderName}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs">
                                    {item.days > 0 ? `${item.days}${t('teacher_page.group_leader_days_suffix')}` : '-'}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 sm:h-8 sm:w-8">
                                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>{t('teacher_page.group_leader_management.delete_confirm.title')}</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {t('teacher_page.group_leader_management.delete_confirm.description')}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteRecords(item.routeId)}>{t('delete')}</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {sortedBusesWithLeaders.length === 0 && (
                    <div className="text-center text-xs text-muted-foreground py-8">
                        {t('no_route_info')}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


const TeacherAssignmentViewDialog = ({
    buses,
    allRoutes,
    teachers,
    afterSchoolTeachers,
    selectedDay,
    selectedRouteType,
    t
}: {
    buses: Bus[];
    allRoutes: Route[];
    teachers: Teacher[];
    afterSchoolTeachers: Teacher[];
    selectedDay: DayOfWeek;
    selectedRouteType: RouteType;
    t: any;
}) => {
    const getTeachersForBus = (busId: string) => {
        const route = allRoutes.find(r => r.busId === busId && r.dayOfWeek === selectedDay && r.type === selectedRouteType);
        if (!route || !route.teacherIds || route.teacherIds.length === 0) return t('unassigned');
        
        const pool = selectedRouteType === 'AfterSchool' ? afterSchoolTeachers : teachers;
        
        const names = route.teacherIds
            .map(id => pool.find(t => t.id === id)?.name)
            .filter(Boolean);
        return names.length > 0 ? names.join(', ') : t('unassigned');
    };

    return (
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{t('teacher_page.assignments_dialog.title')}</DialogTitle>
                <CardDescription>
                    {t('teacher_page.assignments_dialog.description')}
                    <br />
                    {t('day')}: {t(`day.${selectedDay.toLowerCase()}`)} | {t('route')}: {selectedRouteType === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${selectedRouteType.toLowerCase()}`)}
                </CardDescription>
            </DialogHeader>
            <div className="mt-4 border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('admin.bus_registration.bus_number')}</TableHead>
                            <TableHead>{t('type')}</TableHead>
                            <TableHead>{t('admin.teacher_assignment.title')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortBuses([...buses]).map(bus => (
                            <TableRow key={bus.id} className={cn(!(bus.isActive ?? true) && "opacity-50 bg-muted/20")}>
                                <TableCell className="font-medium whitespace-nowrap">{bus.name}</TableCell>
                                <TableCell className="whitespace-nowrap">{t(`bus_type.${bus.type}`)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {getTeachersForBus(bus.id).split(', ').map((name, i) => (
                                            name === t('unassigned') ? 
                                            <span key={i} className="text-muted-foreground italic text-xs">{name}</span> :
                                            <Badge key={i} variant="secondary" className="font-normal text-xs py-0 h-5 whitespace-nowrap">{name}</Badge>
                                        ))}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </DialogContent>
    );
};


export default function TeacherPage() {
  const { t } = useTranslation();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [afterSchoolTeachers, setAfterSchoolTeachers] = useState<Teacher[]>([]);
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

  const lastLoadedRouteIdRef = useRef<string | null>(null);
  const lastProcessedDateRef = useRef<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !selectedDate) {
        const now = new Date();
        const vTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60000);
        const h = vTime.getHours();
        const d = vTime.getDay();
        let tDate = new Date(vTime);

        if (d >= 1 && d <= 5) {
            if (h >= 19) tDate.setDate(tDate.getDate() + 1);
        } else if (d === 6) {
            if (h >= 14) tDate.setDate(tDate.getDate() + 2);
        } else {
            tDate.setDate(tDate.getDate() + 1);
        }
        
        setSelectedDate(format(tDate, 'yyyy-MM-dd'));
    }
  }, [isClient, selectedDate]);


  useEffect(() => {
    const unsubscribers = [
      onBusesUpdate((data) => setBuses(sortBuses(data))),
      onStudentsUpdate(setStudents),
      onRoutesUpdate(setAllRoutes),
      onDestinationsUpdate(setDestinations),
      onTeachersUpdate(setTeachers),
      onAfterSchoolTeachersUpdate(setAfterSchoolTeachers),
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
        const isNewDate = selectedDate !== lastProcessedDateRef.current;
        const targetDate = new Date(selectedDate);
        const isSat = getDay(targetDate) === 6;
        const isSun = getDay(targetDate) === 0;
        
        if (isSun) {
            setSelectedDay('Monday');
        } else {
            const dayIndex = getDay(targetDate);
            setSelectedDay(DAYS[dayIndex - 1]);
        }

        if (isNewDate) {
            lastProcessedDateRef.current = selectedDate;
            
            const isToday = format(targetDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            if (isToday) {
                const now = new Date();
                const vTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60000);
                const vietnamHour = vTime.getHours();

                if (isSat) {
                    if (vietnamHour < 11) {
                        setSelectedRouteType('Morning');
                    } else if (vietnamHour < 14) {
                        setSelectedRouteType('AfterSchool');
                    } else {
                    }
                } else {
                    if (vietnamHour >= 9 && vietnamHour < 16) {
                        setSelectedRouteType('Afternoon');
                    } else if (vietnamHour >= 16 && vietnamHour < 19) {
                        setSelectedRouteType('AfterSchool');
                    } else {
                        setSelectedRouteType('Morning');
                    }
                }
            } else {
                setSelectedRouteType('Morning');
            }
        }
    }
  }, [selectedDate]);

  
  const currentRoute = useMemo(() => {
    if (selectedBusId === 'all') return null;
    return allRoutes.find(r => 
      r.busId === selectedBusId && 
      r.dayOfWeek === selectedDay && 
      r.type === selectedRouteType
    );
  }, [allRoutes, selectedBusId, selectedDay, selectedRouteType]);

  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);

  const filteredBuses = useMemo(() => {
    const operationalBusIds = new Set<string>();
    allRoutes.forEach(route => {
        if (route.dayOfWeek === selectedDay && route.type === selectedRouteType) {
            if ((route.stops?.length ?? 0) > 0 && route.seating.some(s => s.studentId !== null)) {
                operationalBusIds.add(route.busId);
            }
        }
    });
    return buses.filter(bus => (bus.isActive ?? true) && operationalBusIds.has(bus.id));
}, [buses, allRoutes, selectedDay, selectedRouteType]);

  const relevantRoutesForDay = useMemo(() => {
    const activeBusIds = new Set(filteredBuses.map(b => b.id));
    return allRoutes.filter(r => 
        r.dayOfWeek === selectedDay && 
        r.type === selectedRouteType &&
        activeBusIds.has(r.busId)
    );
  }, [allRoutes, selectedDay, selectedRouteType, filteredBuses]);

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
        const pool = selectedRouteType === 'AfterSchool' ? afterSchoolTeachers : teachers;
        return currentRoute.teacherIds.map(id => pool.find(t => t.id === id)).filter(Boolean) as Teacher[];
    }, [currentRoute, teachers, afterSchoolTeachers, selectedRouteType]);

  useEffect(() => {
    if (currentRoute) {
      const fetchLeaderRecords = async () => {
          try {
              const records = await getGroupLeaderRecords(currentRoute.id);
              lastLoadedRouteIdRef.current = currentRoute.id;
              setGroupLeaderRecords(records);
          } catch(e) {
              console.error("Failed to fetch leader records", e);
              setGroupLeaderRecords([]); 
          }
      };
      fetchLeaderRecords();
    } else {
        setGroupLeaderRecords([]);
        lastLoadedRouteIdRef.current = null;
    }
  }, [currentRoute]);
  
  useEffect(() => {
    if (currentRoute && lastLoadedRouteIdRef.current === currentRoute.id) {
        const recordsToSave = groupLeaderRecords.map(({name, ...rest}) => rest);
        saveGroupLeaderRecords(currentRoute.id, recordsToSave).catch(e => console.error("Failed to save leader records", e));
    }
  }, [groupLeaderRecords, currentRoute]);

  useEffect(() => {
    if (!currentRoute || !students.length || lastLoadedRouteIdRef.current !== currentRoute.id) return;

    const activeLeaderIndex = groupLeaderRecords.findIndex(r => r.endDate === null);
    if (activeLeaderIndex === -1) return;

    const activeLeader = groupLeaderRecords[activeLeaderIndex];
    const isStillOnRoute = currentRoute.seating.some(s => s.studentId === activeLeader.studentId);
    
    const studentExists = students.some(s => s.id === activeLeader.studentId);

    if (!isStillOnRoute || !studentExists) {
        const newRecords = [...groupLeaderRecords];
        const dateStr = format(new Date(), 'yyyy-MM-dd');
        newRecords[activeLeaderIndex].endDate = dateStr;
        newRecords[activeLeaderIndex].days = differenceInDays(new Date(dateStr), new Date(newRecords[activeLeaderIndex].startDate)) + 1;
        setGroupLeaderRecords(newRecords);
        toast({
            title: t('notice'),
            description: studentExists ? "조장이 버스에서 하차하여 활동이 종료되었습니다." : "조장 학생 정보가 삭제되어 활동이 종료되었습니다.",
        });
    }
  }, [currentRoute, students, groupLeaderRecords, t, toast]);

  const studentsOnCurrentRoute = useMemo(() => {
      if (!currentRoute) return [];
      const studentIdsOnRoute = new Set<string>();
      currentRoute.seating.forEach(seat => {
          if(seat.studentId) studentIdsOnRoute.add(seat.studentId);
      });
      
      const getStatusPriority = (studentId: string) => {
        if (boardedStudentIds.includes(studentId) || notBoardingStudentIds.includes(studentId)) {
            return 2;
        }
        return 1;
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
        toast({ title: t('error'), description: t('teacher_page.boarding_error'), variant: "destructive"});
      });
  }, [currentRoute, selectedDate, notBoardingStudentIds, boardedStudentIds, disembarkedStudentIds, completedDestinations, toast, t]);

  const toggleDisembark = useCallback(async (studentId: string, destinationId: string) => {
    if (!currentRoute) return;

    const isDisembarked = disembarkedStudentIds.includes(studentId);
    
    const newDisembarkedIds = isDisembarked
        ? disembarkedStudentIds.filter(id => id !== studentId)
        : [...disembarkedStudentIds, studentId];
      
    const newBoardedIds = isDisembarked
        ? [...boardedStudentIds, studentId]
        : boardedStudentIds.filter(id => id !== studentId);

    let newCompletedDestinations = [...completedDestinations];
    
    const studentsForDestination = studentsOnCurrentRoute.filter(s => {
        let destId: string | null = null;
        if (selectedDay === 'Saturday') {
            if (selectedRouteType === 'Morning') destId = s.satMorningDestinationId;
            else destId = s.satAfternoonDestinationId;
        } else {
            if (selectedRouteType === 'Morning') destId = s.morningDestinationId;
            else if (selectedRouteType === 'Afternoon') destId = s.afternoonDestinationId;
            else if (selectedRouteType === 'AfterSchool') destId = s.afterSchoolDestinations?.[selectedDay] || null;
        }
        return destId === destinationId;
    });

    const disembarkedForDestination = studentsForDestination.filter(s => newDisembarkedIds.includes(s.id));

    if (disembarkedForDestination.length === studentsForDestination.length && studentsForDestination.length > 0) {
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

    if (existingRecordIndex > -1) {
        const record = newRecords[existingRecordIndex];
        record.endDate = dateStr;
        record.days = differenceInDays(new Date(dateStr), new Date(record.startDate)) + 1;
    } else {
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
    if (selectedStudent && selectedStudent.id === student.id) {
        setSelectedStudent(prev => prev ? {...prev, isGroupLeader: !prev.isGroupLeader} : null);
    }
  };
  
    const handleSeatClick = (seatNumber: number, studentId: string | null) => {
      if (!studentId || !currentRoute) {
        setLastClickedStudentId(null);
        setSelectedStudent(null);
        return;
      }
      
      const isBoarded = boardedStudentIds.includes(studentId);
      const isDisembarked = disembarkedStudentIds.includes(studentId);

      let newBoarded = [...boardedStudentIds];
      let newDisembarked = [...disembarkedStudentIds];
      let newNotBoarding = notBoardingStudentIds.filter(id => id !== studentId);

      if (isDisembarked) {
          newDisembarked = newDisembarked.filter(id => id !== studentId);
      } else if (isBoarded) {
          newBoarded = newBoarded.filter(id => id !== studentId);
          newDisembarked.push(studentId);
      } else {
          newBoarded.push(studentId);
      }
  
      updateAttendance(currentRoute.id, selectedDate, { 
          boarded: newBoarded, 
          notBoarding: newNotBoarding, 
          disembarked: newDisembarked, 
          completedDestinations 
      })
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
    const queryOnlyNumbers = searchQuery.replace(/\D/g, '');
    
    return students
        .filter(s => {
            const nameMatch = formatStudentName(s).toLowerCase().includes(lowerCaseQuery);
            if (nameMatch) return true;
            if (queryOnlyNumbers && s.contact) {
                const contactOnlyNumbers = s.contact.replace(/\D/g, '');
                if (contactOnlyNumbers.includes(queryOnlyNumbers)) return true;
            }
            return false;
        })
        .map(student => {
            const studentRoute = allRoutes.find(route => 
                route.seating.some(seat => seat.studentId === student.id)
            );
            const busName = studentRoute ? buses.find(b => b.id === studentRoute.busId)?.name : undefined;

            let destId: string | null = null;
            if (selectedDay === 'Saturday') {
                if (selectedRouteType === 'Morning') destId = student.satMorningDestinationId;
                else destId = student.satAfternoonDestinationId;
            } else {
                if (selectedRouteType === 'Morning') destId = student.morningDestinationId;
                else if (selectedRouteType === 'Afternoon') destId = student.afternoonDestinationId;
                else if (selectedRouteType === 'AfterSchool') destId = student.afterSchoolDestinations?.[selectedDay] || null;
            }
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
        setSelectedBusId('');
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
        if (selectedDay === 'Saturday') {
            if (selectedRouteType === 'Morning') return student.satMorningDestinationId;
            return student.satAfternoonDestinationId;
        }
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
            </div>
        </div>
        <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">{t('route')}</Label>
            <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
                <TabsList className={cn("grid w-full", "grid-cols-3")}>
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
                                    {student.contact && `, ${student.contact}`}
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
                            if (selectedDay === 'Saturday') {
                                if (selectedRouteType === 'Morning') destId = selectedStudent.satMorningDestinationId;
                                else destId = selectedStudent.satAfternoonDestinationId;
                            } else {
                                if (selectedRouteType === 'Morning') destId = selectedStudent.morningDestinationId;
                                else if (selectedRouteType === 'Afternoon') destId = selectedStudent.afternoonDestinationId;
                                else if (selectedRouteType === 'AfterSchool') destId = selectedStudent.afterSchoolDestinations?.[selectedDay] || null;
                            }
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
    <MainLayout 
        headerContent={headerContent}
        titleActions={
            <div className="flex gap-2">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">
                            <Download className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">{t('teacher_page.download_class_list_button')}</span>
                            <span className="sm:hidden">{t('template')}</span>
                        </Button>
                    </DialogTrigger>
                    <ClassListDownloadDialog 
                        students={students}
                        allRoutes={allRoutes}
                        buses={buses}
                        destinations={destinations}
                        t={t}
                    />
                </Dialog>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8">
                            <Users className="mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">{t('teacher_page.check_assignments_button')}</span>
                            <span className="sm:hidden">{t('confirm')}</span>
                        </Button>
                    </DialogTrigger>
                    <TeacherAssignmentViewDialog 
                        buses={buses}
                        allRoutes={allRoutes}
                        teachers={teachers}
                        afterSchoolTeachers={afterSchoolTeachers}
                        selectedDay={selectedDay}
                        selectedRouteType={selectedRouteType}
                        t={t}
                    />
                </Dialog>
            </div>
        }
    >
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
                <AllStudentsBoardingStatus
                    relevantRoutes={relevantRoutesForDay}
                    students={students}
                    buses={buses}
                    allAttendance={allAttendance}
                    formatStudentName={formatStudentName}
                    t={t}
                />
                <AllGroupLeadersStatus
                    relevantRoutes={relevantRoutesForDay}
                    students={students}
                    buses={buses}
                    formatStudentName={formatStudentName}
                    t={t}
                />
            </div>
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
                        <GroupLeaderManager records={groupLeaderRecords.map(r => {
                            const student = students.find(s => s.id === r.studentId);
                            return {
                                ...r,
                                name: student ? formatStudentName(student) : (r.name || "알 수 없는 학생"),
                            };
                        })} setRecords={setGroupLeaderRecords} />
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
                                        <TableHead className="whitespace-nowrap w-px">{t('student.name')}</TableHead>
                                        <TableHead className="whitespace-nowrap">{t('teacher_page.status')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {studentsOnCurrentRoute.map(student => (
                                        <TableRow 
                                            key={student.id} 
                                            onClick={() => setLastClickedStudentId(student.id)}
                                            className="cursor-pointer"
                                        >
                                            <TableCell className="whitespace-nowrap">{formatStudentName(student)} {groupLeaderRecords.some(r => r.studentId === student.id && r.endDate === null) && "👑"}</TableCell>
                                            <TableCell className="whitespace-nowrap">
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
                                            <TableHead className="whitespace-nowrap w-px">{t('student.name')}</TableHead>
                                            <TableHead className="whitespace-nowrap">{t('teacher_page.disembark_management.disembark')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {studentsToDisembark.map(student => (
                                            <TableRow key={student.id} onClick={() => toggleDisembark(student.id, selectedDestinationId)} className="cursor-pointer">
                                                <TableCell className="whitespace-nowrap">{formatStudentName(student)}</TableCell>
                                                <TableCell className="whitespace-nowrap">
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
                    <div className="w-full">
                        <GroupLeaderManager records={groupLeaderRecords.map(r => {
                            const student = students.find(s => s.id === r.studentId);
                            return {
                                ...r,
                                name: student ? formatStudentName(student) : (r.name || "알 수 없는 학생"),
                            };
                        })} setRecords={setGroupLeaderRecords} />
                    </div>
                    <div className="w-full">
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
                                            <TableHead className="whitespace-nowrap w-px">{t('student.name')}</TableHead>
                                            <TableHead className="whitespace-nowrap">{t('teacher_page.status')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {studentsOnCurrentRoute.map(student => (
                                            <TableRow 
                                                key={student.id} 
                                                onClick={() => setLastClickedStudentId(student.id)}
                                                className="cursor-pointer"
                                            >
                                                <TableCell className="whitespace-nowrap">{formatStudentName(student)} {groupLeaderRecords.some(r => r.studentId === student.id && r.endDate === null) && "👑"}</TableCell>
                                                <TableCell className="whitespace-nowrap">
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
                                                <TableHead className="whitespace-nowrap w-px">{t('student.name')}</TableHead>
                                                <TableHead className="whitespace-nowrap">{t('teacher_page.disembark_management.disembark')}</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {studentsToDisembark.map(student => (
                                                <TableRow key={student.id} onClick={() => toggleDisembark(student.id, selectedDestinationId)} className="cursor-pointer">
                                                    <TableCell className="whitespace-nowrap">{formatStudentName(student)}</TableCell>
                                                    <TableCell className="whitespace-nowrap">
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
