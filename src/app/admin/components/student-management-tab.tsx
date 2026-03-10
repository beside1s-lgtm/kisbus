'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
    addStudent, updateStudent, deleteStudentsInBatch, updateRouteSeating,
    copySeatingPlan, unassignStudentFromAllRoutes
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, NewStudent } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shuffle, UserPlus, RotateCcw, Copy, Bell, Undo2, AlertCircle, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/use-translation';
import { writeBatch, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { normalizeString } from '@/lib/utils';

// 분리된 패널 임포트
import { StudentUnassignedPanel } from './student-unassigned-panel';
import { StudentGlobalSearchPanel } from './student-global-search-panel';

const getGradeValue = (grade: string): number => {
  const upperGrade = grade.toUpperCase();
  if (upperGrade.startsWith('K')) {
      const num = parseInt(upperGrade.replace('K', ''), 10);
      return isNaN(num) ? 0 : -100 + num;
  }
  const num = parseInt(upperGrade.replace(/\D/g, ''), 10);
  return isNaN(num) ? 999 : num;
};

const generateInitialSeating = (capacity: number): { seatNumber: number; studentId: string | null }[] => {
    return Array.from({ length: capacity }, (_, i) => ({
        seatNumber: i + 1,
        studentId: null,
    }));
};

interface StudentManagementTabProps {
    students: Student[];
    buses: Bus[];
    routes: Route[];
    destinations: Destination[];
    selectedBusId: string | null;
    selectedDay: DayOfWeek;
    selectedRouteType: RouteType;
    days: DayOfWeek[];
    selectedGlobalStudent: Student | null;
    setSelectedGlobalStudent: React.Dispatch<React.SetStateAction<Student | null>>;
}

export const StudentManagementTab = ({
    students, buses, routes, destinations, selectedBusId, selectedDay, selectedRouteType, days,
    selectedGlobalStudent, setSelectedGlobalStudent
}: StudentManagementTabProps) => {
    const { toast } = useToast();
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [isCopySeatingDialogOpen, setCopySeatingDialogOpen] = useState(false);
    const weekdays: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], []);
    const [daysToCopyTo, setDaysToCopyTo] = useState<Partial<Record<DayOfWeek, boolean>>>(() => 
        weekdays.reduce((acc, day) => ({ ...acc, [day]: true }), {})
    );
    const [routeTypesToCopyTo, setRouteTypesToCopyTo] = useState<Partial<Record<'Morning' | 'Afternoon', boolean>>>({ Morning: true, Afternoon: true });
    
    const [unassignedSearchQuery, setUnassignedSearchQuery] = useState('');
    const [filteredUnassignedStudents, setFilteredUnassignedStudents] = useState<Student[]>([]);
    
    const [selectedSeat, setSelectedSeat] = useState<{ seatNumber: number; studentId: string | null } | null>(null);
    const [unassignableStudents, setUnassignableStudents] = useState<(Student & { errorReason: string })[]>([]);

    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState<Student[]>([]);
    
    const dayOrder: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);

    const [previousSeating, setPreviousSeating] = useState<{ seatNumber: number; studentId: string | null }[] | null>(null);
    const [unassignedView, setUnassignedView] = useState<'current' | 'all'>('current');

    // 개별 학생 추가 상태
    const [isAddStudentDialogOpen, setAddStudentDialogOpen] = useState(false);
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentGrade, setNewStudentGrade] = useState('');
    const [newStudentClass, setNewStudentClass] = useState('');
    const [newStudentGender, setNewStudentGender] = useState<'Male' | 'Female'>('Male');
    const [newStudentContact, setNewStudentContact] = useState('');

    const assignedRoutesForSelectedStudent = useMemo(() => {
        if (!selectedGlobalStudent) return [];
        return routes
            .filter(route => route.seating.some(seat => seat.studentId === selectedGlobalStudent.id))
            .sort((a, b) => {
                const busA = buses.find(bus => bus.id === a.busId);
                const busB = buses.find(bus => bus.id === b.busId);
                const numA = busA ? parseInt(busA.name.replace(/\D/g, ''), 10) : Infinity;
                const numB = busB ? parseInt(busB.name.replace(/\D/g, ''), 10) : Infinity;
                if (numA !== numB) return (!isNaN(numA) ? numA : Infinity) - (!isNaN(numB) ? numB : Infinity);
                const dayIndexA = dayOrder.indexOf(a.dayOfWeek);
                const dayIndexB = dayOrder.indexOf(b.dayOfWeek);
                if (dayIndexA !== dayIndexB) return dayIndexA - dayIndexB;
                return 0;
            });
    }, [selectedGlobalStudent, routes, buses, dayOrder]);

    const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
    const currentRoute = useMemo(() => routes.find(r => r.busId === selectedBusId && r.dayOfWeek === selectedDay && r.type === selectedRouteType), [routes, selectedBusId, selectedDay, selectedRouteType]);

    // 목적지 오류로 배정 불가능한 학생 필터링
    useEffect(() => {
        if (!routes.length || !students.length) return;

        // 1. 현재 설정(요일/타입)에서 이미 배정된 학생 ID 집합
        const allAssignedIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => {
            r.seating.forEach(s => {
                if (s.studentId) allAssignedIds.add(s.studentId);
            });
        });

        // 2. 현재 설정(요일/타입)에서 운영 중인 모든 정류장 ID 집합
        const validStopIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => {
            r.stops.forEach(s => validStopIds.add(s));
        });

        const unassignables: (Student & { errorReason: string })[] = [];

        students.forEach(student => {
            // 이미 배정된 학생은 제외
            if (allAssignedIds.has(student.id)) return;

            let destId: string | null = null;
            let errorKey = '';

            if (selectedRouteType === 'Morning') {
                destId = student.morningDestinationId;
                errorKey = 'admin.student_management.unassignable.error_morning';
            } else if (selectedRouteType === 'Afternoon') {
                destId = student.afternoonDestinationId;
                errorKey = 'admin.student_management.unassignable.error_afternoon';
            } else if (selectedRouteType === 'AfterSchool') {
                destId = student.afterSchoolDestinations?.[selectedDay] || null;
                errorKey = 'admin.student_management.unassignable.error_after_school';
            }

            // 목적지가 설정되어 있는데, 현재 운영 중인 어떤 노선 정류장에도 포함되어 있지 않은 경우에만 표시
            if (destId && !validStopIds.has(destId)) {
                const destName = destinations.find(d => d.id === destId)?.name || '알 수 없음';
                const baseReason = errorKey === 'admin.student_management.unassignable.error_after_school' 
                    ? t(errorKey, { day: t(`day_short.${selectedDay.toLowerCase()}`) })
                    : t(errorKey);

                unassignables.push({ 
                    ...student, 
                    errorReason: `${baseReason} (${destName})`
                });
            }
        });

        setUnassignableStudents(unassignables);
    }, [students, routes, selectedDay, selectedRouteType, destinations, t]);

    // 방과후 학생들의 하교 버스 좌석 자동 해제 로직
    const unassignProcessingRef = useRef(false);
    useEffect(() => {
        if (!routes.length || !students.length || unassignProcessingRef.current) return;
        const processUnassignment = async () => {
            unassignProcessingRef.current = true;
            const batch = writeBatch(db);
            let updatesMade = false;
            for (const day of days) {
                const afterSchoolStudentIds = new Set<string>();
                routes.filter(r => r.dayOfWeek === day && r.type === 'AfterSchool').forEach(r => {
                    r.seating.forEach(seat => { if (seat.studentId) afterSchoolStudentIds.add(seat.studentId); });
                });
                if (afterSchoolStudentIds.size > 0) {
                    for (const route of routes.filter(r => r.dayOfWeek === day && r.type === 'Afternoon')) {
                        let seatingChanged = false;
                        const newSeating = route.seating.map(seat => {
                            if (seat.studentId && afterSchoolStudentIds.has(seat.studentId)) { seatingChanged = true; return { ...seat, studentId: null }; }
                            return seat;
                        });
                        if (seatingChanged) { batch.update(doc(db, 'routes', route.id), { seating: newSeating }); updatesMade = true; }
                    }
                }
            }
            if (updatesMade) { try { await batch.commit(); } catch (e) { console.error(e); } }
            unassignProcessingRef.current = false;
        };
        processUnassignment();
    }, [routes, students, days]);

    // 미배정 학생 목록 필터링
    useEffect(() => {
        if (selectedDay === 'Friday' && selectedRouteType === 'AfterSchool') { setFilteredUnassignedStudents([]); return; }
        
        // 현재 요일/타입에 이미 배정된 모든 학생 ID (모든 버스 합산)
        const allAssignedIdsOnCurrentConfig = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => {
            r.seating.forEach(s => { if (s.studentId) allAssignedIdsOnCurrentConfig.add(s.studentId); });
        });

        let unassigned: Student[];
        
        if (unassignedView === 'current') {
            if (!currentRoute && selectedBusId !== 'all') { setFilteredUnassignedStudents([]); return; }
            
            // 해당 요일에 방과후를 가는 학생들은 하교 명단에서 제외
            const afterSchoolIds = new Set<string>();
            if (selectedRouteType === 'Afternoon') {
                routes.filter(r => r.dayOfWeek === selectedDay && r.type === 'AfterSchool').forEach(r => {
                    r.seating.forEach(s => { if (s.studentId) afterSchoolIds.add(s.studentId); });
                });
            }

            // '현재 노선' 뷰에서 필터링 대상 정류장 ID들
            const targetStopIds = new Set<string>();
            if (selectedBusId === 'all') {
                routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => {
                    r.stops.forEach(s => targetStopIds.add(s));
                });
            } else if (currentRoute) {
                currentRoute.stops.forEach(s => targetStopIds.add(s));
            }

            unassigned = students.filter(s => {
                // 1. 이미 배정됨
                if (allAssignedIdsOnCurrentConfig.has(s.id)) return false;
                // 2. 목적지 오류 학생
                if (unassignableStudents.some(u => u.id === s.id)) return false;
                // 3. 하교 시간인데 방과후 신청함
                if (selectedRouteType === 'Afternoon' && afterSchoolIds.has(s.id)) return false;
                
                // 4. 이 버스(들)의 정류장에 목적지가 포함되는지 확인
                let destId: string | null = null;
                if (selectedRouteType === 'Morning') destId = s.morningDestinationId;
                else if (selectedRouteType === 'Afternoon') destId = s.afternoonDestinationId;
                else if (selectedRouteType === 'AfterSchool') destId = s.afterSchoolDestinations?.[selectedDay] || null;
                
                return destId && targetStopIds.has(destId);
            });
        } else {
            // 전체 뷰: 현재 설정(요일/타입)에서 어떤 버스에도 배정되지 않은 모든 학생
            unassigned = students.filter(s => !allAssignedIdsOnCurrentConfig.has(s.id));
        }
        
        if (unassignedSearchQuery) {
            const lowerQuery = normalizeString(unassignedSearchQuery);
            const queryDigits = unassignedSearchQuery.replace(/\D/g, '');
            unassigned = unassigned.filter(s => {
                const nameMatch = normalizeString(s.name).includes(lowerQuery);
                const contactMatch = queryDigits && s.contact && s.contact.includes(queryDigits);
                return nameMatch || contactMatch;
            });
        }
        setFilteredUnassignedStudents(unassigned.sort((a, b) => a.name.localeCompare(b.name, 'ko')));
    }, [students, routes, currentRoute, selectedRouteType, selectedDay, unassignedSearchQuery, unassignableStudents, unassignedView, selectedBusId]);

    useEffect(() => { setSelectedSeat(null); setPreviousSeating(null); }, [currentRoute, unassignedView, selectedBusId]);

    const handleToggleSelectAll = useCallback(() => {
        const allIds = filteredUnassignedStudents.map(s => s.id);
        setSelectedStudentIds(selectedStudentIds.size === allIds.length && allIds.length > 0 ? new Set() : new Set(allIds));
    }, [filteredUnassignedStudents, selectedStudentIds]);

    const handleToggleStudentSelection = useCallback((id: string, isChecked: boolean) => {
        const next = new Set(selectedStudentIds);
        if (isChecked) next.add(id); else next.delete(id);
        setSelectedStudentIds(next);
    }, [selectedStudentIds]);

    const handleDeleteSelectedStudents = useCallback(async () => {
        const ids = Array.from(selectedStudentIds);
        try { await deleteStudentsInBatch(ids); setSelectedStudentIds(new Set()); toast({ title: t('success') }); } catch (e) { console.error(e); }
    }, [selectedStudentIds, t, toast]);

    const handleSeatUpdate = useCallback(async (newSeating: any) => { if (currentRoute) try { await updateRouteSeating(currentRoute.id, newSeating); } catch (e) { console.error(e); } }, [currentRoute]);
    const handleUnassignStudentFromRoute = useCallback(async (rid: string, sid: string) => {
        const r = routes.find(x => x.id === rid);
        if (r) await updateRouteSeating(rid, r.seating.map(s => s.studentId === sid ? { ...s, studentId: null } : s));
    }, [routes]);

    const handleStudentCardClick = useCallback(async (sid: string) => {
        if (currentRoute && selectedSeat && !selectedSeat.studentId) {
            const next = [...currentRoute.seating];
            const idx = next.findIndex(s => s.seatNumber === selectedSeat.seatNumber);
            if (idx > -1) { next[idx].studentId = sid; await handleSeatUpdate(next); setSelectedSeat(null); }
        }
    }, [currentRoute, selectedSeat, handleSeatUpdate]);

    const handleUnassignedStudentClick = useCallback((s: Student) => setSelectedGlobalStudent(s), [setSelectedGlobalStudent]);

    const handleSeatClick = useCallback(async (num: number, sid: string | null) => {
        if (!currentRoute) return;
        const next = [...currentRoute.seating];
        if (selectedSeat) {
            if (selectedSeat.studentId) {
                const sIdx = next.findIndex(x => x.seatNumber === selectedSeat.seatNumber);
                const tIdx = next.findIndex(x => x.seatNumber === num);
                if (selectedSeat.seatNumber === num) next[sIdx].studentId = null;
                else { const temp = next[sIdx].studentId; next[sIdx].studentId = next[tIdx].studentId; next[tIdx].studentId = temp; }
                await handleSeatUpdate(next); setSelectedSeat(null);
            } else if (!sid) setSelectedSeat({ seatNumber: num, studentId: sid });
        } else setSelectedSeat({ seatNumber: num, studentId: sid });
    }, [currentRoute, selectedSeat, handleSeatUpdate]);

    const handleSeatContextMenu = (e: React.MouseEvent) => { e.preventDefault(); setSelectedSeat(null); };

    const handleResetSeating = useCallback(async () => {
        if (selectedBus && currentRoute) { setPreviousSeating(currentRoute.seating); await handleSeatUpdate(generateInitialSeating(selectedBus.capacity)); }
    }, [selectedBus, currentRoute, handleSeatUpdate]);

    const handleResetAllSeating = useCallback(async () => {
        const relevantRoutes = routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType);
        if (relevantRoutes.length === 0) return;

        const { dismiss } = toast({ title: t('processing'), description: "전체 좌석 정보 초기화 중..." });
        try {
            const batch = writeBatch(db);
            relevantRoutes.forEach(route => {
                const bus = buses.find(b => b.id === route.busId);
                if (bus) {
                    const initialSeating = generateInitialSeating(bus.capacity);
                    batch.update(doc(db, 'routes', route.id), { seating: initialSeating });
                }
            });
            await batch.commit();
            dismiss();
            toast({ title: t('success'), description: "선택한 요일/시간대의 모든 버스 좌석이 초기화되었습니다." });
        } catch (error) {
            dismiss();
            toast({ title: t('error'), description: "초기화 중 오류가 발생했습니다.", variant: "destructive" });
        }
    }, [routes, selectedDay, selectedRouteType, buses, toast, t]);

    const handleCopySeating = useCallback(async () => {
        if (!currentRoute) return;
        
        let targetRoutes: Route[] = [];
        const selectedDays = weekdays.filter(day => daysToCopyTo[day]);

        if (selectedRouteType === 'AfterSchool') {
            if (selectedDays.length === 0) {
                toast({ title: t('notice'), description: t('admin.student_management.seat.copy.no_selection_error') });
                return;
            }
            targetRoutes = routes.filter(r => 
                r.busId === currentRoute.busId && 
                selectedDays.includes(r.dayOfWeek) && 
                r.type === 'AfterSchool' && 
                r.id !== currentRoute.id
            );
        } else {
            const selectedTypes = (['Morning', 'Afternoon'] as const).filter(t => routeTypesToCopyTo[t]);
            if (selectedDays.length === 0 || selectedTypes.length === 0) {
                toast({ title: t('notice'), description: t('admin.student_management.seat.copy.no_selection_error') });
                return;
            }
            targetRoutes = routes.filter(r => 
                r.busId === currentRoute.busId && 
                selectedDays.includes(r.dayOfWeek) && 
                selectedTypes.includes(r.type as any) && 
                r.id !== currentRoute.id
            );
        }

        if (targetRoutes.length === 0) {
            toast({ title: t('notice'), description: t('admin.student_management.seat.copy.no_target_error') });
            return;
        }

        try {
            await copySeatingPlan(currentRoute.seating, targetRoutes);
            toast({ title: t('success'), description: t('admin.student_management.seat.copy.success') });
            setCopySeatingDialogOpen(false);
        } catch (error) {
            toast({ title: t('error'), description: t('admin.student_management.seat.copy.error'), variant: 'destructive' });
        }
    }, [currentRoute, routes, daysToCopyTo, routeTypesToCopyTo, weekdays, selectedRouteType, toast, t]);

    const handleToggleAllCopyToDays = useCallback((c: boolean) => setDaysToCopyTo(weekdays.reduce((a, d) => ({ ...a, [d]: c }), {})), [weekdays]);

    const handleManualAddStudent = async () => {
        if (!newStudentName || !newStudentGrade || !newStudentClass) {
            toast({ title: t('error'), description: t('admin.student_management.add_student.validation_error'), variant: 'destructive' });
            return;
        }
        try {
            await addStudent({
                name: newStudentName,
                grade: newStudentGrade,
                class: newStudentClass,
                gender: newStudentGender,
                contact: newStudentContact,
                morningDestinationId: null,
                afternoonDestinationId: null,
                afterSchoolDestinations: {},
                applicationStatus: 'reviewed'
            });
            setAddStudentDialogOpen(false);
            setNewStudentName('');
            setNewStudentGrade('');
            setNewStudentClass('');
            setNewStudentContact('');
            toast({ title: t('success'), description: t('admin.student_management.add_student.success') });
        } catch (error) {
            console.error("Error adding student manually:", error);
            toast({ title: t('error'), description: t('admin.student_management.add_student.error'), variant: 'destructive' });
        }
    };

    // 랜덤 배정 로직 (쾌적함 고려 버전)
    const randomizeSeating = useCallback(async () => {
        if (!selectedBus || !currentRoute) return;
        setPreviousSeating([...currentRoute.seating]);

        const getDest = (s: Student) => {
            if (selectedRouteType === 'Morning') return s.morningDestinationId;
            if (selectedRouteType === 'Afternoon') return s.afternoonDestinationId;
            return s.afterSchoolDestinations?.[selectedDay] || null;
        };
        
        // 배정 가능 학생 필터링
        const alreadyAssignedOnOtherBuses = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType && r.id !== currentRoute.id).forEach(r => {
            r.seating.forEach(s => { if (s.studentId) alreadyAssignedOnOtherBuses.add(s.studentId); });
        });

        const targets = students.filter(s => {
            const d = getDest(s);
            return d && currentRoute.stops.includes(d) && !alreadyAssignedOnOtherBuses.has(s.id);
        });

        if (targets.length === 0) {
            toast({ title: t('notice'), description: "배정할 학생이 없습니다." });
            return;
        }

        // 1. 그룹화 (가족/개인)
        const siblingGroups: Record<string, Student[]> = {};
        const individualStudents: Student[] = [];

        targets.forEach(s => {
            if (s.siblingGroupId) {
                if (!siblingGroups[s.siblingGroupId]) siblingGroups[s.siblingGroupId] = [];
                siblingGroups[s.siblingGroupId].push(s);
            } else {
                individualStudents.push(s);
            }
        });

        const blocks: Student[][] = [];
        Object.values(siblingGroups).forEach(group => {
            group.sort((a, b) => getGradeValue(a.grade) - getGradeValue(b.grade));
            blocks.push(group);
        });
        individualStudents.forEach(s => blocks.push([s]));

        // 블록 정렬
        blocks.sort((a, b) => {
            const gA = Math.min(...a.map(s => getGradeValue(s.grade)));
            const gB = Math.min(...b.map(s => getGradeValue(s.grade)));
            if (gA !== gB) return gA - gB;
            const dA = Math.min(...a.map(s => currentRoute.stops.indexOf(getDest(s)!)));
            const dB = Math.min(...b.map(s => currentRoute.stops.indexOf(getDest(s)!)));
            return dA - dB;
        });

        // 2. 쾌적함 기반 시트 오더 생성
        const capacity = selectedBus.capacity;
        const windowSeats: number[] = [];
        const aisleSeats: number[] = [];
        
        if (capacity === 45 || capacity === 29) {
            const rows = capacity === 45 ? 11 : 7;
            for (let r = 0; r < rows; r++) {
                const base = r * 4;
                if (r === rows - 1) { // 마지막 줄
                    if (capacity === 45) {
                        windowSeats.push(41, 45);
                        aisleSeats.push(42, 43, 44);
                    } else {
                        windowSeats.push(25, 29);
                        aisleSeats.push(26, 27, 28);
                    }
                } else {
                    windowSeats.push(base + 1, base + 4);
                    aisleSeats.push(base + 2, base + 3);
                }
            }
        } else if (capacity === 16) {
            // 16인승: 4~16번 우선 (운전석 쪽 1~3번 제외)
            for (let i = 4; i <= 16; i++) windowSeats.push(i);
            aisleSeats.push(1, 2, 3);
        }

        // 3. 배정 전략 결정
        // 학생 수가 전체 좌석의 절반 이하이면 최대한 창가만 채움
        const totalToAssign = blocks.flat().length;
        const useComfortStrategy = totalToAssign <= windowSeats.length;

        let seatOrder: number[] = [];
        if (useComfortStrategy) {
            // 쾌적 모드: 창가 먼저 쫙 채우고, 넘치면 통로
            seatOrder = [...windowSeats, ...aisleSeats];
        } else {
            // 밀집 모드: 기존처럼 줄 단위로 페어(창가+통로)를 채움 (가족 인접성 유리)
            if (capacity === 45 || capacity === 29) {
                const rows = capacity === 45 ? 11 : 7;
                for (let r = 0; r < rows; r++) {
                    const base = r * 4;
                    if (r === rows - 1) {
                        if (capacity === 45) seatOrder.push(41, 42, 45, 44, 43);
                        else seatOrder.push(25, 26, 29, 28, 27);
                    } else {
                        seatOrder.push(base + 1, base + 2, base + 4, base + 3);
                    }
                }
            } else {
                seatOrder = [...windowSeats, ...aisleSeats];
            }
        }

        // 4. 배정 실행
        let newSeating = generateInitialSeating(capacity);
        const flatStudents = blocks.flat();
        
        flatStudents.forEach((student, index) => {
            if (index < seatOrder.length) {
                const seatNum = seatOrder[index];
                const seatIdx = newSeating.findIndex(x => x.seatNumber === seatNum);
                if (seatIdx > -1) newSeating[seatIdx].studentId = student.id;
            }
        });

        await handleSeatUpdate(newSeating);
        toast({ title: t('admin.student_management.seat.random_assign_success') });
        if (selectedRouteType !== 'AfterSchool') setCopySeatingDialogOpen(true);
    }, [selectedBus, currentRoute, students, routes, selectedRouteType, selectedDay, handleSeatUpdate, toast, t]);

    const handleUndoRandomize = useCallback(async () => { if (previousSeating) { await handleSeatUpdate(previousSeating); setPreviousSeating(null); } }, [previousSeating, handleSeatUpdate]);

    const handleDownloadStudentTemplate = () => {
        const headers = ["이름", "학년", "반", "성별", "베트남 전화번호", "등교 목적지", "하교 목적지", "방과후(월)", "방과후(화)", "방과후(수)", "방과후(목)", "방과후(토)"];
        const rows = [
            ["Kim-Chulsu", "G1", "C1", "Male", "01012345678", "Gangnam-yeok", "Gangnam-yeok", "Gangnam-yeok", "", "Seocho-yeok", "", "Gangnam-yeok"]
        ];
        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement("a"));
        link.setAttribute("href", url);
        link.setAttribute("download", "student_template.csv");
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadAllStudents = useCallback(() => {
        if (students.length === 0) {
            toast({ title: t('notice'), description: "다운로드할 학생 데이터가 없습니다." });
            return;
        }
        const headers = ["이름", "학년", "반", "성별", "베트남 전화번호", "등교 목적지", "하교 목적지", "방과후(월)", "방과후(화)", "방과후(수)", "방과후(목)", "방과후(토)", "형제/자매"];
        const rows = students.map(s => {
            const escape = (val: string) => `"${val.toString().replace(/"/g, '""')}"`;
            return [
                escape(s.name),
                escape(s.grade),
                escape(s.class),
                escape(s.gender),
                escape(s.contact || ""),
                escape(destinations.find(d => d.id === s.morningDestinationId)?.name || ""),
                escape(destinations.find(d => d.id === s.afternoonDestinationId)?.name || ""),
                escape(destinations.find(d => d.id === s.afterSchoolDestinations?.['Monday'])?.name || ""),
                escape(destinations.find(d => d.id === s.afterSchoolDestinations?.['Tuesday'])?.name || ""),
                escape(destinations.find(d => d.id === s.afterSchoolDestinations?.['Wednesday'])?.name || ""),
                escape(destinations.find(d => d.id === s.afterSchoolDestinations?.['Thursday'])?.name || ""),
                escape(destinations.find(d => d.id === s.afterSchoolDestinations?.['Saturday'])?.name || ""),
                escape(s.siblingGroupId ? "O" : "")
            ];
        });
        const csvContent = "\uFEFF" + headers.join(',') + "\n" + rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement("a"));
        link.setAttribute("href", url);
        const dateStr = format(new Date(), 'yyyyMMdd');
        link.setAttribute("download", `KIS_All_Students_${dateStr}.csv`);
        link.click();
        document.body.removeChild(link);
    }, [students, destinations, t, toast]);

    const handleDownloadUnassignedStudents = useCallback(() => {
        if (filteredUnassignedStudents.length === 0) {
            toast({ title: t('notice'), description: t('admin.student_management.unassigned.download_list') });
            return;
        }
        const headers = ["이름", "학년", "반", "성별", "베트남 전화번호", "목적지", "형제/자매"];
        const rows = filteredUnassignedStudents.map(s => {
            let destId = null;
            if (selectedRouteType === 'Morning') destId = s.morningDestinationId;
            else if (selectedRouteType === 'Afternoon') destId = s.afternoonDestinationId;
            else if (selectedRouteType === 'AfterSchool') destId = s.afterSchoolDestinations?.[selectedDay] || null;
            
            const escape = (val: string) => `"${val.toString().replace(/"/g, '""')}"`;
            return [
                escape(s.name),
                escape(s.grade),
                escape(s.class),
                escape(s.gender),
                escape(s.contact || ""),
                escape(destinations.find(d => d.id === destId)?.name || "미지정"),
                escape(s.siblingGroupId ? "O" : "")
            ];
        });
        const csvContent = "\uFEFF" + headers.join(',') + "\n" + rows.map(r => r.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement("a"));
        link.setAttribute("href", url);
        link.setAttribute("download", `Unassigned_Students_${selectedDay}_${selectedRouteType}.csv`);
        link.click();
        document.body.removeChild(link);
    }, [filteredUnassignedStudents, selectedRouteType, selectedDay, destinations, t, toast]);

    const handleStudentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const newStudents: NewStudent[] = [];
                const destMap: Record<string, string> = {};
                destinations.forEach(d => {
                    destMap[normalizeString(d.name)] = d.id;
                });

                results.data.forEach((row: any) => {
                    const name = (row['이름'] || row['Name'] || row['name'] || '').toString().trim();
                    const grade = (row['학년'] || row['Grade'] || row['grade'] || '').toString().trim();
                    const studentClass = (row['반'] || row['Class'] || row['class'] || '').toString().trim();
                    const rawGender = (row['성별'] || row['Gender'] || row['gender'] || '').toString().trim();
                    const gender = (rawGender === '여자' || rawGender === 'Female' || rawGender === 'female') ? 'Female' : (rawGender ? 'Male' : undefined);
                    const contact = (row['베트남 전화번호'] || row['연락처'] || row['Contact'] || row['contact'] || '').toString().trim();
                    
                    const morningDestKey = normalizeString(row['등교 목적지'] || row['Morning Destination'] || '');
                    const afternoonDestKey = normalizeString(row['하교 목적지'] || row['Afternoon Destination'] || '');
                    
                    const afterMonKey = normalizeString(row['방과후(월)'] || '');
                    const afterTueKey = normalizeString(row['방과후(화)'] || '');
                    const afterWedKey = normalizeString(row['방과후(수)'] || '');
                    const afterThuKey = normalizeString(row['방과후(목)'] || '');
                    const afterSatKey = normalizeString(row['방과후(토)'] || '');

                    if (name && grade && studentClass) {
                        const studentUpdate: any = { name, grade, class: studentClass };
                        
                        if (gender) studentUpdate.gender = gender;
                        if (contact) studentUpdate.contact = contact;
                        
                        if (morningDestKey) studentUpdate.morningDestinationId = destMap[morningDestKey] || null;
                        if (afternoonDestKey) studentUpdate.afternoonDestinationId = destMap[afternoonDestKey] || null;

                        const afterSchoolDestinations: Partial<Record<DayOfWeek, string | null>> = {};
                        let hasAfterSchoolInCsv = false;
                        if (afterMonKey) { afterSchoolDestinations['Monday'] = destMap[afterMonKey] || null; hasAfterSchoolInCsv = true; }
                        if (afterTueKey) { afterSchoolDestinations['Tuesday'] = destMap[afterTueKey] || null; hasAfterSchoolInCsv = true; }
                        if (afterWedKey) { afterSchoolDestinations['Wednesday'] = destMap[afterWedKey] || null; hasAfterSchoolInCsv = true; }
                        if (afterThuKey) { afterSchoolDestinations['Thursday'] = destMap[afterThuKey] || null; hasAfterSchoolInCsv = true; }
                        if (afterSatKey) { afterSchoolDestinations['Saturday'] = destMap[afterSatKey] || null; hasAfterSchoolInCsv = true; }
                        
                        if (hasAfterSchoolInCsv) studentUpdate.afterSchoolDestinations = afterSchoolDestinations;

                        newStudents.push(studentUpdate as NewStudent);
                    }
                });

                if (newStudents.length === 0) {
                    toast({ title: t('error'), description: t('admin.student_management.batch_upload.validation_error'), variant: 'destructive' });
                    return;
                }

                const { dismiss } = toast({ title: t('processing'), description: t('admin.student_management.batch_upload.processing') });
                try {
                    await Promise.all(newStudents.map(s => addStudent(s)));
                    dismiss();
                    toast({ title: t('success'), description: t('admin.student_management.batch_upload.success', { count: newStudents.length }) });
                } catch (error) {
                    dismiss();
                    console.error("Batch upload error:", error);
                    toast({ title: t('error'), description: t('admin.student_management.batch_upload.error'), variant: 'destructive' });
                }
            },
            error: (error) => {
                toast({ title: t('admin.file_parse_error'), description: error.message, variant: "destructive" });
            }
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDestinationChange = useCallback(async (sid: string, nid: string | null, type: string, day?: DayOfWeek) => {
        const s = students.find(x => x.id === sid);
        if (!s) return;
        const val = nid === '_NONE_' ? null : nid;
        let up: any = { applicationStatus: 'pending' };
        if (type === 'morning') up.morningDestinationId = val;
        else if (type === 'afternoon') up.afternoonDestinationId = val;
        else if (type === 'afterSchool' && day) up.afterSchoolDestinations = { ...(s.afterSchoolDestinations || {}), [day]: val };
        await updateStudent(sid, up);
        if (selectedGlobalStudent?.id === sid) setSelectedGlobalStudent({ ...s, ...up });
    }, [students, selectedGlobalStudent, setSelectedGlobalStudent]);

    const handleStudentInfoChange = useCallback(async (sid: string, f: string, v: string) => {
        await updateStudent(sid, { [f]: v });
        if (selectedGlobalStudent?.id === sid) setSelectedGlobalStudent(s => s ? { ...s, [f]: v } : null);
    }, [selectedGlobalStudent, setSelectedGlobalStudent]);

    const handleUnassignAllFromStudent = useCallback(async () => { if (selectedGlobalStudent) await unassignStudentFromAllRoutes(selectedGlobalStudent.id); }, [selectedGlobalStudent]);
    
    const handleDeleteAllStudents = useCallback(async () => {
        const ids = students.map(s => s.id);
        if (ids.length === 0) return;
        const { dismiss } = toast({ title: t('processing'), description: "전체 학생 명단 삭제 중..." });
        try {
            await deleteStudentsInBatch(ids);
            dismiss();
            toast({ title: t('success'), description: "전체 학생 명단이 초기화되었습니다." });
        } catch (error) {
            dismiss();
            toast({ title: t('error'), description: "초기화 중 오류가 발생했습니다.", variant: "destructive" });
        }
    }, [students, t, toast]);

    const handleAssignStudentFromSearch = useCallback(async () => {
        if (selectedGlobalStudent && currentRoute) {
            const empty = currentRoute.seating.find(s => !s.studentId);
            if (empty) await handleSeatUpdate(currentRoute.seating.map(s => s.seatNumber === empty.seatNumber ? { ...s, studentId: selectedGlobalStudent.id } : s));
        }
    }, [selectedGlobalStudent, currentRoute, handleSeatUpdate]);

    useEffect(() => {
        if (!globalSearchQuery) { setGlobalSearchResults([]); return; }
        const lowerQuery = normalizeString(globalSearchQuery);
        const queryDigits = globalSearchQuery.replace(/\D/g, '');
        
        setGlobalSearchResults(students.filter(s => {
            const nameMatch = normalizeString(s.name).includes(lowerQuery);
            const contactMatch = queryDigits && s.contact && s.contact.includes(queryDigits);
            return nameMatch || contactMatch;
        }));
    }, [globalSearchQuery, students]);

    const handleGlobalStudentClick = (s: Student) => { setSelectedGlobalStudent(s); setGlobalSearchQuery(''); setGlobalSearchResults([]); };

    if (!selectedBusId) return <div className="p-4 text-center">{t('admin.student_management.select_bus_prompt')}</div>;

    const unassignedTitle = selectedRouteType === 'AfterSchool' ? t('admin.student_management.unassigned.title', { routeType: t('route_type.after_school') }) : t('admin.student_management.unassigned.title', { routeType: t(`route_type.${selectedRouteType.toLowerCase()}`) });

    return (
        <div className="space-y-6" onContextMenu={handleSeatContextMenu}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {unassignableStudents.length > 0 && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>{t('admin.student_management.unassignable.title')}</AlertTitle>
                            <AlertDescription>
                                <div className="mt-2 space-y-1">
                                    {unassignableStudents.map(student => (
                                        <div 
                                            key={student.id} 
                                            className="text-xs flex justify-between items-center border-b border-destructive/20 pb-1 cursor-pointer hover:bg-destructive/10 transition-colors"
                                            onClick={() => setSelectedGlobalStudent(student)}
                                            title="클릭하여 학생 정보 수정"
                                        >
                                            <span>{student.name} ({student.grade} {student.class})</span>
                                            <span className="font-semibold">{student.errorReason}</span>
                                        </div>
                                    ))}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}
                    {selectedBusId === 'all' ? (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>전체 버스 관리 - {t(`day.${selectedDay.toLowerCase()}`)} {selectedRouteType === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${selectedRouteType.toLowerCase()}`)}</CardTitle>
                                    <CardDescription>선택한 시간대의 모든 버스 좌석을 한꺼번에 관리합니다.</CardDescription>
                                </div>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive">
                                            <RotateCcw className="mr-2 h-4 w-4" /> 전체 좌석 초기화
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>정말 모든 버스 좌석을 초기화하시겠습니까?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t(`day.${selectedDay.toLowerCase()}`)} {selectedRouteType === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${selectedRouteType.toLowerCase()}`)} 시간대의 모든 버스 배정 내역이 영구적으로 삭제됩니다.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleResetAllSeating}>{t('reset')}</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                                <Users className="h-12 w-12 mb-4 opacity-20" />
                                <p>전체 버스 모드에서는 좌석 배정 일괄 초기화 및 학생 검색/관리가 가능합니다.</p>
                                <p className="text-sm">개별 버스의 좌석을 배정하려면 상단 필터에서 특정 버스를 선택해주세요.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>{t('admin.student_management.seat.title')}</CardTitle>
                                <div className="flex gap-2">
                                    <Dialog open={isAddStudentDialogOpen} onOpenChange={setAddStudentDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm">
                                                <UserPlus className="h-4 w-4 mr-2" /> {t('admin.student_management.add_student.button')}
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>{t('admin.student_management.add_student.title')}</DialogTitle>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid grid-cols-4 items-center gap-4">
                                                    <Label htmlFor="add-student-name" className="text-right">{t('student.name')}</Label>
                                                    <Input id="add-student-name" className="col-span-3" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} />
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-4">
                                                    <Label htmlFor="add-student-grade" className="text-right">{t('student.grade')}</Label>
                                                    <Input id="add-student-grade" className="col-span-3" value={newStudentGrade} onChange={e => setNewStudentGrade(e.target.value)} placeholder="예: G1" />
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-4">
                                                    <Label htmlFor="add-student-class" className="text-right">{t('student.class')}</Label>
                                                    <Input id="add-student-class" className="col-span-3" value={newStudentClass} onChange={e => setNewStudentClass(e.target.value)} placeholder="예: C1" />
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-4">
                                                    <Label htmlFor="add-student-gender" className="text-right">{t('student.gender')}</Label>
                                                    <Select onValueChange={(v) => setNewStudentGender(v as any)} value={newStudentGender}>
                                                        <SelectTrigger className="col-span-3">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Male">{t('student.male')}</SelectItem>
                                                            <SelectItem value="Female">{t('student.female')}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="grid grid-cols-4 items-center gap-4">
                                                    <Label htmlFor="add-student-contact" className="text-right">{t('student.contact')}</Label>
                                                    <Input id="add-student-contact" className="col-span-3" value={newStudentContact} onChange={e => setNewStudentContact(e.target.value)} />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button variant="outline" onClick={() => setAddStudentDialogOpen(false)}>{t('cancel')}</Button>
                                                <Button onClick={handleManualAddStudent}>{t('add')}</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                    <Dialog open={isCopySeatingDialogOpen} onOpenChange={setCopySeatingDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="sm" disabled={!currentRoute}>
                                                <Copy className="h-4 w-4 mr-2" /> {t('admin.student_management.seat.copy.button')}
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>{t('admin.student_management.seat.copy.title')}</DialogTitle>
                                                <CardDescription>{t('admin.student_management.seat.copy.description')}</CardDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div>
                                                    <Label>{t('admin.student_management.seat.copy.select_days')}</Label>
                                                    <div className="flex items-center space-x-2 mt-2">
                                                        <Checkbox 
                                                            id="copy-all-days" 
                                                            checked={weekdays.every(d => daysToCopyTo[d])} 
                                                            onCheckedChange={handleToggleAllCopyToDays} 
                                                        />
                                                        <Label htmlFor="copy-all-days">{t('select_all')}</Label>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                                        {weekdays.map(day => (
                                                            <div key={day} className="flex items-center space-x-2">
                                                                <Checkbox 
                                                                    id={`copy-day-${day}`} 
                                                                    checked={!!daysToCopyTo[day]} 
                                                                    onCheckedChange={(c) => setDaysToCopyTo(p => ({ ...p, [day]: c as boolean }))} 
                                                                />
                                                                <Label htmlFor={`copy-day-${day}`}>{t(`day.${day.toLowerCase()}`)}</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                {selectedRouteType !== 'AfterSchool' && (
                                                    <div>
                                                        <Label>{t('admin.student_management.seat.copy.select_route_types')}</Label>
                                                        <div className="flex space-x-4 mt-2">
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox 
                                                                    id="copy-type-morning" 
                                                                    checked={!!routeTypesToCopyTo.Morning} 
                                                                    onCheckedChange={(c) => setRouteTypesToCopyTo(p => ({ ...p, Morning: c as boolean }))} 
                                                                />
                                                                <Label htmlFor="copy-type-morning">{t('route_type.morning')}</Label>
                                                            </div>
                                                            <div className="flex items-center space-x-2">
                                                                <Checkbox 
                                                                    id="copy-type-afternoon" 
                                                                    checked={!!routeTypesToCopyTo.Afternoon} 
                                                                    onCheckedChange={(c) => setRouteTypesToCopyTo(p => ({ ...p, Afternoon: c as boolean }))} 
                                                                />
                                                                <Label htmlFor="copy-type-afternoon">{t('route_type.afternoon')}</Label>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleCopySeating} className="w-full">{t('copy')}</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                    <Button variant="outline" size="sm" onClick={handleUndoRandomize} disabled={!previousSeating}><Undo2 className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="sm" onClick={randomizeSeating}><Shuffle className="h-4 w-4" /></Button>
                                    <Button variant="outline" size="sm" onClick={handleResetSeating} disabled={!currentRoute}><RotateCcw className="h-4 w-4" /></Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {selectedBus && currentRoute && (
                                    <BusSeatMap
                                        bus={selectedBus}
                                        seating={currentRoute.seating}
                                        students={students}
                                        destinations={destinations}
                                        onSeatClick={handleSeatClick}
                                        highlightedSeatNumber={selectedSeat?.seatNumber}
                                        highlightedStudentId={selectedGlobalStudent?.id}
                                        routeType={selectedRouteType}
                                        dayOfWeek={selectedDay}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    )}
                </div>
                <div className="lg:col-span-1 space-y-4">
                    <StudentUnassignedPanel
                        filteredUnassignedStudents={filteredUnassignedStudents}
                        destinations={destinations}
                        selectedStudentIds={selectedStudentIds}
                        unassignedSearchQuery={unassignedSearchQuery}
                        setUnassignedSearchQuery={setUnassignedSearchQuery}
                        unassignedView={unassignedView}
                        setUnassignedView={setUnassignedView}
                        unassignedTitle={unassignedTitle}
                        selectedRouteType={selectedRouteType}
                        selectedDay={selectedDay}
                        handleDownloadUnassignedStudents={handleDownloadUnassignedStudents}
                        handleToggleSelectAll={handleToggleSelectAll}
                        handleDeleteSelectedStudents={handleDeleteSelectedStudents}
                        handleToggleStudentSelection={handleToggleStudentSelection}
                        handleUnassignedStudentClick={handleUnassignedStudentClick}
                        handleStudentCardClick={handleStudentCardClick}
                    />
                    <StudentGlobalSearchPanel
                        students={students}
                        destinations={destinations}
                        buses={buses}
                        routes={routes}
                        selectedRouteType={selectedRouteType}
                        dayOrder={dayOrder}
                        selectedGlobalStudent={selectedGlobalStudent}
                        setSelectedGlobalStudent={setSelectedGlobalStudent}
                        globalSearchQuery={globalSearchQuery}
                        setGlobalSearchQuery={setGlobalSearchQuery}
                        globalSearchResults={globalSearchResults}
                        handleGlobalStudentClick={handleGlobalStudentClick}
                        handleDownloadAllStudents={handleDownloadAllStudents}
                        handleDownloadStudentTemplate={handleDownloadStudentTemplate}
                        fileInputRef={fileInputRef}
                        handleStudentFileUpload={handleStudentFileUpload}
                        handleDeleteAllStudents={handleDeleteAllStudents}
                        handleUnassignAllFromStudent={handleUnassignAllFromStudent}
                        handleAssignStudentFromSearch={handleAssignStudentFromSearch}
                        handleStudentInfoChange={handleStudentInfoChange}
                        handleDestinationChange={handleDestinationChange}
                        handleUnassignStudentFromRoute={handleUnassignStudentFromRoute}
                        assignedRoutesForSelectedStudent={assignedRoutesForSelectedStudent}
                    />
                </div>
            </div>
        </div>
    );
};
