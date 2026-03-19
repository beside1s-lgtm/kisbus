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
import { Crown, UserX, ArrowLeftRight, Search, CheckCircle, Rocket, Undo2, Users, Trash2, Download, Printer } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { LostAndFound } from './components/lost-and-found';
import { useTranslation } from '@/hooks/use-translation';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getGradeValue = (grade: string): number => {
  const upperGrade = grade.trim().toUpperCase();
  if (upperGrade === 'S') return -50; 
  if (upperGrade.startsWith('K')) {
      const num = parseInt(upperGrade.replace('K', ''), 10);
      return isNaN(num) ? -100 : -100 + num;
  }
  const num = parseInt(upperGrade.replace(/\D/g, ''), 10);
  return isNaN(num) ? 999 : num;
};

const sortBuses = (buses: Bus[]): Bus[] => {
  return [...buses].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
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
        if (category === 'afterschool') { effectiveType = 'AfterSchool'; relevantDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday']; }
        else if (category === 'saturday') { effectiveType = 'AfterSchool'; relevantDays = ['Saturday']; }
        const isSat = category === 'saturday';
        const filteredStudents = students.filter(s => s.grade.toLowerCase() === grade.trim().toLowerCase() && s.class.toLowerCase() === studentClass.trim().toLowerCase());
        if (filteredStudents.length === 0) { toast({ title: t('notice'), description: "해당 학년/반의 학생을 찾을 수 없습니다." }); return; }
        const assignedStudentsData = filteredStudents.map(student => {
            const routes = allRoutes.filter(r => relevantDays.includes(r.dayOfWeek) && r.type === effectiveType && r.seating.some(seat => seat.studentId === student.id));
            if (routes.length === 0) return null;
            const firstBus = buses.find(b => b.id === routes[0].busId);
            return firstBus ? { student, bus: firstBus, routes } : null;
        }).filter((item): item is NonNullable<typeof item> => item !== null);
        if (assignedStudentsData.length === 0) { toast({ title: t('notice'), description: "해당 조건에 배정된 학생이 없습니다." }); return; }
        assignedStudentsData.sort((a, b) => {
            const numA = parseInt(a.bus.name.replace(/\D/g, ''), 10);
            const numB = parseInt(b.bus.name.replace(/\D/g, ''), 10);
            if (!isNaN(numA) && !isNaN(numB) && numA !== numB) return numA - numB;
            return a.student.name.localeCompare(b.student.name, 'ko');
        });
        const headers = ["이름", "학년", "반", "버스", "목적지"];
        if (!isSat) headers.push(t('day_short.monday'), t('day_short.tuesday'), t('day_short.wednesday'), t('day_short.thursday'), t('day_short.friday'));
        const rows = assignedStudentsData.map(({ student, bus, routes }) => {
            let destId = isSat ? student.satAfternoonDestinationId : (category === 'commute' ? student.afternoonDestinationId : student.afterSchoolDestinations?.[routes[0].dayOfWeek] || null);
            const destinationName = destinations.find(d => d.id === destId)?.name || t('unassigned');
            const escape = (val: any) => `"${val.toString().replace(/"/g, '""')}"`;
            const studentRow = [escape(student.name), escape(student.grade), escape(student.class), escape(bus.name), escape(destinationName)];
            if (!isSat) { const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']; weekdays.forEach(day => studentRow.push(routes.some(r => r.dayOfWeek === day) ? 'O' : 'X')); }
            return studentRow;
        });
        const csvContent = "\uFEFF" + headers.join(',') + "\n" + rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.body.appendChild(document.createElement("a"));
        link.href = URL.createObjectURL(blob);
        link.download = `${isSat ? "KIS_KoreanSchool" : "KIS_Class"}_Bus_List_${grade}_${studentClass}_${format(new Date(), 'yyyyMMdd')}.csv`;
        link.click();
        document.body.removeChild(link);
        toast({ title: t('success'), description: "파일 다운로드가 시작되었습니다." });
    };

    return (
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>{t('teacher_page.download_class_list_dialog.title')}</DialogTitle><DialogDescription>{t('teacher_page.download_class_list_dialog.description')}</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="grade" className="text-right">{t('teacher_page.download_class_list_dialog.grade_label')}</Label><Input id="grade" value={grade} onChange={e => setGrade(e.target.value)} className="col-span-3" placeholder="예: 1" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="class" className="text-right">{t('teacher_page.download_class_list_dialog.class_label')}</Label><Input id="class" value={studentClass} onChange={e => setStudentClass(e.target.value)} className="col-span-3" placeholder="예: 1" /></div>
                <div className="grid grid-cols-4 items-center gap-4"><Label htmlFor="category" className="text-right">노선</Label><Select value={category} onValueChange={(v: any) => setCategory(v)}><SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="commute">등하교 (평일)</SelectItem><SelectItem value="afterschool">방과후 (평일)</SelectItem><SelectItem value="saturday">방과후 (주말)</SelectItem></SelectContent></Select></div>
            </div>
            <DialogFooter><Button onClick={handleDownload}>{t('teacher_page.download_class_list_button')}</Button></DialogFooter>
        </DialogContent>
    );
};

const AllStudentsBoardingStatus = ({ relevantRoutes, students, buses, allAttendance, formatStudentName, t }: { relevantRoutes: Route[]; students: Student[]; buses: Bus[]; allAttendance: Record<string, AttendanceRecord | null>; formatStudentName: (student: Student) => string; t: any; }) => {
    const allStudentsOnDay = useMemo(() => {
        const studentsList: (Student & { busName: string; status: 'boarded' | 'notRiding' | 'disembarked' | 'not_boarded' })[] = [];
        relevantRoutes.forEach(route => {
            const bus = buses.find(b => b.id === route.busId);
            if (!bus) return;
            route.seating.forEach(seat => {
                if (!seat.studentId) return;
                const student = students.find(s => s.id === seat.studentId);
                if (student) {
                    const record = allAttendance[route.id];
                    let status: any = 'not_boarded';
                    if (record?.boarded?.includes(student.id)) status = 'boarded';
                    else if (record?.notBoarding?.includes(student.id)) status = 'notRiding';
                    else if (record?.disembarked?.includes(student.id)) status = 'disembarked';
                    if (!studentsList.some(s => s.id === student.id)) studentsList.push({ ...student, busName: bus.name, status });
                }
            });
        });
        return studentsList.sort((a,b) => {
            const priority = (s: string) => s === 'not_boarded' ? 1 : 2;
            if (priority(a.status) !== priority(b.status)) return priority(a.status) - priority(b.status);
            if (getGradeValue(a.grade) !== getGradeValue(b.grade)) return getGradeValue(a.grade) - getGradeValue(b.grade);
            if (a.class !== b.class) return a.class.localeCompare(b.class, undefined, { numeric: true });
            return a.name.localeCompare(b.name, 'ko');
        });
    }, [relevantRoutes, students, buses, allAttendance]);

    return (
        <Card className="border-none shadow-none lg:border lg:shadow-sm w-full h-full">
            <CardHeader className="px-2 py-3 sm:px-4"><CardTitle className="text-base sm:text-lg">{t('teacher_page.all_buses_view.title')}</CardTitle></CardHeader>
            <CardContent className="px-1 sm:px-2 max-h-[70vh] overflow-y-auto">
                <Table className="w-full">
                    <TableHeader><TableRow><TableHead className="whitespace-nowrap w-px">{t('student.name')}</TableHead><TableHead className="whitespace-nowrap w-px">{t('bus')}</TableHead><TableHead className="whitespace-nowrap">{t('teacher_page.status')}</TableHead></TableRow></TableHeader>
                    <TableBody>{allStudentsOnDay.map(s => (
                        <TableRow key={s.id}><TableCell className="whitespace-nowrap font-medium text-xs">{formatStudentName(s)}</TableCell><TableCell className="whitespace-nowrap text-xs text-muted-foreground">{s.busName}</TableCell><TableCell className="whitespace-nowrap">
                            <Badge variant={s.status === 'boarded' ? 'default' : (s.status === 'notRiding' ? 'destructive' : (s.status === 'disembarked' ? 'outline' : 'secondary'))} className="text-[10px] sm:text-xs py-0 h-5 whitespace-nowrap">{t(`teacher_page.status_${s.status}`)}</Badge>
                        </TableCell></TableRow>
                    ))}</TableBody>
                </Table>
                {allStudentsOnDay.length === 0 && <div className="text-center text-xs text-muted-foreground py-8">{t('no_students')}</div>}
            </CardContent>
        </Card>
    );
};

const AllGroupLeadersStatus = ({ relevantRoutes, students, buses, formatStudentName, t }: { relevantRoutes: Route[]; students: Student[]; buses: Bus[]; formatStudentName: (student: Student) => string; t: any; }) => {
    const [leadersMap, setLeadersMap] = useState<Record<string, { names: string[]; days: number } | null>>({});
    useEffect(() => {
        const fetchAll = async () => {
            const results: any = {};
            await Promise.all(relevantRoutes.map(async (r) => {
                const recs = await getGroupLeaderRecords(r.id);
                const active = recs.filter(x => x.endDate === null);
                if (active.length > 0) {
                    const days = differenceInDays(new Date(), new Date(Math.min(...active.map(l => new Date(l.startDate).getTime())))) + 1;
                    results[r.id] = { names: active.map(l => students.find(s => s.id === l.studentId) ? formatStudentName(students.find(s => s.id === l.studentId)!) : (l.name || "알 수 없음")), days };
                } else results[r.id] = null;
            }));
            setLeadersMap(results);
        };
        if (relevantRoutes.length > 0) fetchAll();
    }, [relevantRoutes, students, formatStudentName]);

    const sorted = useMemo(() => relevantRoutes.map(r => ({ routeId: r.id, busName: buses.find(b => b.id === r.busId)?.name || '?', leaderNames: leadersMap[r.id]?.names || [t('unassigned')], days: leadersMap[r.id]?.days || 0 }))
        .sort((a,b) => { const numA = parseInt(a.busName.replace(/\D/g, ''), 10); const numB = parseInt(b.busName.replace(/\D/g, ''), 10); return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.busName.localeCompare(b.busName); }), [relevantRoutes, buses, leadersMap, t]);

    return (
        <Card className="border-none shadow-none lg:border lg:shadow-sm w-full h-full">
            <CardHeader className="px-2 py-3 sm:px-4"><CardTitle className="text-base sm:text-lg">{t('teacher_page.all_group_leaders_view.title')}</CardTitle></CardHeader>
            <CardContent className="px-1 sm:px-2 max-h-[70vh] overflow-y-auto">
                <Table className="w-full">
                    <TableHeader><TableRow><TableHead className="whitespace-nowrap w-px">{t('bus')}</TableHead><TableHead className="whitespace-nowrap">{t('teacher_page.group_leader_management.name')}</TableHead><TableHead className="whitespace-nowrap w-px">{t('teacher_page.group_leader_management.days')}</TableHead></TableRow></TableHeader>
                    <TableBody>{sorted.map((item, idx) => (
                        <TableRow key={idx}><TableCell className="font-medium whitespace-nowrap text-xs">{item.busName}</TableCell><TableCell className="whitespace-nowrap text-xs"><div className="flex flex-col gap-0.5">{item.leaderNames.map((n, i) => <span key={i} className="truncate max-w-[100px] sm:max-w-none">{n}</span>)}</div></TableCell><TableCell className="whitespace-nowrap text-xs">{item.days > 0 ? `${item.days}${t('teacher_page.group_leader_days_suffix')}` : '-'}</TableCell></TableRow>
                    ))}</TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

const TeacherAssignmentViewDialog = ({ buses, allRoutes, teachers, afterSchoolTeachers, selectedDay, selectedRouteType, t }: { buses: Bus[]; allRoutes: Route[]; teachers: Teacher[]; afterSchoolTeachers: Teacher[]; selectedDay: DayOfWeek; selectedRouteType: RouteType; t: any; }) => {
    const getNames = (bid: string) => {
        const r = allRoutes.find(x => x.busId === bid && x.dayOfWeek === selectedDay && x.type === selectedRouteType);
        if (!r?.teacherIds?.length) return t('unassigned');
        const pool = selectedRouteType === 'AfterSchool' ? afterSchoolTeachers : teachers;
        return r.teacherIds.map(id => pool.find(x => x.id === id)?.name).filter(Boolean).join(', ') || t('unassigned');
    };
    return (
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t('teacher_page.assignments_dialog.title')}</DialogTitle><DialogDescription>{t('teacher_page.assignments_dialog.description')}<br/>{t('day')}: {t(`day.${selectedDay.toLowerCase()}`)} | {t('route')}: {selectedRouteType === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${selectedRouteType.toLowerCase()}`)}</DialogDescription></DialogHeader>
            <div className="mt-4 border rounded-md"><Table><TableHeader><TableRow><TableHead>{t('admin.bus_registration.bus_number')}</TableHead><TableHead>{t('type')}</TableHead><TableHead>{t('admin.teacher_assignment.title')}</TableHead></TableRow></TableHeader><TableBody>{sortBuses([...buses]).map(b => (
                <TableRow key={b.id} className={cn(!(b.isActive ?? true) && "opacity-50 bg-muted/20")}><TableCell className="font-medium whitespace-nowrap">{b.name}</TableCell><TableCell className="whitespace-nowrap">{t(`bus_type.${b.type}`)}</TableCell><TableCell><div className="flex flex-wrap gap-1">{getNames(b.id).split(', ').map((n: string, i: number) => n === t('unassigned') ? <span key={i} className="text-muted-foreground italic text-xs">{n}</span> : <Badge key={i} variant="secondary" className="font-normal text-xs py-0 h-5 whitespace-nowrap">{n}</Badge>)}</div></TableCell></TableRow>
            ))}</TableBody></Table></div>
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
  const { toast } = useToast();

  useEffect(() => {
    const now = new Date();
    const vTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60000);
    const h = vTime.getHours(), d = vTime.getDay();
    let tDate = new Date(vTime);
    if (d >= 1 && d <= 5 && h >= 19) tDate.setDate(tDate.getDate() + 1);
    else if (d === 6 && h >= 14) tDate.setDate(tDate.getDate() + 2);
    else if (d === 0) tDate.setDate(tDate.getDate() + 1);
    setSelectedDate(format(tDate, 'yyyy-MM-dd'));
    onBusesUpdate(setBuses); onStudentsUpdate(setStudents); onRoutesUpdate(setAllRoutes); onDestinationsUpdate(setDestinations); onTeachersUpdate(setTeachers); onAfterSchoolTeachersUpdate(setAfterSchoolTeachers); onLostItemsUpdate(setLostItems);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedDate) {
        const targetDate = new Date(selectedDate), dayIdx = targetDate.getDay();
        setSelectedDay(dayIdx === 0 ? 'Monday' : DAYS[dayIdx - 1]);
        const isToday = format(targetDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        if (isToday) {
            const vTime = new Date(new Date().getTime() + (new Date().getTimezoneOffset() + 420) * 60000);
            const vh = vTime.getHours();
            if (dayIdx === 6) setSelectedRouteType(vh < 11 ? 'Morning' : 'AfterSchool');
            else setSelectedRouteType(vh < 9 ? 'Morning' : (vh < 16 ? 'Afternoon' : 'AfterSchool'));
        }
    }
  }, [selectedDate]);

  const currentRoute = useMemo(() => selectedBusId === 'all' ? null : allRoutes.find(r => r.busId === selectedBusId && r.dayOfWeek === selectedDay && r.type === selectedRouteType), [allRoutes, selectedBusId, selectedDay, selectedRouteType]);
  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
  const filteredBuses = useMemo(() => buses.filter(b => (b.isActive ?? true) && allRoutes.some(r => r.busId === b.id && r.dayOfWeek === selectedDay && r.type === selectedRouteType && r.stops?.length > 0 && r.seating.some(s => s.studentId !== null))), [buses, allRoutes, selectedDay, selectedRouteType]);
  const relevantRoutesForDay = useMemo(() => { const activeIds = new Set(filteredBuses.map(b => b.id)); return allRoutes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType && activeIds.has(r.busId)); }, [allRoutes, selectedDay, selectedRouteType, filteredBuses]);

  useEffect(() => { if (currentRoute) return onAttendanceUpdate(currentRoute.id, selectedDate, setAttendance); else setAttendance(null); }, [currentRoute, selectedDate]);
  useEffect(() => {
    if (selectedBusId !== 'all') { setAllAttendance({}); return; }
    const unsubs = relevantRoutesForDay.map(r => onAttendanceUpdate(r.id, selectedDate, (rec) => setAllAttendance(prev => ({ ...prev, [r.id]: rec }))));
    return () => unsubs.forEach(u => u());
  }, [selectedBusId, relevantRoutesForDay, selectedDate]);

  const boardedStudentIds = attendance?.boarded || [], notBoardingStudentIds = attendance?.notBoarding || [], disembarkedStudentIds = attendance?.disembarked || [], completedDestinations = attendance?.completedDestinations || [];

  useEffect(() => {
    if (lastClickedStudentId) {
        const s = students.find(x => x.id === lastClickedStudentId);
        if (s) setSelectedStudent({ ...s, isGroupLeader: groupLeaderRecords.some(r => r.studentId === s.id && r.endDate === null) });
    } else setSelectedStudent(null);
  }, [lastClickedStudentId, students, groupLeaderRecords]);

  useEffect(() => {
    if (currentRoute) {
        getGroupLeaderRecords(currentRoute.id).then(setGroupLeaderRecords).catch(() => setGroupLeaderRecords([]));
    } else { setGroupLeaderRecords([]); }
  }, [currentRoute]);

  useEffect(() => {
    if (currentRoute) saveGroupLeaderRecords(currentRoute.id, groupLeaderRecords).catch(console.error);
  }, [groupLeaderRecords, currentRoute]);

  const studentsOnCurrentRoute = useMemo(() => {
      if (!currentRoute) return [];
      const sIds = new Set<string>(); currentRoute.seating.forEach(s => { if(s.studentId) sIds.add(s.studentId); });
      return Array.from(sIds).map(id => students.find(x => x.id === id)).filter((x): x is Student => !!x).sort((a,b) => {
          const p = (id: string) => (boardedStudentIds.includes(id) || notBoardingStudentIds.includes(id)) ? 2 : 1;
          if (p(a.id) !== p(b.id)) return p(a.id) - p(b.id);
          if (getGradeValue(a.grade) !== getGradeValue(b.grade)) return getGradeValue(a.grade) - getGradeValue(b.grade);
          if (a.class !== b.class) return a.class.localeCompare(b.class, undefined, { numeric: true });
          return a.name.localeCompare(b.name, 'ko');
      });
  }, [currentRoute, students, boardedStudentIds, notBoardingStudentIds]);

  const handleSeatClick = (sn: number, sid: string | null) => {
    if (!sid || !currentRoute) { setLastClickedStudentId(null); setSelectedStudent(null); return; }
    const isB = boardedStudentIds.includes(sid), isD = disembarkedStudentIds.includes(sid);
    let newB = [...boardedStudentIds], newD = [...disembarkedStudentIds], newNB = notBoardingStudentIds.filter(id => id !== sid);
    if (isD) newD = newD.filter(id => id !== sid);
    else if (isB) { newB = newB.filter(id => id !== sid); newD.push(sid); }
    else newB.push(sid);
    updateAttendance(currentRoute.id, selectedDate, { boarded: newB, notBoarding: newNB, disembarked: newD, completedDestinations }).then(() => setLastClickedStudentId(sid)).catch(() => toast({ title: t("error"), variant: "destructive" }));
  };

  const handleToggleDeparture = async () => { if (selectedBus) await updateBus(selectedBus.id, { status: selectedBus.status === 'departed' ? 'ready' : 'departed', departureTime: selectedBus.status === 'departed' ? null : new Date().toISOString() }); };

  const formatStudentName = (s: Student) => `${s.grade.toUpperCase()}${s.class} ${s.name}`;

  const headerContent = (
    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1 min-w-[120px]"><Label className="text-xs">{t('bus')}</Label><Select value={selectedBusId} onValueChange={setSelectedBusId} disabled={loading}><SelectTrigger><SelectValue placeholder={t('teacher_page.select_bus')} /></SelectTrigger><SelectContent><SelectItem value="all">{t('teacher_page.all_buses')}</SelectItem>{filteredBuses.map(b => <SelectItem key={b.id} value={b.id}>{b.name} ({t(`bus_type.${b.capacity}`)})</SelectItem>)}</SelectContent></Select></div>
        <div className="flex-1 min-w-[120px]"><Label className="text-xs">{t('day')}</Label><Select value={selectedDay} onValueChange={(v: DayOfWeek) => { const today = new Date(), diff = (DAYS.indexOf(v) + 1) - (today.getDay() || 7); const target = new Date(today); target.setDate(today.getDate() + diff); setSelectedDate(format(target, 'yyyy-MM-dd')); }}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{t(`day.${d.toLowerCase()}`)}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex-1 min-w-[180px]"><Label className="text-xs">{t('route')}</Label><Tabs value={selectedRouteType} onValueChange={(v: any) => setSelectedRouteType(v)} className="w-full"><TabsList className="grid w-full grid-cols-3"><TabsTrigger value="Morning">{t('route_type.morning')}</TabsTrigger><TabsTrigger value="Afternoon">{t('route_type.afternoon')}</TabsTrigger><TabsTrigger value="AfterSchool">{t('route_type.AfterSchool')}</TabsTrigger></TabsList></Tabs></div>
    </div>
  );

  if (loading) return <MainLayout headerContent={headerContent}><div className="flex justify-center items-center h-64"><p>{t('loading.data')}</p></div></MainLayout>;

  return (
    <MainLayout headerContent={headerContent} titleActions={<div className="flex gap-2 no-print">
        <Dialog><DialogTrigger asChild><Button variant="outline" size="sm" className="h-8"><Download className="mr-2 h-4 w-4" /><span className="hidden sm:inline">{t('teacher_page.download_class_list_button')}</span></Button></DialogTrigger><ClassListDownloadDialog students={students} allRoutes={allRoutes} buses={buses} destinations={destinations} t={t}/></Dialog>
        <Dialog><DialogTrigger asChild><Button variant="outline" size="sm" className="h-8"><Users className="mr-2 h-4 w-4" /><span className="hidden sm:inline">{t('teacher_page.check_assignments_button')}</span></Button></DialogTrigger><TeacherAssignmentViewDialog buses={buses} allRoutes={allRoutes} teachers={teachers} afterSchoolTeachers={afterSchoolTeachers} selectedDay={selectedDay} selectedRouteType={selectedRouteType} t={t}/></Dialog>
    </div>}>
        {selectedBusId === 'all' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full"><AllStudentsBoardingStatus relevantRoutes={relevantRoutesForDay} students={students} buses={buses} allAttendance={allAttendance} formatStudentName={formatStudentName} t={t}/><AllGroupLeadersStatus relevantRoutes={relevantRoutesForDay} students={students} buses={buses} formatStudentName={formatStudentName} t={t}/></div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <Card id="printable-seat-map"><CardHeader><div className="flex justify-between items-start"><div><CardTitle>{t('teacher_page.seat_map_title')}</CardTitle><CardDescription>{t('teacher_page.seat_map_description')}</CardDescription></div><Button variant="outline" size="sm" onClick={() => window.print()} className="no-print"><Printer className="mr-2 h-4 w-4"/>{t('print')}</Button></div></CardHeader><CardContent>{selectedBus && currentRoute ? <BusSeatMap bus={selectedBus} seating={currentRoute.seating} students={students} destinations={destinations} onSeatClick={handleSeatClick} boardedStudentIds={boardedStudentIds} notBoardingStudentIds={notBoardingStudentIds} routeType={selectedRouteType} dayOfWeek={selectedDay} groupLeaderRecords={groupLeaderRecords}/> : <div className="text-center py-10 text-muted-foreground">{t('teacher_page.no_route_info')}</div>}</CardContent></Card>
                    <div className="lg:hidden"><GroupLeaderManager records={groupLeaderRecords.map(r => ({ ...r, name: students.find(s => s.id === r.studentId) ? formatStudentName(students.find(s => s.id === r.studentId)!) : (r.name || "알 수 없음") }))} setRecords={setGroupLeaderRecords}/></div>
                    <div className="lg:hidden"><LostAndFound lostItems={lostItems} setLostItems={setLostItems} buses={buses}/></div>
                </div>
                <div className="flex flex-col gap-6 no-print">
                    <Card><CardHeader><CardTitle>{t('teacher_page.boarding_list_title')}</CardTitle></CardHeader><CardContent className='max-h-[60vh] overflow-y-auto'><Table><TableBody>{studentsOnCurrentRoute.map(s => (
                        <TableRow key={s.id} onClick={() => setLastClickedStudentId(s.id)} className="cursor-pointer hover:bg-accent/50"><TableCell className="whitespace-nowrap">{formatStudentName(s)} {groupLeaderRecords.some(r => r.studentId === s.id && r.endDate === null) && "👑"}</TableCell><TableCell><Badge variant={boardedStudentIds.includes(s.id) ? 'default' : (notBoardingStudentIds.includes(s.id) ? 'destructive' : 'secondary')}>{t(`teacher_page.status_${boardedStudentIds.includes(s.id) ? 'boarded' : (notBoardingStudentIds.includes(s.id) ? 'not_riding_today' : 'not_boarded')}`)}</Badge></TableCell></TableRow>
                    ))}</TableBody></Table></CardContent><CardFooter>{selectedBus && <Button onClick={handleToggleDeparture} variant={selectedBus.status === 'departed' ? 'destructive' : 'default'} className="w-full">{selectedBus.status === 'departed' ? "출발 취소" : "버스 출발"}</Button>}</CardFooter></Card>
                    <GroupLeaderManager records={groupLeaderRecords.map(r => ({ ...r, name: students.find(s => s.id === r.studentId) ? formatStudentName(students.find(s => s.id === r.studentId)!) : (r.name || "알 수 없음") }))} setRecords={setGroupLeaderRecords}/>
                    <LostAndFound lostItems={lostItems} setLostItems={setLostItems} buses={buses}/>
                </div>
            </div>
        )}
    </MainLayout>
  );
}