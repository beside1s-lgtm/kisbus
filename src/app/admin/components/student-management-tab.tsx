'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { 
    addStudent, updateStudent, deleteStudentsInBatch, updateRouteSeating,
    copySeatingPlan, unassignStudentFromAllRoutes, updateStudentsInBatch
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, NewStudent } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Shuffle, UserPlus, RotateCcw, Copy, Bell, Undo2, AlertCircle, Users, Upload, Download } from 'lucide-react';
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
    const afterSchoolFileInputRef = useRef<HTMLInputElement>(null);
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

    const assignedStudentsCount = useMemo(() => {
        if (!currentRoute) return 0;
        return currentRoute.seating.filter(s => !!s.studentId).length;
    }, [currentRoute]);

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
                if (selectedRouteType === 'Morning') { destId = student.satMorningDestinationId; errorKey = 'admin.student_management.unassignable.error_sat_morning'; }
                else { destId = student.satAfternoonDestinationId; errorKey = 'admin.student_management.unassignable.error_sat_afternoon'; }
            } else {
                if (selectedRouteType === 'Morning') { destId = student.morningDestinationId; errorKey = 'admin.student_management.unassignable.error_morning'; }
                else if (selectedRouteType === 'Afternoon') { destId = student.afternoonDestinationId; errorKey = 'admin.student_management.unassignable.error_afternoon'; }
                else if (selectedRouteType === 'AfterSchool') { destId = student.afterSchoolDestinations?.[selectedDay] || null; errorKey = 'admin.student_management.unassignable.error_after_school'; }
            }
            if (destId && !validStopIds.has(destId)) {
                const destName = destinations.find(d => d.id === destId)?.name || '알 수 없음';
                unassignables.push({ ...student, errorReason: `${t(errorKey, { day: t(`day_short.${selectedDay.toLowerCase()}`) })} (${destName})` });
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
        if (selectedBusId === 'all') routes.filter(r => r.dayOfWeek === selectedDay && r.type === selectedRouteType).forEach(r => r.stops.forEach(s => targetStopIds.add(s)));
        else if (currentRoute) currentRoute.stops.forEach(s => targetStopIds.add(s));

        let unassigned = students.filter(s => {
            if (allAssignedIds.has(s.id)) return false;
            const destId = getStudentDestId(s);
            if (!destId) return false;
            if (unassignedView === 'current') return targetStopIds.has(destId);
            return true;
        });
        if (unassignedSearchQuery) {
            const lq = normalizeString(unassignedSearchQuery);
            unassigned = unassigned.filter(s => normalizeString(s.name).includes(lq) || (s.contact && s.contact.includes(unassignedSearchQuery.replace(/\D/g, ''))));
        }
        setFilteredUnassignedStudents(unassigned.sort((a, b) => a.name.localeCompare(b.name, 'ko')));
    }, [students, routes, currentRoute, selectedRouteType, selectedDay, unassignedSearchQuery, unassignedView, selectedBusId]);

    const handleSeatUpdate = useCallback(async (newSeating: any) => { if (currentRoute) await updateRouteSeating(currentRoute.id, newSeating); }, [currentRoute]);
    const handleStudentCardClick = useCallback(async (sid: string) => {
        if (currentRoute && selectedSeat && !selectedSeat.studentId) {
            const next = [...currentRoute.seating];
            const idx = next.findIndex(s => s.seatNumber === selectedSeat.seatNumber);
            if (idx > -1) { next[idx].studentId = sid; await handleSeatUpdate(next); setSelectedSeat(null); }
        }
    }, [currentRoute, selectedSeat, handleSeatUpdate]);

    const handleSeatClick = useCallback(async (num: number, sid: string | null) => {
        if (!currentRoute) return;
        const next = [...currentRoute.seating];
        if (selectedSeat) {
            const sIdx = next.findIndex(x => x.seatNumber === selectedSeat.seatNumber);
            const tIdx = next.findIndex(x => x.seatNumber === num);
            if (selectedSeat.seatNumber === num) next[sIdx].studentId = null;
            else { const temp = next[sIdx].studentId; next[sIdx].studentId = next[tIdx].studentId; next[tIdx].studentId = temp; }
            await handleSeatUpdate(next); setSelectedSeat(null);
        } else setSelectedSeat({ seatNumber: num, studentId: sid });
    }, [currentRoute, selectedSeat, handleSeatUpdate]);

    const handleStudentFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        Papa.parse(file, {
            header: true, skipEmptyLines: true,
            complete: async (res) => {
                const destMap: any = {}; destinations.forEach(d => destMap[normalizeString(d.name)] = d.id);
                const updates: any[] = [];
                res.data.forEach((row: any) => {
                    const name = (row['이름'] || row['Name'] || '').trim(), grade = (row['학년'] || row['Grade'] || '').trim(), sClass = (row['반'] || row['Class'] || '').trim(), contact = sanitizeDataForSystem(row['베트남 전화번호'] || row['연락처'] || '').replace(/\D/g, '');
                    if (name && grade && sClass) {
                        const up: any = { name, grade, class: sClass, contact };
                        const mDest = destMap[normalizeString(row['등교 목적지'] || '')], aDest = destMap[normalizeString(row['하교 목적지'] || '')];
                        if (mDest) up.morningDestinationId = mDest; if (aDest) up.afternoonDestinationId = aDest;
                        updates.push(up);
                    }
                });
                if (!updates.length) { toast({ title: t('error'), variant: 'destructive' }); return; }
                const { dismiss } = toast({ title: t('processing') });
                try { await Promise.all(updates.map(s => addStudent(s))); dismiss(); toast({ title: t('success') }); }
                catch (err) { dismiss(); toast({ title: t('error'), variant: 'destructive' }); }
            }
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="space-y-6" onContextMenu={(e) => { e.preventDefault(); setSelectedSeat(null); }}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {unassignableStudents.length > 0 && (
                        <Alert variant="destructive"><AlertCircle className="h-4 w-4"/><AlertTitle>{t('admin.student_management.unassignable.title')}</AlertTitle><AlertDescription>
                            <div className="mt-2 space-y-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {unassignableStudents.map(s => (
                                    <div key={s.id} className="text-xs flex justify-between items-center border-b border-destructive/20 py-1.5 cursor-pointer hover:bg-destructive/10" onClick={() => setSelectedGlobalStudent(s)}>
                                        <span className="font-medium">{s.name} ({s.grade} {s.class})</span><span className="text-[10px]">{s.errorReason}</span>
                                    </div>
                                ))}
                            </div>
                        </AlertDescription></Alert>
                    )}
                    <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{t('admin.student_management.seat.title')} {currentRoute && `(${assignedStudentsCount}명)`}</CardTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => setAddStudentDialogOpen(true)}><UserPlus className="h-4 w-4 mr-2"/> {t('admin.student_management.add_student.button')}</Button>
                            <Button variant="outline" size="sm" onClick={async () => { if (currentRoute) await handleSeatUpdate(generateInitialSeating(selectedBus!.capacity)); }}><RotateCcw className="h-4 w-4"/></Button>
                        </div>
                    </CardHeader><CardContent>
                        {selectedBus && currentRoute && <BusSeatMap bus={selectedBus} seating={currentRoute.seating} students={students} destinations={destinations} onSeatClick={handleSeatClick} highlightedSeatNumber={selectedSeat?.seatNumber} highlightedStudentId={selectedGlobalStudent?.id} routeType={selectedRouteType} dayOfWeek={selectedDay}/>}
                    </CardContent></Card>
                </div>
                <div className="lg:col-span-1 space-y-4">
                    <StudentUnassignedPanel filteredUnassignedStudents={filteredUnassignedStudents} destinations={destinations} selectedStudentIds={selectedStudentIds} unassignedSearchQuery={unassignedSearchQuery} setUnassignedSearchQuery={setUnassignedSearchQuery} unassignedView={unassignedView} setUnassignedView={setUnassignedView} unassignedTitle={t('admin.student_management.unassigned.title', { routeType: t(`route_type.${selectedRouteType.toLowerCase()}`) })} selectedRouteType={selectedRouteType} selectedDay={selectedDay} handleDownloadUnassignedStudents={() => {}} handleToggleSelectAll={() => {}} handleDeleteSelectedStudents={() => {}} handleToggleStudentSelection={() => {}} handleUnassignedStudentClick={setSelectedGlobalStudent} handleStudentCardClick={handleStudentCardClick}/>
                    <StudentGlobalSearchPanel students={students} destinations={destinations} buses={buses} routes={allRoutes} selectedRouteType={selectedRouteType} dayOrder={dayOrder} selectedGlobalStudent={selectedGlobalStudent} setSelectedGlobalStudent={setSelectedGlobalStudent} globalSearchQuery={globalSearchQuery} setGlobalSearchQuery={setGlobalSearchQuery} globalSearchResults={[]} handleGlobalStudentClick={setSelectedGlobalStudent} handleDownloadAllStudents={() => {}} handleDownloadStudentTemplate={() => {}} fileInputRef={fileInputRef} handleStudentFileUpload={handleStudentFileUpload} handleDeleteAllStudents={() => {}} handleUnassignAllFromStudent={() => {}} handleAssignStudentFromSearch={() => {}} handleStudentInfoChange={(sid, f, v) => updateStudent(sid, { [f]: v })} handleDestinationChange={(sid, vid, type, day) => updateStudent(sid, { [type === 'morning' ? 'morningDestinationId' : 'afternoonDestinationId']: vid })} handleUnassignStudentFromRoute={() => {}} assignedRoutesForSelectedStudent={assignedRoutesForSelectedStudent}/>
                </div>
            </div>
        </div>
    );
};