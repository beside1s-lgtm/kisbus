'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { 
    addStudent, updateStudent, deleteStudentsInBatch, updateRouteSeating,
    copySeatingPlan, unassignStudentFromAllRoutes
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, NewStudent } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Shuffle, UserPlus, RotateCcw, Copy, Bell, Undo2 } from 'lucide-react';
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

const dayLabels: { [key in DayOfWeek]: string } = {
    Monday: '월요일', Tuesday: '화요일', Wednesday: '수요일',
    Thursday: '목요일', Friday: '금요일', Saturday: '토요일',
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
}

export const StudentManagementTab = ({
    students, buses, routes, destinations, selectedBusId, selectedDay, selectedRouteType, days,
}: StudentManagementTabProps) => {
    const { toast } = useToast();
    const { t } = useTranslation();
    const [newStudentForm, setNewStudentForm] = useState<Partial<NewStudent>>({ gender: 'Male' });
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
    const [unassignableStudents, setUnassignableStudents] = useState<Student[]>([]);

    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState<Student[]>([]);
    const [selectedGlobalStudent, setSelectedGlobalStudent] = useState<Student | null>(null);
    
    const dayOrder: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);

    const [previousSeating, setPreviousSeating] = useState<{ seatNumber: number; studentId: string | null }[] | null>(null);
    const [unassignedView, setUnassignedView] = useState<'current' | 'all'>('current');

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

    useEffect(() => {
        const allValidStopIds = new Set<string>();
        routes.forEach(r => r.stops.forEach(stopId => allValidStopIds.add(stopId)));
        setUnassignableStudents(students.filter(student => {
            const hasMorningError = student.morningDestinationId && !allValidStopIds.has(student.morningDestinationId);
            const hasAfternoonError = student.afternoonDestinationId && !allValidStopIds.has(student.afternoonDestinationId);
            let hasAfterSchoolError = false;
            if (student.afterSchoolDestinations) {
                for (const day in student.afterSchoolDestinations) {
                    const destId = student.afterSchoolDestinations[day as DayOfWeek];
                    if (destId && !allValidStopIds.has(destId)) { hasAfterSchoolError = true; break; }
                }
            }
            return hasMorningError || hasAfternoonError || hasAfterSchoolError;
        }));
    }, [students, routes]);

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

    useEffect(() => {
        if (selectedDay === 'Friday' && selectedRouteType === 'AfterSchool') { setFilteredUnassignedStudents([]); return; }
        const assignedIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => r.seating.forEach(s => { if (s.studentId) assignedIds.add(s.studentId); }));
        let unassigned: Student[];
        if (unassignedView === 'current') {
            if (!currentRoute) { setFilteredUnassignedStudents([]); return; }
            const afterSchoolIds = new Set<string>();
            if (selectedRouteType === 'Afternoon') routes.filter(r => r.dayOfWeek === selectedDay && r.type === 'AfterSchool').forEach(r => r.seating.forEach(s => { if (s.studentId) afterSchoolIds.add(s.studentId); }));
            unassigned = students.filter(s => !unassignableStudents.some(u => u.id === s.id) && !assignedIds.has(s.id) && !(selectedRouteType === 'Afternoon' && afterSchoolIds.has(s.id)) && (
                (selectedRouteType === 'Morning' && s.morningDestinationId && currentRoute.stops.includes(s.morningDestinationId)) ||
                (selectedRouteType === 'Afternoon' && s.afternoonDestinationId && currentRoute.stops.includes(s.afternoonDestinationId)) ||
                (selectedRouteType === 'AfterSchool' && s.afterSchoolDestinations?.[selectedDay] && currentRoute.stops.includes(s.afterSchoolDestinations[selectedDay]))
            ));
        } else { unassigned = students.filter(s => !assignedIds.has(s.id)); }
        
        if (unassignedSearchQuery) {
            const lowerQuery = unassignedSearchQuery.toLowerCase();
            const queryDigits = unassignedSearchQuery.replace(/\D/g, '');
            unassigned = unassigned.filter(s => {
                const nameMatch = s.name.toLowerCase().includes(lowerQuery);
                const contactMatch = queryDigits && s.contact && s.contact.replace(/\D/g, '').includes(queryDigits);
                return nameMatch || contactMatch;
            });
        }
        setFilteredUnassignedStudents(unassigned.sort((a, b) => a.name.localeCompare(b.name, 'ko')));
    }, [students, routes, currentRoute, selectedRouteType, selectedDay, unassignedSearchQuery, unassignableStudents, unassignedView]);

    useEffect(() => { setSelectedSeat(null); setPreviousSeating(null); }, [currentRoute, unassignedView]);

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

    const handleUnassignedStudentClick = useCallback((s: Student) => setSelectedGlobalStudent(s), []);

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

    const handleCopySeating = useCallback(async () => {
        if (!currentRoute) return;
        const days = weekdays.filter(d => daysToCopyTo[d]);
        const types = (['Morning', 'Afternoon'] as const).filter(t => routeTypesToCopyTo[t]);
        const targets = routes.filter(r => r.busId === currentRoute.busId && days.includes(r.dayOfWeek) && types.includes(r.type as any) && r.id !== currentRoute.id);
        if (targets.length > 0) { await copySeatingPlan(currentRoute.seating, targets); setCopySeatingDialogOpen(false); }
    }, [currentRoute, routes, daysToCopyTo, routeTypesToCopyTo, weekdays]);

    const handleToggleAllCopyToDays = useCallback((c: boolean) => setDaysToCopyTo(weekdays.reduce((a, d) => ({ ...a, [d]: c }), {})), [weekdays]);

    const randomizeSeating = useCallback(async () => {
        if (!selectedBus || !currentRoute) return;
        setPreviousSeating([...currentRoute.seating]);

        const getDest = (s: Student) => {
            if (selectedRouteType === 'Morning') return s.morningDestinationId;
            if (selectedRouteType === 'Afternoon') return s.afternoonDestinationId;
            return s.afterSchoolDestinations?.[selectedDay] || null;
        };
        
        const targets = students.filter(s => {
            const d = getDest(s);
            return d && currentRoute.stops.includes(d);
        });

        if (targets.length === 0) {
            toast({ title: t('notice'), description: "배정할 학생이 없습니다." });
            return;
        }

        // 1. Sort by grade priority (front priority) and destination order
        const sorted = [...targets].sort((a, b) => {
            const g = getGradeValue(a.grade) - getGradeValue(b.grade);
            if (g !== 0) return g;
            
            const d1 = currentRoute.stops.indexOf(getDest(a)!);
            const d2 = currentRoute.stops.indexOf(getDest(b)!);
            return d1 - d2;
        });

        // 2. Identify seat layout details
        const capacity = selectedBus.capacity;
        
        const getSeatLayout = (cap: number) => {
            const pairs: [number, number][] = []; // [Window, Aisle]
            const middles: number[] = [];
            if (cap === 45 || cap === 29) {
                // 2 - aisle - 2 layout
                for (let i = 1; i <= cap - 5; i += 4) {
                    pairs.push([i, i + 1]);     // Left row: [Window, Aisle]
                    pairs.push([i + 3, i + 2]); // Right row: [Window, Aisle]
                }
                if (cap === 45) {
                    pairs.push([41, 42]);
                    pairs.push([45, 44]);
                    middles.push(43); // Back middle seat
                } else if (cap === 29) {
                    pairs.push([25, 26]);
                    pairs.push([29, 28]);
                    middles.push(27);
                }
            } else {
                // For 16-seater or unknown, treat as simple single seats for now
                for (let i = 1; i <= cap; i++) middles.push(i);
            }
            return { pairs, middles };
        };

        const { pairs, middles } = getSeatLayout(capacity);
        
        // 3. Form blocks (Single or same-gender Pair)
        // Rule: "자리가 남으면 1명씩 앉기"
        const maxSingleCapacity = pairs.length + middles.length;
        const needsPairing = targets.length > maxSingleCapacity;
        
        const blocks: { s1: Student; s2?: Student }[] = [];
        const usedIds = new Set<string>();

        for (let i = 0; i < sorted.length; i++) {
            if (usedIds.has(sorted[i].id)) continue;
            const s1 = sorted[i];
            usedIds.add(s1.id);
            
            let s2: Student | undefined = undefined;
            if (needsPairing) {
                // Try to find a same-gender partner among remaining students
                for (let j = i + 1; j < sorted.length; j++) {
                    if (!usedIds.has(sorted[j].id) && sorted[j].gender === s1.gender) {
                        s2 = sorted[j];
                        usedIds.add(s2.id);
                        break;
                    }
                }
            }
            blocks.push({ s1, s2 });
        }

        // 4. Assign blocks to seats
        let newSeating = generateInitialSeating(capacity);
        let pairIdx = 0;
        let midIdx = 0;

        blocks.forEach(block => {
            if (block.s2 && pairIdx < pairs.length) {
                // Pair: Both in same row, same gender
                const seatPair = pairs[pairIdx++];
                const d1 = currentRoute.stops.indexOf(getDest(block.s1)!);
                const d2 = currentRoute.stops.indexOf(getDest(block.s2)!);
                
                // Rule: "먼저 내리는 사람이 통로쪽" (Aisle = seatPair[1])
                // seatPair[0] = Window, seatPair[1] = Aisle
                // Afternoon/AfterSchool: Lower index = earlier off = Aisle
                // Morning: Lower index = earlier on = Window (First on, sit inside)
                const shouldSwap = selectedRouteType === 'Morning' ? (d1 > d2) : (d1 < d2);
                
                const winStudent = shouldSwap ? block.s2 : block.s1;
                const aisleStudent = shouldSwap ? block.s1 : block.s2;

                const winIdx = newSeating.findIndex(s => s.seatNumber === seatPair[0]);
                const aisleIdx = newSeating.findIndex(s => s.seatNumber === seatPair[1]);
                newSeating[winIdx].studentId = winStudent.id;
                newSeating[aisleIdx].studentId = aisleStudent.id;

            } else if (pairIdx < pairs.length) {
                // Single in a pair row: "1명씩 앉을 때는 창가"
                const seatPair = pairs[pairIdx++];
                const winIdx = newSeating.findIndex(s => s.seatNumber === seatPair[0]);
                newSeating[winIdx].studentId = block.s1.id;
            } else if (midIdx < middles.length) {
                // Overflow to middle seats (back row)
                const seatNum = middles[midIdx++];
                const idx = newSeating.findIndex(s => s.seatNumber === seatNum);
                newSeating[idx].studentId = block.s1.id;
            }
        });

        await handleSeatUpdate(newSeating);
        toast({ title: t('admin.student_management.seat.random_assign_success') });
        if (selectedRouteType !== 'AfterSchool') setCopySeatingDialogOpen(true);
    }, [selectedBus, currentRoute, students, selectedRouteType, selectedDay, handleSeatUpdate, toast, t]);

    const handleUndoRandomize = useCallback(async () => { if (previousSeating) { await handleSeatUpdate(previousSeating); setPreviousSeating(null); } }, [previousSeating, handleSeatUpdate]);

    const handleDownloadStudentTemplate = () => {
        const headers = ["이름", "학년", "반", "성별", "연락처", "등교 목적지", "하교 목적지", "방과후(월)", "방과후(화)", "방과후(수)", "방과후(목)", "방과후(토)"];
        const rows = [
            ["김철수", "G1", "C1", "Male", "010-1234-5678", "강남역", "강남역", "강남역", "", "서초역", "", "강남역"],
            ["이영희", "G2", "C2", "Female", "010-5678-1234", "서초역", "서초역", "", "서초역", "", "서초역", ""]
        ];
        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "student_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadAllStudents = useCallback(() => {
        if (students.length === 0) {
            toast({ title: t('notice'), description: "다운로드할 학생 데이터가 없습니다." });
            return;
        }
        const headers = ["이름", "학년", "반", "성별", "연락처", "등교 목적지", "하교 목적지", "방과후(월)", "방과후(화)", "방과후(수)", "방과후(목)", "방과후(토)"];
        const rows = students.map(s => [
            s.name,
            s.grade,
            s.class,
            s.gender,
            s.contact || "",
            destinations.find(d => d.id === s.morningDestinationId)?.name || "",
            destinations.find(d => d.id === s.afternoonDestinationId)?.name || "",
            destinations.find(d => d.id === s.afterSchoolDestinations?.['Monday'])?.name || "",
            destinations.find(d => d.id === s.afterSchoolDestinations?.['Tuesday'])?.name || "",
            destinations.find(d => d.id === s.afterSchoolDestinations?.['Wednesday'])?.name || "",
            destinations.find(d => d.id === s.afterSchoolDestinations?.['Thursday'])?.name || "",
            destinations.find(d => d.id === s.afterSchoolDestinations?.['Saturday'])?.name || ""
        ]);
        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        const dateStr = format(new Date(), 'yyyyMMdd');
        link.setAttribute("download", `KIS_All_Students_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [students, destinations, t, toast]);

    const handleDownloadUnassignedStudents = useCallback(() => {
        if (filteredUnassignedStudents.length === 0) {
            toast({ title: t('notice'), description: t('admin.student_management.unassigned.no_students_to_download') });
            return;
        }
        const headers = ["이름", "학년", "반", "성별", "연락처", "목적지"];
        const rows = filteredUnassignedStudents.map(s => {
            let destId = null;
            if (selectedRouteType === 'Morning') destId = s.morningDestinationId;
            else if (selectedRouteType === 'Afternoon') destId = s.afternoonDestinationId;
            else if (selectedRouteType === 'AfterSchool') destId = s.afterSchoolDestinations?.[selectedDay] || null;
            
            return [
                s.name,
                s.grade,
                s.class,
                s.gender,
                s.contact || "",
                destinations.find(d => d.id === destId)?.name || "미지정"
            ];
        });
        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Unassigned_Students_${selectedDay}_${selectedRouteType}.csv`);
        document.body.appendChild(link);
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
                    destMap[d.name.trim().toLowerCase()] = d.id;
                });

                results.data.forEach((row: any) => {
                    const name = (row['이름'] || row['Name'] || row['name'] || '').trim();
                    const grade = (row['학년'] || row['Grade'] || row['grade'] || '').trim();
                    const studentClass = (row['반'] || row['Class'] || row['class'] || '').trim();
                    const rawGender = (row['성별'] || row['Gender'] || row['gender'] || 'Male').trim();
                    const gender = (rawGender === '여자' || rawGender === 'Female' || rawGender === 'female') ? 'Female' : 'Male';
                    const contact = (row['연락처'] || row['Contact'] || row['contact'] || '').trim();
                    
                    const morningDestName = (row['등교 목적지'] || row['Morning Destination'] || '').trim().toLowerCase();
                    const afternoonDestName = (row['하교 목적지'] || row['Afternoon Destination'] || '').trim().toLowerCase();
                    
                    const afterMonName = (row['방과후(월)'] || '').trim().toLowerCase();
                    const afterTueName = (row['방과후(화)'] || '').trim().toLowerCase();
                    const afterWedName = (row['방과후(수)'] || '').trim().toLowerCase();
                    const afterThuName = (row['방과후(목)'] || '').trim().toLowerCase();
                    const afterSatName = (row['방과후(토)'] || '').trim().toLowerCase();

                    if (name && grade && studentClass) {
                        const afterSchoolDestinations: Partial<Record<DayOfWeek, string | null>> = {};
                        if (afterMonName && destMap[afterMonName]) afterSchoolDestinations['Monday'] = destMap[afterMonName];
                        if (afterTueName && destMap[afterTueName]) afterSchoolDestinations['Tuesday'] = destMap[afterTueName];
                        if (afterWedName && destMap[afterWedName]) afterSchoolDestinations['Wednesday'] = destMap[afterWedName];
                        if (afterThuName && destMap[afterThuName]) afterSchoolDestinations['Thursday'] = destMap[afterThuName];
                        if (afterSatName && destMap[afterSatName]) afterSchoolDestinations['Saturday'] = destMap[afterSatName];

                        newStudents.push({
                            name,
                            grade,
                            class: studentClass,
                            gender,
                            contact,
                            morningDestinationId: destMap[morningDestName] || null,
                            afternoonDestinationId: destMap[afternoonDestName] || null,
                            afterSchoolDestinations,
                            applicationStatus: 'reviewed',
                        });
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

    const handleAddStudent = async () => {
        if (!newStudentForm.name || !newStudentForm.grade || !newStudentForm.class) {
            toast({ title: t('error'), description: t('admin.student_management.add_student.validation_error'), variant: 'destructive' });
            return;
        }
        try {
            await addStudent({
                ...newStudentForm,
                applicationStatus: 'reviewed',
                afterSchoolDestinations: newStudentForm.afterSchoolDestinations || {},
            } as NewStudent);
            setNewStudentForm({ gender: 'Male' });
            toast({ title: t('success'), description: t('admin.student_management.add_student.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.student_management.add_student.error'), variant: 'destructive' });
        }
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
    }, [students, selectedGlobalStudent]);

    const handleStudentInfoChange = useCallback(async (sid: string, f: string, v: string) => {
        await updateStudent(sid, { [f]: v });
        if (selectedGlobalStudent?.id === sid) setSelectedGlobalStudent(s => s ? { ...s, [f]: v } : null);
    }, [selectedGlobalStudent]);

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
        const lowerQuery = globalSearchQuery.toLowerCase();
        const queryDigits = globalSearchQuery.replace(/\D/g, '');
        
        setGlobalSearchResults(students.filter(s => {
            const nameMatch = s.name.toLowerCase().includes(lowerQuery);
            const contactMatch = queryDigits && s.contact && s.contact.replace(/\D/g, '').includes(queryDigits);
            return nameMatch || contactMatch;
        }));
    }, [globalSearchQuery, students]);

    const handleGlobalStudentClick = (s: Student) => { setSelectedGlobalStudent(s); setGlobalSearchQuery(''); setGlobalSearchResults([]); };

    if (!selectedBusId) return <div className="p-4 text-center">{t('admin.student_management.select_bus_prompt')}</div>;
    if (!currentRoute) return <div className="p-4 text-center">{t('admin.student_management.no_route_info')}</div>;

    const unassignedTitle = selectedRouteType === 'AfterSchool' ? t('admin.student_management.unassigned.title', { routeType: t('route_type.after_school') }) : t('admin.student_management.unassigned.title', { routeType: t(`route_type.${selectedRouteType.toLowerCase()}`) });

    return (
        <div className="space-y-6" onContextMenu={handleSeatContextMenu}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('admin.student_management.seat.title')}</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleUndoRandomize} disabled={!previousSeating}><Undo2 className="h-4 w-4" /></Button>
                                <Button variant="outline" size="sm" onClick={randomizeSeating}><Shuffle className="h-4 w-4" /></Button>
                                <Button variant="outline" size="sm" onClick={handleResetSeating} disabled={!currentRoute}><RotateCcw className="h-4 w-4" /></Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {selectedBus && (
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
