'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { 
    addStudent, updateStudent, deleteStudentsInBatch, updateRouteSeating,
    copySeatingPlan, unassignStudentFromAllRoutes, updateStudentsInBatch,
    getDestinations, addDestinationsInBatch
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, SeatingAssignment } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shuffle, RotateCcw, Copy, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from '@/hooks/use-translation';
import { normalizeString, sanitizeDataForSystem } from '@/lib/utils';

import { StudentUnassignedPanel } from './student-unassigned-panel';
import { StudentGlobalSearchPanel } from './student-global-search-panel';

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

const generateInitialSeating = (capacity: number): SeatingAssignment[] => {
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
    
    const [unassignedSearchQuery, setUnassignedSearchQuery] = useState('');
    const [filteredUnassignedStudents, setFilteredUnassignedStudents] = useState<Student[]>([]);
    
    const [selectedSeat, setSelectedSeat] = useState<{ seatNumber: number; studentId: string | null } | null>(null);
    const [unassignableStudents, setUnassignableStudents] = useState<(Student & { errorReason: string })[]>([]);

    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const dayOrder: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);

    // Seating Copy Dialog State
    const [isCopySeatingDialogOpen, setIsCopySeatingDialogOpen] = useState(false);
    const [daysToCopySeatingTo, setDaysToCopySeatingTo] = useState<Partial<Record<DayOfWeek, boolean>>>(
        () => dayOrder.reduce((acc, day) => ({ ...acc, [day]: true }), {})
    );
    const [routeTypesToCopySeatingTo, setRouteTypesToCopySeatingTo] = useState<Partial<Record<'Morning' | 'Afternoon', boolean>>>({
        Morning: true,
        Afternoon: true
    });

    const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
    const currentRoute = useMemo(() => routes.find(r => r.busId === selectedBusId && r.dayOfWeek === selectedDay && r.type === selectedRouteType), [routes, selectedBusId, selectedDay, selectedRouteType]);

    const assignedStudentsCount = useMemo(() => {
        if (!currentRoute) return 0;
        return currentRoute.seating.filter(s => !!s.studentId).length;
    }, [currentRoute]);

    const [unassignedView, setUnassignedView] = useState<'current' | 'all'>('current');

    const getRouteTypeLabel = (rt: RouteType) => {
        if (rt === 'AfterSchool') return t('route_type.after_school');
        return t(`route_type.${rt.toLowerCase()}`);
    };

    // Global Search Logic
    const globalSearchResults = useMemo(() => {
        if (!globalSearchQuery.trim()) return [];
        const lq = normalizeString(globalSearchQuery);
        return students.filter(s => 
            normalizeString(s.name).includes(lq) || 
            (s.contact && s.contact.includes(globalSearchQuery.replace(/\D/g, '')))
        ).slice(0, 10);
    }, [students, globalSearchQuery]);

    const assignedRoutesForSelectedStudent = useMemo(() => {
        if (!selectedGlobalStudent) return [];
        return routes
            .filter(route => route.seating.some(seat => seat.studentId === selectedGlobalStudent.id))
            .sort((a, b) => {
                const busA = buses.find(bus => bus.id === a.busId);
                const busB = buses.find(bus => bus.id === b.busId);
                const numA = busA ? parseInt(busA.name.replace(/\D/g, ''), 10) : Infinity;
                const numB = busB ? parseInt(b.name.replace(/\D/g, ''), 10) : Infinity;
                if (numA !== numB) return (!isNaN(numA) ? numA : Infinity) - (!isNaN(numB) ? numB : Infinity);
                const dayIndexA = dayOrder.indexOf(a.dayOfWeek);
                const dayIndexB = dayOrder.indexOf(b.dayOfWeek);
                return dayIndexA - dayIndexB;
            });
    }, [selectedGlobalStudent, routes, buses, dayOrder]);

    useEffect(() => {
        if (!routes.length || !students.length) return;
        
        const allAssignedIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => {
            r.seating.forEach(s => { if (s.studentId) allAssignedIds.add(s.studentId); });
        });

        const validStopIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => {
            r.stops.forEach(s => validStopIds.add(s));
        });

        const unassignables: (Student & { errorReason: string })[] = [];
        students.forEach(student => {
            if (allAssignedIds.has(student.id)) return;
            
            let destId: string | null = null;
            let errorKey = '';
            
            if (selectedDay === 'Saturday') {
                if (selectedRouteType === 'Morning') { 
                    destId = student.satMorningDestinationId; 
                    errorKey = 'admin.student_management.unassignable.error_sat_morning'; 
                } else { 
                    destId = student.satAfternoonDestinationId; 
                    errorKey = 'admin.student_management.unassignable.error_sat_afternoon'; 
                }
            } else {
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
            }

            if (destId && !validStopIds.has(destId)) {
                const destName = destinations.find(d => d.id === destId)?.name || '알 수 없음';
                unassignables.push({ 
                    ...student, 
                    errorReason: `${t(errorKey, { day: t(`day_short.${selectedDay.toLowerCase()}`) })} (${destName})` 
                });
            }
        });
        setUnassignableStudents(unassignables);
    }, [students, routes, selectedDay, selectedRouteType, destinations, t]);

    useEffect(() => {
        const getStudentDestId = (s: Student) => {
            if (selectedDay === 'Saturday') return selectedRouteType === 'Morning' ? s.satMorningDestinationId : s.satAfternoonDestinationId;
            if (selectedRouteType === 'Morning') return s.morningDestinationId;
            if (selectedRouteType === 'Afternoon') return s.afternoonDestinationId;
            if (selectedRouteType === 'AfterSchool') return s.afterSchoolDestinations?.[selectedDay] || null;
            return null;
        };

        const allAssignedIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => {
            r.seating.forEach(s => { if (s.studentId) allAssignedIds.add(s.studentId); });
        });

        const targetStopIds = new Set<string>();
        if (selectedBusId === 'all') {
            routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => r.stops.forEach(s => targetStopIds.add(s)));
        } else if (currentRoute) {
            currentRoute.stops.forEach(s => targetStopIds.add(s));
        }

        let unassigned = students.filter(s => {
            if (allAssignedIds.has(s.id)) return false;
            const destId = getStudentDestId(s);
            if (!destId) return false;
            if (unassignedView === 'current') return targetStopIds.has(destId);
            return true;
        });

        if (unassignedSearchQuery) {
            const lq = normalizeString(unassignedSearchQuery);
            unassigned = unassigned.filter(s => 
                normalizeString(s.name).includes(lq) || 
                (s.contact && s.contact.includes(unassignedSearchQuery.replace(/\D/g, '')))
            );
        }

        setFilteredUnassignedStudents(unassigned.sort((a, b) => {
            const gA = getGradeValue(a.grade);
            const gB = getGradeValue(b.grade);
            if (gA !== gB) return gA - gB;
            return a.name.localeCompare(b.name, 'ko');
        }));
    }, [students, routes, currentRoute, selectedRouteType, selectedDay, unassignedSearchQuery, unassignedView, selectedBusId]);

    const handleSeatUpdate = useCallback(async (newSeating: SeatingAssignment[]) => { 
        if (currentRoute) await updateRouteSeating(currentRoute.id, newSeating); 
    }, [currentRoute]);

    const handleSeatClick = useCallback(async (num: number, sid: string | null) => {
        if (!currentRoute) return;
        const next = [...currentRoute.seating];
        if (selectedSeat) {
            const sIdx = next.findIndex(x => x.seatNumber === selectedSeat.seatNumber);
            const tIdx = next.findIndex(x => x.seatNumber === num);
            if (selectedSeat.seatNumber === num) {
                next[sIdx].studentId = null;
            } else { 
                const temp = next[sIdx].studentId; 
                next[sIdx].studentId = next[tIdx].studentId; 
                next[tIdx].studentId = temp; 
            }
            await handleSeatUpdate(next); 
            setSelectedSeat(null);
        } else {
            setSelectedSeat({ seatNumber: num, studentId: sid });
        }
    }, [currentRoute, selectedSeat, handleSeatUpdate]);

    const handleStudentCardClick = useCallback(async (sid: string) => {
        if (currentRoute && selectedSeat && !selectedSeat.studentId) {
            const next = [...currentRoute.seating];
            const idx = next.findIndex(s => s.seatNumber === selectedSeat.seatNumber);
            if (idx > -1) { 
                next[idx].studentId = sid; 
                await handleSeatUpdate(next); 
                setSelectedSeat(null); 
            }
        }
    }, [currentRoute, selectedSeat, handleSeatUpdate]);

    const handleAssignStudentFromSearch = useCallback(async () => {
        if (!selectedGlobalStudent || !selectedSeat || selectedSeat.studentId) {
            toast({ title: t('notice'), description: t('admin.student_management.seat.select_empty_seat_prompt') });
            return;
        }
        await handleStudentCardClick(selectedGlobalStudent.id);
    }, [selectedGlobalStudent, selectedSeat, handleStudentCardClick, t, toast]);

    const handleRandomAssign = useCallback(async () => {
        if (!currentRoute || !selectedBus) return;
        
        const getStudentDestId = (s: Student) => {
            if (selectedDay === 'Saturday') return selectedRouteType === 'Morning' ? s.satMorningDestinationId : s.satAfternoonDestinationId;
            if (selectedRouteType === 'Morning') return s.morningDestinationId;
            if (selectedRouteType === 'Afternoon') return s.afternoonDestinationId;
            if (selectedRouteType === 'AfterSchool') return s.afterSchoolDestinations?.[selectedDay] || null;
            return null;
        };

        const allAssignedIds = new Set<string>();
        routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => {
            r.seating.forEach(s => { if (s.studentId) allAssignedIds.add(s.studentId); });
        });

        const routeStopIds = new Set(currentRoute.stops);
        const eligibleStudents = students.filter(s => {
            if (allAssignedIds.has(s.id)) return false;
            const destId = getStudentDestId(s);
            return destId && routeStopIds.has(destId);
        });

        if (eligibleStudents.length === 0) {
            toast({ title: t('notice'), description: "배정할 수 있는 대기 학생이 없습니다." });
            return;
        }

        const newSeating = [...currentRoute.seating];
        const emptySeatIndices = newSeating.reduce((acc, seat, idx) => {
            if (!seat.studentId) acc.push(idx);
            return acc;
        }, [] as number[]);

        if (emptySeatIndices.length === 0) {
            toast({ title: t('notice'), description: "남은 좌석이 없습니다." });
            return;
        }

        const shuffledStudents = [...eligibleStudents].sort((a, b) => {
            const gA = getGradeValue(a.grade);
            const gB = getGradeValue(b.grade);
            if (gA !== gB) return gA - gB;
            return Math.random() - 0.5;
        });

        const assignCount = Math.min(shuffledStudents.length, emptySeatIndices.length);
        for (let i = 0; i < assignCount; i++) {
            newSeating[emptySeatIndices[i]].studentId = shuffledStudents[i].id;
        }

        await handleSeatUpdate(newSeating);
        toast({ title: t('success'), description: t('admin.student_management.seat.random_assign_success') });
    }, [currentRoute, selectedBus, students, routes, selectedDay, selectedRouteType, handleSeatUpdate, t, toast]);

    const handleCopySeating = useCallback(async () => {
        if (!currentRoute) {
            toast({ title: t('error'), description: t('admin.student_management.seat.copy.no_source_error'), variant: "destructive" });
            return;
        }

        const selectedDays = dayOrder.filter(day => daysToCopySeatingTo[day]);
        const selectedRouteTypes = (['Morning', 'Afternoon'] as const).filter(type => routeTypesToCopySeatingTo[type]);

        if (selectedDays.length === 0 || selectedRouteTypes.length === 0) {
            toast({ title: t('notice'), description: t('admin.student_management.seat.copy.no_selection_error') });
            return;
        }

        const targetRoutes = routes.filter(r =>
            r.busId === currentRoute.busId &&
            selectedDays.includes(r.dayOfWeek) &&
            selectedRouteTypes.includes(r.type as 'Morning' | 'Afternoon') &&
            r.id !== currentRoute.id
        );

        if (targetRoutes.length === 0) {
            toast({ title: t('notice'), description: t('admin.student_management.seat.copy.no_target_error') });
            return;
        }

        try {
            await copySeatingPlan(currentRoute.seating, targetRoutes);
            toast({ title: t('success'), description: t('admin.student_management.seat.copy.success') });
            setIsCopySeatingDialogOpen(false);
        } catch (error) {
            toast({ title: t('error'), description: t('admin.student_management.seat.copy.error'), variant: "destructive" });
        }
    }, [currentRoute, routes, daysToCopySeatingTo, routeTypesToCopySeatingTo, t, toast, dayOrder]);

    const handleDestinationChangeWrapper = (id: string, val: string|null, type: 'morning'|'afternoon'|'afterSchool'|'satMorning'|'satAfternoon', day?: DayOfWeek) => {
        const realVal = val === '_NONE_' ? null : val;
        const updates: any = {};
        if (type === 'morning') updates.morningDestinationId = realVal;
        else if (type === 'afternoon') updates.afternoonDestinationId = realVal;
        else if (type === 'satMorning') updates.satMorningDestinationId = realVal;
        else if (type === 'satAfternoon') updates.satAfternoonDestinationId = realVal;
        else if (type === 'afterSchool' && day) {
            const current = selectedGlobalStudent?.afterSchoolDestinations || {};
            updates.afterSchoolDestinations = { ...current, [day]: realVal };
        }
        updateStudent(id, updates);
    };

    const handleDownloadAllStudents = useCallback(() => {
        if (students.length === 0) return;
        const headers = ["이름", "학년", "반", "성별", "연락처", "등교 목적지", "하교 목적지"];
        const csvRows = students.map(s => [
            `"${s.name}"`, `"${s.grade}"`, `"${s.class}"`, `"${s.gender}"`, `"${s.contact || ''}"`,
            `"${destinations.find(d => d.id === s.morningDestinationId)?.name || ''}"`,
            `"${destinations.find(d => d.id === s.afternoonDestinationId)?.name || ''}"`
        ].join(','));
        const csvContent = "\uFEFF" + headers.join(',') + "\n" + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "KIS_Students_All.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [students, destinations]);

    const handleStudentFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const newStudents = results.data.map((row: any) => {
                    const name = (row['이름'] || row['name'] || '').trim();
                    if (!name) return null;
                    return {
                        name,
                        grade: (row['학년'] || row['grade'] || '1').toString().trim(),
                        class: (row['반'] || row['class'] || '1').toString().trim(),
                        gender: (row['성별'] || row['gender'] || 'Male').toString().trim() === '여자' ? 'Female' : 'Male',
                        contact: (row['연락처'] || row['contact'] || '').toString().trim(),
                        applicationStatus: 'reviewed' as const
                    };
                }).filter(Boolean) as any[];

                if (newStudents.length === 0) return;
                await updateStudentsInBatch(newStudents);
                toast({ title: t('success'), description: t('admin.student_management.batch_upload.success', { count: newStudents.length }) });
            }
        });
    };

    return (
        <div className="space-y-6" onContextMenu={(e) => { e.preventDefault(); setSelectedSeat(null); }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {unassignableStudents.length > 0 && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4"/>
                            <AlertTitle>{t('admin.student_management.unassignable.title')}</AlertTitle>
                            <AlertDescription>
                                <div className="mt-2 space-y-1 max-h-[300px] overflow-y-auto pr-2">
                                    {unassignableStudents.map(s => (
                                        <div key={s.id} className="text-xs flex justify-between items-center border-b border-destructive/20 py-1.5 cursor-pointer hover:bg-destructive/10" onClick={() => setSelectedGlobalStudent(s)}>
                                            <span className="font-medium">{s.name} ({s.grade} {s.class})</span>
                                            <span className="text-[10px]">{s.errorReason}</span>
                                        </div>
                                    ))}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>{t('admin.student_management.seat.title')} {currentRoute && `(${assignedStudentsCount}명)`}</CardTitle>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={handleRandomAssign} disabled={!currentRoute} title={t('admin.student_management.seat.random_assign_button')}>
                                    <Shuffle className="h-4 w-4" />
                                </Button>
                                <Dialog open={isCopySeatingDialogOpen} onOpenChange={setIsCopySeatingDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" size="sm" disabled={!currentRoute} title={t('admin.student_management.seat.copy.button')}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>{t('admin.student_management.seat.copy.title')}</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div>
                                                <Label>{t('admin.student_management.seat.copy.select_days')}</Label>
                                                <div className="grid grid-cols-3 gap-2 mt-2">
                                                    {dayOrder.map(day => (
                                                        <div key={`seating-day-${day}`} className="flex items-center space-x-2">
                                                            <Checkbox 
                                                                id={`seating-day-${day}`} 
                                                                checked={!!daysToCopySeatingTo[day]} 
                                                                onCheckedChange={(checked) => setDaysToCopySeatingTo(prev => ({ ...prev, [day]: checked as boolean }))} 
                                                            />
                                                            <Label htmlFor={`seating-day-${day}`}>{t(`day.${day.toLowerCase()}`)}</Label>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div>
                                                <Label>{t('admin.student_management.seat.copy.select_route_types')}</Label>
                                                <div className="flex items-center space-x-4 mt-2">
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox 
                                                            id="seating-type-morning" 
                                                            checked={!!routeTypesToCopySeatingTo.Morning} 
                                                            onCheckedChange={(checked) => setRouteTypesToCopySeatingTo(prev => ({ ...prev, Morning: checked as boolean }))} 
                                                        />
                                                        <Label htmlFor="seating-type-morning">{t('route_type.morning')}</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Checkbox 
                                                            id="seating-type-afternoon" 
                                                            checked={!!routeTypesToCopySeatingTo.Afternoon} 
                                                            onCheckedChange={(checked) => setRouteTypesToCopySeatingTo(prev => ({ ...prev, Afternoon: checked as boolean }))} 
                                                        />
                                                        <Label htmlFor="seating-type-afternoon">{t('route_type.afternoon')}</Label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button onClick={handleCopySeating} className="w-full">{t('copy')}</Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                <Button variant="outline" size="sm" onClick={async () => { 
                                    if (currentRoute && selectedBus) await handleSeatUpdate(generateInitialSeating(selectedBus.capacity)); 
                                }}>
                                    <RotateCcw className="h-4 w-4"/>
                                </Button>
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
                                    highlightedSeatNumber={selectedSeat?.seatNumber} 
                                    highlightedStudentId={selectedGlobalStudent?.id} 
                                    routeType={selectedRouteType} 
                                    dayOfWeek={selectedDay}
                                />
                            ) : (
                                <div className="text-center py-20 text-muted-foreground">버스를 선택해주세요.</div>
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
                        unassignedTitle={t('admin.student_management.unassigned.title', { routeType: getRouteTypeLabel(selectedRouteType) })} 
                        selectedRouteType={selectedRouteType} 
                        selectedDay={selectedDay} 
                        handleDownloadUnassignedStudents={() => {}} 
                        handleToggleSelectAll={() => {
                            if (selectedStudentIds.size === filteredUnassignedStudents.length) setSelectedStudentIds(new Set());
                            else setSelectedStudentIds(new Set(filteredUnassignedStudents.map(s => s.id)));
                        }} 
                        handleDeleteSelectedStudents={() => deleteStudentsInBatch(Array.from(selectedStudentIds))} 
                        handleToggleStudentSelection={(id, checked) => {
                            const next = new Set(selectedStudentIds);
                            if (checked) next.add(id); else next.delete(id);
                            setSelectedStudentIds(next);
                        }} 
                        handleUnassignedStudentClick={setSelectedGlobalStudent} 
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
                        handleGlobalStudentClick={setSelectedGlobalStudent} 
                        handleDownloadAllStudents={handleDownloadAllStudents} 
                        handleDownloadStudentTemplate={() => {}} 
                        fileInputRef={fileInputRef} 
                        handleStudentFileUpload={handleStudentFileUpload} 
                        handleDeleteAllStudents={() => deleteStudentsInBatch(students.map(s => s.id))} 
                        handleUnassignAllFromStudent={() => unassignStudentFromAllRoutes(selectedGlobalStudent?.id || '')} 
                        handleAssignStudentFromSearch={handleAssignStudentFromSearch} 
                        handleStudentInfoChange={(sid, f, v) => updateStudent(sid, { [f]: v })} 
                        handleDestinationChange={handleDestinationChangeWrapper} 
                        handleUnassignStudentFromRoute={(rid, sid) => {
                            const r = routes.find(x => x.id === rid);
                            if (r) {
                                const next = r.seating.map(seat => seat.studentId === sid ? { ...seat, studentId: null } : seat);
                                updateRouteSeating(rid, next);
                            }
                        }} 
                        assignedRoutesForSelectedStudent={assignedRoutesForSelectedStudent}
                    />
                </div>
            </div>
        </div>
    );
};
