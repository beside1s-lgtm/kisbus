'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
    onBusesUpdate,
    onStudentsUpdate,
    onRoutesUpdate,
    onDestinationsUpdate,
    onTeachersUpdate,
    onAfterSchoolTeachersUpdate,
    onSaturdayTeachersUpdate,
    onAfterSchoolClassesUpdate,
    onLostItemsUpdate,
    getGroupLeaderRecords, 
    saveGroupLeaderRecords,
    updateAttendance,
    onAttendanceUpdate,
    updateBus,
    updateRouteSeating,
    getAfterSchoolClasses
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, GroupLeaderRecord, Teacher, LostItem, AttendanceRecord, AfterSchoolClass } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Users, Printer, UserX, AlertCircle, Search, GraduationCap, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

import { GroupLeaderManager } from './components/group-leader-manager';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { MainLayout } from '@/components/layout/main-layout';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, differenceInDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LostAndFound } from './components/lost-and-found';
import { AfterSchoolInquiryDialog } from './components/after-school-inquiry-dialog';
import { useTranslation } from '@/hooks/use-translation';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { cn, normalizeString, getStudentName } from '@/lib/utils';

const DAYS: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const sortBuses = (buses: Bus[]): Bus[] => {
  return [...buses].sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.name.localeCompare(b.name, 'ko');
  });
};

const getGradeValue = (grade: string): number => {
  const upperGrade = (grade || '').trim().toUpperCase();
  if (upperGrade === 'S') return -50; 
  if (upperGrade.startsWith('S')) {
      const num = parseInt(upperGrade.replace('S', ''), 10);
      return isNaN(num) ? -50 : -50 + (num / 100);
  }
  if (upperGrade.startsWith('K')) {
      const num = parseInt(upperGrade.replace('K', ''), 10);
      return isNaN(num) ? -100 : -100 + num;
  }
  const num = parseInt(upperGrade.replace(/\D/g, ''), 10);
  return isNaN(num) ? 999 : num;
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
            const priority = (s: string) => {
                if (s === 'not_boarded') return 1;
                if (s === 'notRiding') return 2;
                if (s === 'boarded') return 3;
                if (s === 'disembarked') return 4;
                return 5;
            };
            if (priority(a.status) !== priority(b.status)) return priority(a.status) - priority(b.status);
            const busCmp = a.busName.localeCompare(b.busName, undefined, { numeric: true });
            if (busCmp !== 0) return busCmp;
            if (getGradeValue(a.grade) !== getGradeValue(b.grade)) return getGradeValue(a.grade) - getGradeValue(b.grade);
            if (a.class !== b.class) return a.class.localeCompare(b.class, undefined, { numeric: true });
            return getStudentName(a, t.language).localeCompare(getStudentName(b, t.language), 'ko');
        });
    }, [relevantRoutes, students, buses, allAttendance]);

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
                        {allStudentsOnDay.map(s => (
                            <TableRow key={s.id}>
                                <TableCell className="whitespace-nowrap font-medium text-xs">{formatStudentName(s)}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{s.busName}</TableCell>
                                <TableCell className="whitespace-nowrap">
                                    <Badge variant={s.status === 'boarded' ? 'default' : (s.status === 'notRiding' ? 'destructive' : (s.status === 'disembarked' ? 'outline' : 'secondary'))} className="text-[10px] sm:text-xs py-0 h-5 whitespace-nowrap">{t(`teacher_page.status_${s.status}`)}</Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
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
                    const minDate = Math.min(...active.map(l => new Date(l.startDate).getTime()));
                    const days = differenceInDays(new Date(), new Date(minDate)) + 1;
                    results[r.id] = { names: active.map(l => {
                        const student = students.find(s => s.id === l.studentId);
                        return student ? formatStudentName(student) : (l.name || "알 수 없음");
                    }), days };
                } else results[r.id] = null;
            }));
            setLeadersMap(results);
        };
        if (relevantRoutes.length > 0) fetchAll();
    }, [relevantRoutes, students, formatStudentName, t]);

    const sorted = useMemo(() => relevantRoutes.map(r => ({ 
        routeId: r.id, 
        busName: buses.find(b => b.id === r.busId)?.name || '?', 
        leaderNames: leadersMap[r.id]?.names || [t('unassigned')], 
        days: leadersMap[r.id]?.days || 0 
    })).sort((a,b) => { 
        const numA = parseInt(a.busName.replace(/\D/g, ''), 10); 
        const numB = parseInt(b.busName.replace(/\D/g, ''), 10); 
        return (!isNaN(numA) && !isNaN(numB)) ? numA - numB : a.busName.localeCompare(b.busName); 
    }), [relevantRoutes, buses, leadersMap, t]);

    const handleExportExcel = () => {
        // 배정된 조장들만 평탄화하여 추출
        const allLeaders = sorted.flatMap(item => 
            item.leaderNames
                .filter(name => name && name !== t('unassigned'))
                .map(name => ({ 
                    name, 
                    busName: item.busName 
                }))
        );

        const COL_SIZE = 25; // 이미지 양식처럼 한 열에 25명씩 배치
        const displayRowCount = Math.max(COL_SIZE, Math.ceil(allLeaders.length / 2));
        
        const year = format(new Date(), 'yyyy');
        const month = parseInt(format(new Date(), 'M'), 10);
        const semester = (month >= 1 && month <= 7) ? '1' : '2';
        
        const aoa: any[][] = [
            ['', '', `${year}학년도 ${semester}학기 학생 차량 안전 도우미(차장) 명단`, '', '', ''],
            ['', '', '', '', '', ''],
            ['', '', '', '', '', '호치민시한국국제학교'],
            ['', '', '', '', '', '자 치 생 활 부'],
            ['순', '차장', '비고', '순', '차장', '비고']
        ];
        
        // 데이터 행 생성
        for (let i = 0; i < displayRowCount; i++) {
            const leftIdx = i;
            const rightIdx = i + displayRowCount;
            
            const left = allLeaders[leftIdx];
            const right = allLeaders[rightIdx];
            
            const row = [
                leftIdx + 1, 
                left ? left.name : '', 
                left ? left.busName : '', // 비고란에 버스 번호 기입
                rightIdx + 1, 
                right ? right.name : '', 
                right ? right.busName : ''
            ];
            aoa.push(row);
        }
        
        // 하단 비고 추가
        aoa.push(['*특이사항 없는 차장의 경우 8시간 봉사 시간(영역: 이웃돕기활동) 부여', '', '', '', '', '']);
        
        const worksheet = XLSX.utils.aoa_to_sheet(aoa);
        
        // 셀 병합 설정
        worksheet['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // 제목
            { s: { r: aoa.length - 1, c: 0 }, e: { r: aoa.length - 1, c: 5 } } // 하단 안내문
        ];
        
        // 열 너비 설정
        worksheet['!cols'] = [
            { wch: 6 }, { wch: 22 }, { wch: 15 },
            { wch: 6 }, { wch: 22 }, { wch: 15 }
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "조장명단");
        
        const fileName = `KIS_Group_Leaders_${year}_${semester}th_${format(new Date(), 'MMdd')}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <Card className="border-none shadow-none lg:border lg:shadow-sm w-full h-full">
            <CardHeader className="px-2 py-3 sm:px-4">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-base sm:text-lg">{t('teacher_page.all_group_leaders_view.title')}</CardTitle>
                    <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-8">
                        <Download className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">{t('export')}</span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="px-1 sm:px-2 max-h-[70vh] overflow-y-auto">
                <Table className="w-full">
                    <TableHeader>
                        <TableRow>
                            <TableHead className="whitespace-nowrap w-px">{t('bus')}</TableHead>
                            <TableHead className="whitespace-nowrap">{t('teacher_page.group_leader_management.name')}</TableHead>
                            <TableHead className="whitespace-nowrap w-px">{t('teacher_page.group_leader_management.days')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sorted.map((item, idx) => (
                            <TableRow key={idx}>
                                <TableCell className="font-medium whitespace-nowrap text-xs">{item.busName}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs">
                                    <div className="flex flex-col gap-0.5">
                                        {item.leaderNames.map((n, i) => <span key={i} className="truncate max-w-[100px] sm:max-w-none">{n}</span>)}
                                    </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-xs">{item.days > 0 ? `${item.days}${t('teacher_page.group_leader_days_suffix')}` : '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

const TeacherAssignmentViewDialog = ({ buses, allRoutes, teachers, afterSchoolTeachers, saturdayTeachers, selectedDay, selectedRouteType, t }: { buses: Bus[]; allRoutes: Route[]; teachers: Teacher[]; afterSchoolTeachers: Teacher[]; saturdayTeachers: Teacher[]; selectedDay: DayOfWeek; selectedRouteType: RouteType; t: any; }) => {
    const getNames = (bid: string) => {
        const r = allRoutes.find(x => x.busId === bid && x.dayOfWeek === selectedDay && x.type === selectedRouteType);
        if (!r?.teacherIds?.length) return t('unassigned');
        const pool = selectedDay === 'Saturday' ? saturdayTeachers : (selectedRouteType === 'AfterSchool' ? afterSchoolTeachers : teachers);
        return r.teacherIds.map(id => pool.find(x => x.id === id)?.name).filter(Boolean).join(', ') || t('unassigned');
    };
    
    return (
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{t('teacher_page.assignments_dialog.title')}</DialogTitle>
                <DialogDescription>
                    {t('teacher_page.assignments_dialog.description')}<br/>
                    {t('day')}: {t(`day.${selectedDay.toLowerCase()}`)} | {t('route')}: {selectedRouteType === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${selectedRouteType.toLowerCase()}`)}
                </DialogDescription>
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
                        {sortBuses([...buses]).map((b: Bus) => (
                            <TableRow key={b.id} className={cn(!(b.isActive ?? true) && "opacity-50 bg-muted/20")}>
                                <TableCell className="font-medium whitespace-nowrap">{b.name}</TableCell>
                                <TableCell className="whitespace-nowrap">{t(`bus_type.${b.type}`)}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {getNames(b.id).split(', ').map((n: string, i: number) => 
                                            n === t('unassigned') ? 
                                            <span key={i} className="text-muted-foreground italic text-xs">{n}</span> : 
                                            <Badge key={i} variant="secondary" className="font-normal text-xs py-0 h-5 whitespace-nowrap">{n}</Badge>
                                        )}
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
  const { t, i18n } = useTranslation();
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [afterSchoolTeachers, setAfterSchoolTeachers] = useState<Teacher[]>([]);
  const [saturdayTeachers, setSaturdayTeachers] = useState<Teacher[]>([]);
  const [afterSchoolClasses, setAfterSchoolClasses] = useState<AfterSchoolClass[]>([]);
  const [lostItems, setLostItems] = useState<LostItem[]>([]);

  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [allAttendance, setAllAttendance] = useState<Record<string, AttendanceRecord | null>>({});
  const [selectedStudent, setSelectedStudent] = useState<Student & { isGroupLeader?: boolean } | null>(null);
  const [groupLeaderRecords, setGroupLeaderRecords] = useState<GroupLeaderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [lastClickedStudentId, setLastClickedStudentId] = useState<string | null>(null);
  const [swapSourceSeat, setSwapSourceSeat] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const calculateDate = () => {
        const now = new Date();
        const vTime = new Date(now.getTime() + (now.getTimezoneOffset() + 420) * 60000);
        const h = vTime.getHours(), d = vTime.getDay();
        let tDate = new Date(vTime);
        
        if (d >= 1 && d <= 5 && h >= 19) tDate.setDate(tDate.getDate() + 1);
        else if (d === 6 && h >= 14) tDate.setDate(tDate.getDate() + 2);
        else if (d === 0) tDate.setDate(tDate.getDate() + 1);
        
        const newDate = format(tDate, 'yyyy-MM-dd');
        setSelectedDate(prev => prev !== newDate ? newDate : prev);
    };
    
    calculateDate();
    const intervalId = setInterval(calculateDate, 60000);
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') calculateDate(); };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    onBusesUpdate(data => setBuses(sortBuses(data))); 
    onStudentsUpdate(setStudents); 
    onRoutesUpdate(setAllRoutes); 
    onDestinationsUpdate(setDestinations); 
    onTeachersUpdate(setTeachers); 
    onAfterSchoolTeachersUpdate(setAfterSchoolTeachers); 
    onSaturdayTeachersUpdate(setSaturdayTeachers);
    onAfterSchoolClassesUpdate(setAfterSchoolClasses);
    onLostItemsUpdate(setLostItems);
    setLoading(false);

    return () => {
        clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (selectedDate) {
        const targetDate = new Date(selectedDate), dayIdx = targetDate.getDay();
        setSelectedDay(dayIdx === 0 ? 'Monday' : DAYS[dayIdx - 1]);
        const isToday = format(targetDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
        if (isToday) {
            const vTime = new Date(new Date().getTime() + (new Date().getTimezoneOffset() + 420) * 60000);
            const vh = vTime.getHours();
            if (dayIdx === 6) {
                if (vh < 9) setSelectedRouteType('Morning');
                else if (vh < 14) setSelectedRouteType('Afternoon');
                else setSelectedRouteType('Morning'); // Will be Monday morning due to date shift logic
            }
            else setSelectedRouteType(vh < 9 ? 'Morning' : (vh < 16 ? 'Afternoon' : 'AfterSchool'));
        }
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const q = normalizeString(searchQuery);
    
    const scored = students.map(student => {
      const grade = (student.grade || '').toLowerCase();
      const cls = (student.class || '').toLowerCase();
      // 학년+반 조합 (예: "14" → 1학년 4반, "s14" → S1학년 4반)
      const gradeClass = normalizeString(grade + cls);
      const contact = student.contact?.replace(/\D/g, '') || '';
      
      let score = 0;
      // 학년+반 검색: 정확히 일치 시 최우선
      if (gradeClass === q) score += 2000;
      else if (gradeClass.startsWith(q)) score += 1500;
      // 이름 검색
      const displayName = normalizeString(getStudentName(student, i18n.language));
      if (displayName.startsWith(q)) score += 500;
      else if (displayName.includes(q)) score += 300;
      else if (student.nameKo && normalizeString(student.nameKo).includes(q)) score += 200;
      else if (student.nameEn && normalizeString(student.nameEn).toLowerCase().includes(q)) score += 200;
      // 연락처 검색
      if (contact.startsWith(q)) score += 100;
      else if (contact.includes(q)) score += 50;
      
      return { student, score };
    });

    const results = scored
      .filter(item => item.score > 0)
      .sort((a, b) => {
        const ga = getGradeValue(a.student.grade), gb = getGradeValue(b.student.grade);
        if (ga !== gb) return ga - gb;
        const ca = a.student.class.localeCompare(b.student.class, undefined, { numeric: true });
        if (ca !== 0) return ca;
        return getStudentName(a.student, i18n.language).localeCompare(getStudentName(b.student, i18n.language), 'ko');
      })
      .map(item => item.student);

    setSearchResults(results.slice(0, 15));
  }, [searchQuery, students, i18n.language]);

  const handleSelectStudentFromSearch = (s: Student) => {
    const route = allRoutes.find(r => 
      r.dayOfWeek === selectedDay && 
      r.type === selectedRouteType && 
      r.seating.some(seat => seat.studentId === s.id)
    );

    if (route) {
      setSelectedBusId(route.busId);
      setLastClickedStudentId(s.id);
    } else {
      // 선택된 요일/노선에 없는 경우 요일을 변경하지 않고 현재 상태에서 안내만 표시
      const anyRoute = allRoutes.find(r => r.seating.some(seat => seat.studentId === s.id));
      if (anyRoute) {
          toast({ 
            title: t('notice'), 
            description: `이 학생은 현재 선택된 ${t(`day.${selectedDay.toLowerCase()}`)} ${t(`route_type.${selectedRouteType.toLowerCase()}`)} 노선에 배정되어 있지 않습니다.` 
          });
          // 요일/노선은 변경하지 않고 학생 정보만 조회하도록 클릭 ID 설정
          setLastClickedStudentId(s.id);
      } else {
          toast({ title: t('notice'), description: "이 학생은 현재 어떤 노선에도 배정되어 있지 않습니다." });
          setLastClickedStudentId(s.id);
      }
    }
    setSearchQuery('');
    setSearchResults([]);
    
    setTimeout(() => {
      const el = document.getElementById('student-info-card');
      if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 300);
  };

  const currentRoute = useMemo(() => 
    selectedBusId === 'all' ? null : allRoutes.find(r => r.busId === selectedBusId && r.dayOfWeek === selectedDay && r.type === selectedRouteType), 
  [allRoutes, selectedBusId, selectedDay, selectedRouteType]);
  
  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
  
  const filteredBuses = useMemo(() => sortBuses(buses.filter(b => 
    (b.isActive !== false) && allRoutes.some(r => r.busId === b.id && r.dayOfWeek === selectedDay && r.type === selectedRouteType && r.stops?.length > 0 && r.seating.some(s => s.studentId !== null))
  )), [buses, allRoutes, selectedDay, selectedRouteType]);
  
  const relevantRoutesForDay = useMemo(() => { 
    const activeIds = new Set(filteredBuses.map(b => b.id)); 
    return allRoutes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType && activeIds.has(r.busId)); 
  }, [allRoutes, selectedDay, selectedRouteType, filteredBuses]);

  useEffect(() => { 
    if (currentRoute) return onAttendanceUpdate(currentRoute.id, selectedDate, setAttendance); 
    else setAttendance(null); 
  }, [currentRoute, selectedDate]);

  useEffect(() => {
    if (selectedBusId !== 'all') { setAllAttendance({}); return; }
    const unsubs = relevantRoutesForDay.map(r => onAttendanceUpdate(r.id, selectedDate, (rec) => setAllAttendance(prev => ({ ...prev, [r.id]: rec }))));
    return () => unsubs.forEach(u => u());
  }, [selectedBusId, relevantRoutesForDay, selectedDate]);

  const boardedStudentIds = attendance?.boarded || [], 
        notBoardingStudentIds = attendance?.notBoarding || [], 
        disembarkedStudentIds = attendance?.disembarked || [], 
        completedDestinations = attendance?.completedDestinations || [];

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

  const toggleGroupLeader = useCallback(() => {
    if (!selectedStudent || !currentRoute) return;
    const activeLeaders = groupLeaderRecords.filter(r => r.endDate === null);
    const isCurrentlyLeader = activeLeaders.some(r => r.studentId === selectedStudent.id);
    let newRecords = [...groupLeaderRecords];
    if (isCurrentlyLeader) {
        newRecords = newRecords.map(r => (r.studentId === selectedStudent.id && r.endDate === null) ? { ...r, endDate: format(new Date(), 'yyyy-MM-dd') } : r);
        toast({ title: t('teacher_page.demote_leader'), description: `${getStudentName(selectedStudent, i18n.language)} 학생이 조장에서 해제되었습니다.` });
    } else {
        if (activeLeaders.length >= 3) { toast({ title: t('error'), description: "동시에 활동 가능한 조장은 최대 3명입니다.", variant: 'destructive' }); return; }
        newRecords.push({ studentId: selectedStudent.id, name: `${selectedStudent.grade.toUpperCase()}${selectedStudent.class} ${getStudentName(selectedStudent, i18n.language)}`, startDate: format(new Date(), 'yyyy-MM-dd'), endDate: null, days: 1 });
        toast({ title: t('teacher_page.promote_leader'), description: `${getStudentName(selectedStudent, i18n.language)} 학생이 조장으로 임명되었습니다.` });
    }
    setGroupLeaderRecords(newRecords);
    saveGroupLeaderRecords(currentRoute.id, newRecords).catch(console.error);
  }, [selectedStudent, currentRoute, groupLeaderRecords, t, toast]);

  const toggleStudentAttendance = useCallback(async (sid: string) => {
    if (!currentRoute) return;
    const isB = boardedStudentIds.includes(sid), isD = disembarkedStudentIds.includes(sid);
    let newB = [...boardedStudentIds], newD = [...disembarkedStudentIds], newNB = notBoardingStudentIds.filter(id => id !== sid);
    if (isD) newD = newD.filter(id => id !== sid);
    else if (isB) { newB = newB.filter(id => id !== sid); newD.push(sid); }
    else newB.push(sid);
    await updateAttendance(currentRoute.id, selectedDate, { boarded: newB, notBoarding: newNB, disembarked: newD, completedDestinations }).then(() => setLastClickedStudentId(sid)).catch(() => toast({ title: t("error"), variant: "destructive" }));
  }, [currentRoute, boardedStudentIds, disembarkedStudentIds, notBoardingStudentIds, completedDestinations, selectedDate, t, toast]);

  const handleMarkNotBoarding = useCallback(async () => {
    if (!selectedStudent || !currentRoute) return;
    const newNB = [...new Set([...notBoardingStudentIds, selectedStudent.id])];
    const newB = boardedStudentIds.filter(id => id !== selectedStudent.id);
    const newD = disembarkedStudentIds.filter(id => id !== selectedStudent.id);
    await updateAttendance(currentRoute.id, selectedDate, { boarded: newB, notBoarding: newNB, disembarked: newD, completedDestinations });
    toast({ title: t('teacher_page.not_boarding_updated') });
  }, [selectedStudent, currentRoute, notBoardingStudentIds, boardedStudentIds, disembarkedStudentIds, completedDestinations, selectedDate, t, toast]);

  const studentsOnCurrentRoute = useMemo(() => {
      if (!currentRoute) return [];
      const sIds = new Set<string>(); 
      currentRoute.seating.forEach(s => { if(s.studentId) sIds.add(s.studentId); });
      return Array.from(sIds).map(id => students.find(x => x.id === id)).filter((x): x is Student => !!x).sort((a,b) => {
          const p = (id: string) => (boardedStudentIds.includes(id) || notBoardingStudentIds.includes(id) || disembarkedStudentIds.includes(id)) ? 2 : 1;
          if (p(a.id) !== p(b.id)) return p(a.id) - p(b.id);
          if (getGradeValue(a.grade) !== getGradeValue(b.grade)) return getGradeValue(a.grade) - getGradeValue(b.grade);
          if (a.class !== b.class) return a.class.localeCompare(b.class, undefined, { numeric: true });
          return getStudentName(a, i18n.language).localeCompare(getStudentName(b, i18n.language), 'ko');
      });
  }, [currentRoute, students, boardedStudentIds, notBoardingStudentIds, disembarkedStudentIds]);

  const handleSeatClick = (sn: number, sid: string | null) => {
    setSwapSourceSeat(null);
    if (!sid) { setLastClickedStudentId(null); setSelectedStudent(null); return; }
    toggleStudentAttendance(sid);
  };

  const handleSeatContextMenu = (e: React.MouseEvent, seatNumber: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentRoute) return;
    if (swapSourceSeat === null) {
      setSwapSourceSeat(seatNumber);
      toast({ title: t('teacher_page.seat_selected'), description: "다른 좌석을 우클릭하면 교체되고, 같은 좌석을 다시 우클릭하면 선택이 취소됩니다." });
    } else {
      if (swapSourceSeat === seatNumber) {
        // User wants to deselect on right click of the same seat or empty space
        setSwapSourceSeat(null);
        return;
      }
      const newSeating = [...currentRoute.seating];
      if (!newSeating.some(s => s.seatNumber === swapSourceSeat)) newSeating.push({ seatNumber: swapSourceSeat, studentId: null });
      if (!newSeating.some(s => s.seatNumber === seatNumber)) newSeating.push({ seatNumber, studentId: null });
      const sourceIdx = newSeating.findIndex(s => s.seatNumber === swapSourceSeat);
      const targetIdx = newSeating.findIndex(s => s.seatNumber === seatNumber);
      if (sourceIdx > -1 && targetIdx > -1) {
        const tempStudentId = newSeating[sourceIdx].studentId;
        newSeating[sourceIdx].studentId = newSeating[targetIdx].studentId;
        newSeating[targetIdx].studentId = tempStudentId;
        updateRouteSeating(currentRoute.id, newSeating).then(() => { toast({ title: t('teacher_page.swap_success') }); setSwapSourceSeat(null); }).catch(() => { toast({ title: t('teacher_page.swap_error'), variant: 'destructive' }); });
      }
    }
  };

  const handleToggleDeparture = async () => { 
    if (selectedBus) await updateBus(selectedBus.id, { status: selectedBus.status === 'departed' ? 'ready' : 'departed', departureTime: selectedBus.status === 'departed' ? null : new Date().toISOString() }); 
  };

  const formatStudentName = (s: Student) => `${s.grade.toUpperCase()}${s.class} ${getStudentName(s, i18n.language)}`;

  const headerContent = (
    <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1 min-w-[120px]">
            <Label className="text-xs">{t('bus')}</Label>
            <Select value={selectedBusId} onValueChange={setSelectedBusId} disabled={loading}>
                <SelectTrigger><SelectValue placeholder={t('teacher_page.select_bus')} /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">{t('teacher_page.all_buses')}</SelectItem>
                    {filteredBuses.map(b => <SelectItem key={b.id} value={b.id}>{b.name} ({t(`bus_type.${b.capacity}`)})</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
        <div className="flex-1 min-w-[200px] relative">
            <Label htmlFor="student-search" className="text-xs">{t('student.name')}</Label>
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input id="student-search" type="search" placeholder={t('teacher_page.search_student_placeholder')} className="pl-8 w-full" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            {searchResults.length > 0 && (
                <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto shadow-lg">
                    <CardContent className="p-2">
                        {searchResults.map(student => (
                            <div key={student.id} className="p-2 text-sm hover:bg-accent rounded-md cursor-pointer flex justify-between items-center" onClick={() => handleSelectStudentFromSearch(student)}>
                                <span>{formatStudentName(student)}</span>
                                {student.contact && <span className="text-[10px] text-muted-foreground">{student.contact}</span>}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>
        <div className="flex-1 min-w-[120px]">
            <Label className="text-xs">{t('day')}</Label>
            <Select value={selectedDay} onValueChange={(v: DayOfWeek) => { 
                const today = new Date(), currentDayIdx = (today.getDay() + 6) % 7, targetDayIdx = DAYS.indexOf(v), diff = targetDayIdx - currentDayIdx, target = new Date(today);
                target.setDate(today.getDate() + diff); setSelectedDate(format(target, 'yyyy-MM-dd')); 
            }}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{t(`day.${d.toLowerCase()}`)}</SelectItem>)}</SelectContent>
            </Select>
        </div>
        <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">{t('route')}</Label>
            <Tabs value={selectedRouteType} onValueChange={(v: any) => setSelectedRouteType(v)} className="w-full">
                <TabsList className={cn("grid w-full", selectedDay === 'Saturday' ? "grid-cols-2" : "grid-cols-3")}>
                    <TabsTrigger value="Morning">{t('route_type.morning')}</TabsTrigger>
                    <TabsTrigger value="Afternoon">{t('route_type.afternoon')}</TabsTrigger>
                    {selectedDay !== 'Saturday' && <TabsTrigger value="AfterSchool">{t('route_type.AfterSchool')}</TabsTrigger>}
                </TabsList>
            </Tabs>
        </div>
    </div>
  );

  if (loading) {
    return (
      <MainLayout headerContent={headerContent}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌석 목록 Skeleton */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32 rounded" />
              </CardHeader>
              <CardContent className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                ))}
              </CardContent>
            </Card>
            {/* 좌석 배치도 Skeleton */}
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-24 rounded" />
                <Skeleton className="h-3 w-40 rounded mt-1" />
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {[...Array(45)].map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          {/* 사이드 패널 Skeleton */}
          <div className="hidden lg:flex flex-col gap-6">
            <Card>
              <CardHeader><Skeleton className="h-5 w-24 rounded" /></CardHeader>
              <CardContent className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  const titleActions = (
    <div className="flex gap-2 no-print">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <GraduationCap className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">방과후 명단</span>
          </Button>
        </DialogTrigger>
        <AfterSchoolInquiryDialog
          afterSchoolClasses={afterSchoolClasses}
          afterSchoolTeachers={afterSchoolTeachers}
          students={students}
          buses={buses}
          routes={allRoutes}
          destinations={destinations}
        />
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Users className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">{t('teacher_page.check_assignments_button')}</span>
          </Button>
        </DialogTrigger>
        <TeacherAssignmentViewDialog 
          buses={buses} 
          allRoutes={allRoutes} 
          teachers={teachers} 
          afterSchoolTeachers={afterSchoolTeachers} 
          saturdayTeachers={saturdayTeachers}
          selectedDay={selectedDay} 
          selectedRouteType={selectedRouteType} 
          t={t}
        />
      </Dialog>
    </div>
  );

  return (
    <MainLayout headerContent={headerContent} titleActions={titleActions}>
        <div onContextMenu={(e) => { e.preventDefault(); setSwapSourceSeat(null); }} className="min-h-full">
        {selectedBusId === 'all' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
                <AllStudentsBoardingStatus relevantRoutes={relevantRoutesForDay} students={students} buses={buses} allAttendance={allAttendance} formatStudentName={formatStudentName} t={t}/>
                <AllGroupLeadersStatus relevantRoutes={relevantRoutesForDay} students={students} buses={buses} formatStudentName={formatStudentName} t={t}/>
            </div>
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <Card className="no-print">
                        <CardHeader className="pb-3"><CardTitle>{t('teacher_page.boarding_list_title')}</CardTitle></CardHeader>
                        <CardContent className='max-h-[40vh] overflow-y-auto'>
                            <Table>
                                <TableBody>
                                    {studentsOnCurrentRoute.map(s => (
                                        <TableRow key={s.id} onClick={() => setLastClickedStudentId(s.id)} className={cn("cursor-pointer hover:bg-accent/50", lastClickedStudentId === s.id && "bg-accent")}>
                                            <TableCell className="px-2 py-3 whitespace-nowrap font-medium text-sm">
                                                <div className="flex flex-col">
                                                    <span className="flex items-center">
                                                        {formatStudentName(s)} 
                                                        {groupLeaderRecords.some(r => r.studentId === s.id && r.endDate === null) && <Crown className="inline-block ml-1 w-3 h-3 text-yellow-500" />}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground sm:hidden">
                                                        {destinations.find(d => d.id === (selectedDay === 'Saturday' ? (selectedRouteType === 'Morning' ? s.satMorningDestinationId : s.satAfternoonDestinationId) : (selectedRouteType === 'Morning' ? s.morningDestinationId : selectedRouteType === 'Afternoon' ? s.afternoonDestinationId : s.afterSchoolDestinations?.[selectedDay])))?.name || t('unassigned')}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="px-2 py-3 text-right">
                                                <Badge 
                                                    variant={boardedStudentIds.includes(s.id) ? 'default' : (notBoardingStudentIds.includes(s.id) ? 'destructive' : (disembarkedStudentIds.includes(s.id) ? 'outline' : 'secondary'))}
                                                    className="cursor-pointer h-7 px-2 text-[11px] sm:text-xs"
                                                    onClick={(e) => { e.stopPropagation(); toggleStudentAttendance(s.id); }}
                                                >
                                                    {t(`teacher_page.status_${boardedStudentIds.includes(s.id) ? 'boarded' : (notBoardingStudentIds.includes(s.id) ? 'not_riding_today' : (disembarkedStudentIds.includes(s.id) ? 'disembarked' : 'not_boarded'))}`)}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                        <CardFooter>
                            {selectedBus && (
                                <Button onClick={handleToggleDeparture} variant={selectedBus.status === 'departed' ? 'destructive' : 'default'} className="w-full">
                                    {selectedBus.status === 'departed' ? "출발 취소" : "버스 출발"}
                                </Button>
                            )}
                        </CardFooter>
                    </Card>

                    <Card id="printable-seat-map">
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <div><CardTitle>{t('teacher_page.seat_map_title')}</CardTitle><CardDescription>{t('teacher_page.seat_map_description')}</CardDescription></div>
                                <Button variant="outline" size="sm" onClick={() => window.print()} className="no-print"><Printer className="mr-2 h-4 w-4"/>{t('print')}</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {selectedBus && currentRoute ? (
                                <BusSeatMap bus={selectedBus} seating={currentRoute.seating} students={students} destinations={destinations} onSeatClick={handleSeatClick} onSeatContextMenu={handleSeatContextMenu} highlightedSeatNumber={swapSourceSeat || (lastClickedStudentId ? currentRoute.seating.find(s => s.studentId === lastClickedStudentId)?.seatNumber : null)} boardedStudentIds={boardedStudentIds} notBoardingStudentIds={notBoardingStudentIds} routeType={selectedRouteType} dayOfWeek={selectedDay} groupLeaderRecords={groupLeaderRecords}/>
                            ) : (
                                <div className="text-center py-10 text-muted-foreground">{t('teacher_page.no_route_info')}</div>
                            )}
                        </CardContent>
                    </Card>
                    
                    {selectedStudent && (
                        <Card id="student-info-card" className="no-print border-primary/20 bg-primary/5 animate-in fade-in slide-in-from-top-2 scroll-mt-20">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-center">
                                    <CardTitle className="text-lg">{formatStudentName(selectedStudent)}</CardTitle>
                                    <Badge variant={selectedStudent.isGroupLeader ? "default" : "secondary"}>{selectedStudent.isGroupLeader ? "활동 조장" : "일반 학생"}</Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="pb-3 space-y-2">
                                <p className="text-sm text-muted-foreground">학년/반: {selectedStudent.grade}학년 {selectedStudent.class}반</p>
                                <p className="text-sm text-muted-foreground">목적지: {destinations.find(d => d.id === (selectedDay === 'Saturday' ? (selectedRouteType === 'Morning' ? selectedStudent.satMorningDestinationId : selectedStudent.satAfternoonDestinationId) : (selectedRouteType === 'Morning' ? selectedStudent.morningDestinationId : selectedRouteType === 'Afternoon' ? selectedStudent.afternoonDestinationId : selectedStudent.afterSchoolDestinations?.[selectedDay])))?.name || t('unassigned')}</p>
                                {(() => {
                                    // afterSchoolClassIds에서 해당 요일의 수업 ID를 가져옴
                                    const classId = selectedStudent.afterSchoolClassIds?.[selectedDay];
                                    if (classId) {
                                        const afterSchoolClass = afterSchoolClasses.find(c => c.id === classId);
                                        if (afterSchoolClass) {
                                            return (
                                                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                    <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                                                    <span>방과후 ({t(`day_short.${selectedDay.toLowerCase()}`)}):</span>
                                                    <span className="font-medium text-foreground">{afterSchoolClass.name}</span>
                                                    {afterSchoolClass.teacherName && (
                                                        <span className="text-xs text-muted-foreground/70">({afterSchoolClass.teacherName})</span>
                                                    )}
                                                </p>
                                            );
                                        }
                                    }
                                    // fallback: afterSchoolDestinations 기반으로도 시도
                                    const destBasedClass = afterSchoolClasses.find(
                                        c => c.id === selectedStudent.afterSchoolDestinations?.[selectedDay] && c.dayOfWeek === selectedDay
                                    );
                                    if (destBasedClass) {
                                        return (
                                            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                                                <GraduationCap className="w-3.5 h-3.5 text-primary shrink-0" />
                                                <span>방과후 ({t(`day_short.${selectedDay.toLowerCase()}`)}):</span>
                                                <span className="font-medium text-foreground">{destBasedClass.name}</span>
                                                {destBasedClass.teacherName && (
                                                    <span className="text-xs text-muted-foreground/70">({destBasedClass.teacherName})</span>
                                                )}
                                            </p>
                                        );
                                    }
                                    return null;
                                })()}
                            </CardContent>
                            <CardFooter className="flex flex-col gap-2">
                                {(() => {
                                    const isNotBoarding = notBoardingStudentIds.includes(selectedStudent.id);
                                    return (
                                        <Button variant={isNotBoarding ? "destructive" : "outline"} size="sm" onClick={handleMarkNotBoarding} className={cn("w-full", !isNotBoarding && "text-destructive border-destructive hover:bg-destructive/10")} disabled={boardedStudentIds.includes(selectedStudent.id) || isNotBoarding}>
                                            <AlertCircle className="mr-2 h-4 w-4" /> {isNotBoarding ? "오늘 안 탐 처리됨" : t('teacher_page.mark_not_riding_today')}
                                        </Button>
                                    );
                                })()}
                                <Button variant={selectedStudent.isGroupLeader ? "destructive" : "default"} size="sm" onClick={toggleGroupLeader} className="w-full">{selectedStudent.isGroupLeader ? <><UserX className="mr-2 h-4 w-4"/> {t('teacher_page.demote_leader')}</> : <><Crown className="mr-2 h-4 w-4"/> {t('teacher_page.promote_leader')}</>}</Button>
                            </CardFooter>
                        </Card>
                    )}
                    <div className="lg:hidden"><GroupLeaderManager records={groupLeaderRecords} setRecords={(next) => { const updated = typeof next === 'function' ? next(groupLeaderRecords) : next; setGroupLeaderRecords(updated); if (currentRoute) saveGroupLeaderRecords(currentRoute.id, updated).catch(console.error); }}/></div>
                    <div className="lg:hidden"><LostAndFound lostItems={lostItems} setLostItems={setLostItems} buses={buses}/></div>
                </div>
                <div className="flex flex-col gap-6 no-print hidden lg:flex">
                    <GroupLeaderManager records={groupLeaderRecords} setRecords={(next) => { const updated = typeof next === 'function' ? next(groupLeaderRecords) : next; setGroupLeaderRecords(updated); if (currentRoute) saveGroupLeaderRecords(currentRoute.id, updated).catch(console.error); }}/>
                    <LostAndFound lostItems={lostItems} setLostItems={setLostItems} buses={buses}/>
                </div>
            </div>
        )}
        </div>
    </MainLayout>
  );
}
