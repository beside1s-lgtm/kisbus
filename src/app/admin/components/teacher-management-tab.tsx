'use client';

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { 
    addTeachersInBatch, clearTeachers, updateBus, deleteTeachersInBatch,
    addAfterSchoolTeachersInBatch, deleteAfterSchoolTeachersInBatch, clearAfterSchoolTeachers,
    updateTeacher, updateAfterSchoolTeacher, updateSaturdayTeacher,
    addSaturdayTeachersInBatch, clearSaturdayTeachers, deleteSaturdayTeachersInBatch
} from '@/lib/firebase-data';
import { sanitizeDataForSystem } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import type { Teacher, NewTeacher, Bus, Route, DayOfWeek, Destination } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Upload, Trash2, UserCog, UserX, Pencil, Users, Undo2, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';

interface TeacherEditDialogProps {
    teacher: Teacher;
    type: 'commute' | 'afterSchool' | 'saturday';
}

const TeacherEditDialog = ({ teacher, type }: TeacherEditDialogProps) => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [name, setName] = useState(teacher.name);
    const [days, setDays] = useState<DayOfWeek[]>(teacher.afterSchoolDays || []);
    const [isOpen, setIsOpen] = useState(false);

    const handleSave = async () => {
        try {
            const data: Partial<Teacher> = { 
                name: sanitizeDataForSystem(name),
                ...(type === 'afterSchool' ? { afterSchoolDays: days } : {})
            };
            if (type === 'commute') {
                await updateTeacher(teacher.id, data);
            } else if (type === 'afterSchool') {
                await updateAfterSchoolTeacher(teacher.id, data);
            } else {
                await updateSaturdayTeacher(teacher.id, data);
            }
            toast({ title: t('success'), description: t('admin.teacher_management.edit.success') });
            setIsOpen(false);
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_management.edit.error'), variant: 'destructive' });
        }
    };

    const toggleDay = (day: DayOfWeek) => {
        setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('admin.teacher_management.edit.title')}</DialogTitle>
                    <DialogDescription>
                        교사 정보를 수정합니다.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">{t('admin.teacher_management.teacher_name')}</Label>
                        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    {type === 'afterSchool' && (
                        <div className="space-y-2">
                            <Label>담당 가능 요일 (미선택 시 전체 가능)</Label>
                            <div className="grid grid-cols-5 gap-2">
                                {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as DayOfWeek[]).map(d => (
                                    <Button 
                                        key={d} 
                                        type="button"
                                        variant={days.includes(d) ? "default" : "outline"} 
                                        size="sm" 
                                        className="h-8 text-xs px-1"
                                        onClick={() => toggleDay(d)}
                                    >
                                        {t(`day_short.${d.toLowerCase()}`)}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsOpen(false)}>{t('cancel')}</Button>
                    <Button onClick={handleSave}>{t('save')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const sortBuses = (buses: Bus[]): Bus[] => {
    return [...buses].sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ''), 10);
      const numB = parseInt(b.name.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.name.localeCompare(b.name, 'ko');
    });
};

interface TeacherAssignmentDialogProps {
    targetBus: Bus;
    allRoutes: Route[];
    teachers: Teacher[];
    assignmentType: 'commute' | 'afterSchool' | 'saturday';
    onOpenChange: (open: boolean) => void;
}
  
const TeacherAssignmentDialog = ({ targetBus, allRoutes, teachers, assignmentType, onOpenChange }: TeacherAssignmentDialogProps) => {
    const [selectedTeachersPerDay, setSelectedTeachersPerDay] = useState<Record<DayOfWeek, string[]>>({} as any);
    const [activeDay, setActiveDay] = useState<DayOfWeek>('Monday');
    const { toast } = useToast();
    const { t } = useTranslation();
    const weekdays: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], []);
    const afterSchoolDays: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], []);

    const relevantRoutes = useMemo(() => {
        if (assignmentType === 'commute') {
            return allRoutes.filter(r => r.busId === targetBus.id && weekdays.includes(r.dayOfWeek) && r.type === 'Afternoon');
        } else if (assignmentType === 'afterSchool') {
            return allRoutes.filter(r => r.busId === targetBus.id && r.type === 'AfterSchool');
        } else {
            return allRoutes.filter(r => r.busId === targetBus.id && r.dayOfWeek === 'Saturday');
        }
    }, [allRoutes, targetBus, assignmentType, weekdays]);

    useEffect(() => {
        const initial: any = {};
        relevantRoutes.forEach(r => {
            initial[r.dayOfWeek] = r.teacherIds || [];
        });
        setSelectedTeachersPerDay(initial);
    }, [relevantRoutes]);
    
    const handleSave = async () => {
        if (relevantRoutes.length === 0) return;
        
        try {
            const batch = writeBatch(db);
            if (assignmentType === 'commute') {
                const globalCommuteIds = selectedTeachersPerDay['Monday'] || []; // default to Monday for global if needed
                relevantRoutes.forEach(route => {
                    batch.update(doc(db, 'routes', route.id), { teacherIds: globalCommuteIds });
                });
            } else if (assignmentType === 'afterSchool') {
                relevantRoutes.forEach(route => {
                    if (selectedTeachersPerDay[route.dayOfWeek]) {
                        batch.update(doc(db, 'routes', route.id), { teacherIds: selectedTeachersPerDay[route.dayOfWeek] });
                    }
                });
            } else {
                const saturdayIds = selectedTeachersPerDay['Saturday'] || [];
                relevantRoutes.forEach(route => {
                    batch.update(doc(db, 'routes', route.id), { teacherIds: saturdayIds });
                });
            }
            await batch.commit();
            toast({ title: t('success'), description: t('admin.teacher_assignment.change.success') });
            onOpenChange(false);
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.change.error'), variant: "destructive" });
        }
    };

    const setTeacherForSlot = (day: DayOfWeek, slot: 0 | 1, teacherId: string) => {
        setSelectedTeachersPerDay(prev => {
            const current = [...(prev[day] || [])];
            if (teacherId === 'none') {
                 if (slot === 0) { current[0] = ''; }
                 else { current[1] = ''; }
            } else {
                 current[slot] = teacherId;
            }
            return { ...prev, [day]: current };
        });
    }

    const eligibleTeachers = useMemo(() => {
        if (assignmentType === 'commute') return teachers;
        return teachers.filter(t => !t.afterSchoolDays || t.afterSchoolDays.includes(activeDay));
    }, [teachers, activeDay, assignmentType]);

    const sortedTeachers = useMemo(() => [...eligibleTeachers].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [eligibleTeachers]);
    
    return (
        <DialogContent className="max-w-lg">
            <DialogHeader>
                <DialogTitle>{t('admin.teacher_assignment.change.title')} - {targetBus.name}</DialogTitle>
                <CardDescription>
                    {assignmentType === 'commute' ? "평일 하교 노선 담당교사 변경" : 
                     assignmentType === 'afterSchool' ? "요일별 방과후 담당교사(1-5주, 6-10주) 변경" : 
                     "토요일 등하교 담당교사 변경"}
                </CardDescription>
            </DialogHeader>

            {assignmentType === 'afterSchool' ? (
                <div className="space-y-6 py-4">
                    <Tabs value={activeDay} onValueChange={(v) => setActiveDay(v as DayOfWeek)} className="w-full">
                        <TabsList className="grid grid-cols-4">
                            {afterSchoolDays.map(day => <TabsTrigger key={day} value={day}>{t(`day_short.${day.toLowerCase()}`)}</TabsTrigger>)}
                        </TabsList>
                        {afterSchoolDays.map(day => (
                            <TabsContent key={day} value={day} className="space-y-4 pt-4 border rounded-md p-4 bg-muted/20">
                                <div className="space-y-3">
                                    <div className="grid gap-2">
                                        <Label className="text-xs font-bold text-primary">1 ~ 5주 담당 교사</Label>
                                        <Select 
                                            value={selectedTeachersPerDay[day]?.[0] || 'none'} 
                                            onValueChange={(v) => setTeacherForSlot(day, 0, v)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="교사 선택" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">미지정</SelectItem>
                                                {sortedTeachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="text-xs font-bold text-primary">6 ~ 10주 담당 교사</Label>
                                        <Select 
                                            value={selectedTeachersPerDay[day]?.[1] || 'none'} 
                                            onValueChange={(v) => setTeacherForSlot(day, 1, v)}
                                        >
                                            <SelectTrigger><SelectValue placeholder="교사 선택" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">미지정</SelectItem>
                                                {sortedTeachers.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </div>
            ) : (
                <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                    {sortedTeachers.map(teacher => (
                        <div key={teacher.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={`teacher-${teacher.id}`}
                                checked={(selectedTeachersPerDay[assignmentType === 'commute' ? 'Monday' : 'Saturday'] || []).includes(teacher.id)}
                                onCheckedChange={(checked) => {
                                    const dayKey = assignmentType === 'commute' ? 'Monday' : 'Saturday';
                                    const current = [...(selectedTeachersPerDay[dayKey] || [])];
                                    const next = checked ? [...current, teacher.id] : current.filter(id => id !== teacher.id);
                                    setSelectedTeachersPerDay(prev => ({ ...prev, [dayKey]: next }));
                                }}
                            />
                            <Label htmlFor={`teacher-${teacher.id}`}>{teacher.name}</Label>
                        </div>
                    ))}
                </div>
            )}

            <DialogFooter className="justify-end gap-2">
                 <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
                 <Button onClick={handleSave}>{t('save')}</Button>
            </DialogFooter>
        </DialogContent>
    );
};

interface TeacherManagementTabProps {
    teachers: Teacher[];
    afterSchoolTeachers: Teacher[];
    saturdayTeachers: Teacher[];
    buses: Bus[];
    routes: Route[];
    destinations: Destination[];
}

export const TeacherManagementTab = ({ teachers, afterSchoolTeachers, saturdayTeachers, buses, routes, destinations }: TeacherManagementTabProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { t } = useTranslation();
    const [teacherAssignmentType, setTeacherAssignmentType] = useState<'commute' | 'afterSchool' | 'saturday'>('commute');
    const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);
    const [selectedBusForTeacher, setSelectedBusForTeacher] = useState<Bus | null>(null);
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
    const [previousRouteAssignments, setPreviousRouteAssignments] = useState<Record<string, string[]> | null>(null);
    const [afterSchoolPoolDayFilter, setAfterSchoolPoolDayFilter] = useState<DayOfWeek | 'All'>('All');

    const currentTeacherPool = useMemo(() => {
        if (teacherAssignmentType === 'commute') return teachers;
        if (teacherAssignmentType === 'afterSchool') {
            if (afterSchoolPoolDayFilter !== 'All') {
                return afterSchoolTeachers.filter(t => !t.afterSchoolDays || t.afterSchoolDays.length === 0 || t.afterSchoolDays.includes(afterSchoolPoolDayFilter));
            }
            return afterSchoolTeachers;
        }
        return saturdayTeachers;
    }, [teacherAssignmentType, teachers, afterSchoolTeachers, saturdayTeachers, afterSchoolPoolDayFilter]);
    const sortedTeachersList = useMemo(() => [...currentTeacherPool].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [currentTeacherPool]);

    const isBusOperational = useCallback((busId: string) => {
        let categoryRoutes: Route[] = [];
        if (teacherAssignmentType === 'commute') {
            categoryRoutes = routes.filter(r => r.busId === busId && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && r.type === 'Afternoon');
        } else if (teacherAssignmentType === 'afterSchool') {
            categoryRoutes = routes.filter(r => r.busId === busId && r.type === 'AfterSchool');
        } else {
            categoryRoutes = routes.filter(r => r.busId === busId && r.dayOfWeek === 'Saturday');
        }
        // A bus is only "operational" for teacher assignment if it has both stops AND students assigned.
        return categoryRoutes.some(r => (r.stops?.length ?? 0) > 0 && r.seating.some(s => s.studentId !== null));
    }, [routes, teacherAssignmentType]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const XLSX = await import('xlsx');
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const results: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
                
                const newTeachersData: NewTeacher[] = results.map((row: any) => {
                    const nameRaw = (row['선생님 이름'] || row['name'] || row['이름'] || row['Teacher Name'] || row['Teacher'] || row['선생님'] || '').toString().trim();
                    const daysStr = (row['방과후요일'] || row['days'] || row['Days'] || row['요일'] || '').toString();
                    
                    const sanitizeName = (val: string) => {
                        return val.replace(/\(.*\)/g, '').trim(); 
                    };
                    
                    const name = sanitizeName(nameRaw);
                    let afterSchoolDays: DayOfWeek[] | undefined = undefined;
                    if (daysStr && teacherAssignmentType === 'afterSchool') {
                        const dayTokens = daysStr.split(/[,/|]/).map((s: string) => s.trim());
                        const mapping: Record<string, DayOfWeek> = { '월': 'Monday', '화': 'Tuesday', '수': 'Wednesday', '목': 'Thursday', '금': 'Friday', '토': 'Saturday' };
                        const foundDays: DayOfWeek[] = [];
                        dayTokens.forEach((tk: string) => {
                            for (const [ko, en] of Object.entries(mapping)) {
                                if (tk.includes(ko) || tk.toLowerCase().includes(en.toLowerCase())) {
                                    foundDays.push(en);
                                }
                            }
                        });
                        if (foundDays.length > 0) afterSchoolDays = Array.from(new Set(foundDays));
                    }
                    const result: NewTeacher = { name };
                    if (afterSchoolDays !== undefined) result.afterSchoolDays = afterSchoolDays;
                    return result;
                }).filter(teacher => teacher.name);

                if (newTeachersData.length === 0) {
                    toast({ title: t('error'), description: t('admin.teacher_management.batch.validation_error'), variant: "destructive" });
                    return;
                }
                const { dismiss } = toast({ title: t('processing'), description: t('admin.teacher_management.batch.processing') });
                try {
                    if (teacherAssignmentType === 'commute') {
                        await addTeachersInBatch(newTeachersData);
                    } else if (teacherAssignmentType === 'afterSchool') {
                        await addAfterSchoolTeachersInBatch(newTeachersData);
                    } else {
                        await addSaturdayTeachersInBatch(newTeachersData);
                    }
                    dismiss();
                    toast({ title: t('success'), description: t('admin.teacher_management.batch.success', { count: newTeachersData.length }) });
                } catch (error) {
                    dismiss();
                    toast({ title: t('error'), description: t('admin.teacher_management.batch.error'), variant: "destructive" });
                }
            } catch (err: any) {
                toast({ title: t('admin.file_parse_error'), description: err.message, variant: "destructive" });
            }
        };
        reader.readAsArrayBuffer(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const handleDownloadTemplate = () => {
        import('xlsx').then(XLSX => {
            const headers = teacherAssignmentType === 'afterSchool' ? ["선생님 이름", "방과후요일"] : ["선생님 이름"];
            const examples = teacherAssignmentType === 'afterSchool' ? [
                ["Hong-Gildong", "월/수/금"],
                ["Kim-Cheolsu", "화목"],
                ["Jeong-Jaehyung", "전체"]
            ] : [
                ["Hong-Gildong"]
            ];
            const wsData = [headers, ...examples];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "교사_등록_템플릿");
            XLSX.writeFile(wb, `teacher_template_${teacherAssignmentType}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    const handleDownloadTeacherList = () => {
        if (currentTeacherPool.length === 0) {
            toast({ title: t('notice'), description: "다운로드할 교사 데이터가 없습니다." });
            return;
        }
        import('xlsx').then(XLSX => {
            const headers = ["선생님 이름"];
            const wsData = [
                headers,
                ...currentTeacherPool.map(t => [t.name])
            ];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "교사_목록");
            XLSX.writeFile(wb, `KIS_Teacher_List_${teacherAssignmentType}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    const handleClearAllTeachers = async () => {
        try {
            if (teacherAssignmentType === 'commute') {
                await clearTeachers();
            } else if (teacherAssignmentType === 'afterSchool') {
                await clearAfterSchoolTeachers();
            } else {
                await clearSaturdayTeachers();
            }
            setSelectedTeacherIds(new Set());
            toast({ title: t('success'), description: "모든 교사 정보가 삭제되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "교사 정보 삭제 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleToggleTeacherSelection = (teacherId: string, checked: boolean) => {
        setSelectedTeacherIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(teacherId);
            else next.delete(teacherId);
            return next;
        });
    };

    const handleToggleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedTeacherIds(new Set(currentTeacherPool.map(t => t.id)));
        } else {
            setSelectedTeacherIds(new Set());
        }
    };

    const handleDeleteSelectedTeachers = async () => {
        const ids = Array.from(selectedTeacherIds);
        if (ids.length === 0) return;

        const { dismiss } = toast({ title: t('processing'), description: t('admin.teacher_management.batch.processing') });
        try {
            if (teacherAssignmentType === 'commute') {
                await deleteTeachersInBatch(ids);
            } else if (teacherAssignmentType === 'afterSchool') {
                await deleteAfterSchoolTeachersInBatch(ids);
            } else {
                await deleteSaturdayTeachersInBatch(ids);
            }
            setSelectedTeacherIds(new Set());
            dismiss();
            toast({ title: t('success'), description: t('admin.teacher_management.delete_success_count', { count: ids.length }) });
        } catch (error) {
            dismiss();
            toast({ title: t('error'), description: t('admin.teacher_management.delete.error'), variant: 'destructive' });
        }
    };

    const getAssignedTeachers = (busId: string) => {
        let busRoutes: Route[] = [];
        if (teacherAssignmentType === 'commute') {
            busRoutes = routes.filter(r => r.busId === busId && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && r.type === 'Afternoon');
        } else if (teacherAssignmentType === 'afterSchool') {
            busRoutes = routes.filter(r => r.busId === busId && r.type === 'AfterSchool');
        } else {
            busRoutes = routes.filter(r => r.busId === busId && r.dayOfWeek === 'Saturday');
        }

        const teacherIds = Array.from(new Set(busRoutes.flatMap(r => r.teacherIds || [])));
        return teacherIds.map(id => {
            const t = currentTeacherPool.find(tp => tp.id === id);
            return { id, name: t?.name || 'Unknown' };
        }).filter(t => t.name !== 'Unknown')
          .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    };

    const handleUnassignTeacher = async (busId: string, teacherId: string) => {
        let routesToUpdate: Route[] = [];
        if (teacherAssignmentType === 'commute') {
            routesToUpdate = routes.filter(r => r.busId === busId && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && r.type === 'Afternoon');
        } else if (teacherAssignmentType === 'afterSchool') {
            routesToUpdate = routes.filter(r => r.busId === busId && r.type === 'AfterSchool');
        } else {
            routesToUpdate = routes.filter(r => r.busId === busId && r.dayOfWeek === 'Saturday');
        }

        if (routesToUpdate.length === 0) return;

        try {
            const batch = writeBatch(db);
            routesToUpdate.forEach(route => {
                const newIds = (route.teacherIds || []).filter(id => id !== teacherId);
                if (newIds.length !== (route.teacherIds || []).length) {
                    batch.update(doc(db, 'routes', route.id), { teacherIds: newIds });
                }
            });
            await batch.commit();
            toast({ title: t('success'), description: "교사 배정이 해제되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "배정 해제 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const getTeachersForBus = (busId: string) => {
        if (teacherAssignmentType === 'afterSchool') {
            // Summary for after-school: Show Monday as default or 'Assigned'
            const busAllDays = routes.filter(r => r.busId === busId && r.type === 'AfterSchool');
            const assignedCount = busAllDays.filter(r => (r.teacherIds || []).length > 0).length;
            if (assignedCount === 0) return t('unassigned');
            return `${assignedCount}개 요일 배정됨`;
        } else {
            const dayKey = teacherAssignmentType === 'commute' ? 'Monday' : 'Saturday';
            const relevantRouteType = teacherAssignmentType === 'commute' ? 'Afternoon' : 'Morning'; // Morning for Sat check is fine, or just filter by day
            const relevantRoute = routes.find(r => r.busId === busId && r.dayOfWeek === dayKey && (teacherAssignmentType === 'commute' ? r.type === 'Afternoon' : true));
            if (!relevantRoute || !relevantRoute.teacherIds) return t('unassigned');
            const names = relevantRoute.teacherIds.map(id => currentTeacherPool.find(t => t.id === id)?.name).filter(Boolean);
            return names.length > 0 ? names.join(', ') : t('unassigned');
        }
    };

    const handleBatchAssignTeachers = async () => {
        if (currentTeacherPool.length === 0) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.assign.no_teacher_error'), variant: 'destructive' });
            return;
        }

        const batch = writeBatch(db);
        const backup: Record<string, string[]> = {};
        const daysToAssign: DayOfWeek[] = teacherAssignmentType === 'commute' 
            ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] 
            : ['Monday', 'Tuesday', 'Wednesday', 'Thursday'];

        // Backup current assignments
        routes.filter(r => daysToAssign.includes(r.dayOfWeek) && r.type === (teacherAssignmentType === 'commute' ? 'Afternoon' : 'AfterSchool'))
            .forEach(r => { backup[r.id] = r.teacherIds || []; });
        setPreviousRouteAssignments(backup);

        if (teacherAssignmentType === 'commute' || teacherAssignmentType === 'saturday') {
            const dayKey = teacherAssignmentType === 'commute' ? 'Monday' : 'Saturday';
            const targetBuses = sortBuses(buses.filter(bus => !bus.excludeFromAssignment && (bus.isActive ?? true) && isBusOperational(bus.id)));
            if (targetBuses.length === 0) {
                toast({ title: t('notice'), description: t('admin.teacher_assignment.assign.no_operational_buses') });
                return;
            }
            const availableTeachers = [...currentTeacherPool].sort(() => Math.random() - 0.5);
            let teacherIndex = 0;
            for (const bus of targetBuses) {
                const assignedIds: string[] = [];
                if (teacherIndex < availableTeachers.length) assignedIds.push(availableTeachers[teacherIndex++].id);
                // Extra teacher for 45-seaters if available
                if (bus.capacity === 45 && teacherIndex < availableTeachers.length) assignedIds.push(availableTeachers[teacherIndex++].id);
                
                routes.filter(r => r.busId === bus.id && (teacherAssignmentType === 'commute' ? daysToAssign.includes(r.dayOfWeek) && r.type === 'Afternoon' : r.dayOfWeek === 'Saturday'))
                    .forEach(r => batch.update(doc(db, 'routes', r.id), { teacherIds: assignedIds }));
            }
        } else {
            // After-School logic: Day by Day
            for (const day of daysToAssign) {
                const dayRoutes = routes.filter(r => r.dayOfWeek === day && r.type === 'AfterSchool' && (r.stops?.length ?? 0) > 0);
                const dayBuses = sortBuses(buses.filter(b => !b.excludeFromAssignment && (b.isActive ?? true) && dayRoutes.some(r => r.busId === b.id)));
                
                // Available teachers for this specific day
                const dayPool = afterSchoolTeachers.filter(t => !t.afterSchoolDays || t.afterSchoolDays.includes(day));
                const shuffledTeachers = [...dayPool].sort(() => Math.random() - 0.5);
                
                let teacherIndex = 0;
                for (const bus of dayBuses) {
                    const assignedIds: string[] = [];
                    // Slot 1 (1-5 weeks)
                    if (teacherIndex < shuffledTeachers.length) assignedIds.push(shuffledTeachers[teacherIndex++].id);
                    // Slot 2 (6-10 weeks)
                    if (teacherIndex < shuffledTeachers.length) assignedIds.push(shuffledTeachers[teacherIndex++].id);
                    
                    const route = dayRoutes.find(r => r.busId === bus.id);
                    if (route) {
                        batch.update(doc(db, 'routes', route.id), { teacherIds: assignedIds });
                    }
                }
            }
        }

        try {
            await batch.commit();
            toast({ title: t('success'), description: t('admin.teacher_assignment.assign.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.assign.error'), variant: 'destructive' });
        }
    };

    const handleRestoreAssignments = async () => {
        if (!previousRouteAssignments) return;
        const batch = writeBatch(db);
        Object.entries(previousRouteAssignments).forEach(([routeId, teacherIds]) => {
            batch.update(doc(db, 'routes', routeId), { teacherIds });
        });
        try {
            await batch.commit();
            setPreviousRouteAssignments(null);
            toast({ title: t('success'), description: t('admin.teacher_assignment.undo_success') });
        } catch (error) {
            toast({ title: t('error'), description: "복구 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleUnassignAllTeachers = async () => {
        let routesToClear: Route[] = [];
        if (teacherAssignmentType === 'commute') {
            routesToClear = routes.filter(r => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && r.type === 'Afternoon');
        } else if (teacherAssignmentType === 'afterSchool') {
            routesToClear = routes.filter(r => r.type === 'AfterSchool');
        } else {
            routesToClear = routes.filter(r => r.dayOfWeek === 'Saturday');
        }
        if (routesToClear.length === 0) return;
        const batch = writeBatch(db);
        routesToClear.forEach(route => batch.update(doc(db, 'routes', route.id), { teacherIds: [] }));
        try {
            await batch.commit();
            toast({ title: t('success'), description: t('admin.teacher_assignment.reset.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.reset.error'), variant: 'destructive' });
        }
    };
    
    const handleManualAssignClick = (bus: Bus) => {
        setSelectedBusForTeacher(bus);
        setIsTeacherDialogOpen(true);
    };

    const handleToggleBusExcludeAssignment = async (bus: Bus) => {
        try {
            const newExclude = !(bus.excludeFromAssignment ?? false);
            await updateBus(bus.id, { excludeFromAssignment: newExclude });
            toast({ title: t('success'), description: `"${bus.name}" 버스 배정 제외 상태가 ${newExclude ? '설정' : '해제'}되었습니다.` });
        } catch (error) {
            toast({ title: t('error'), description: "상태 변경 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleDownloadAssignments = useCallback(() => {
        import('xlsx').then(XLSX => {
            const sorted = sortBuses(buses);
            const headers = ["버스 번호", "타입", "담당 교사", "운행 노선", "상태"];
            
            const rows = sorted.map(bus => {
                const isOperational = isBusOperational(bus.id);
                const teachersStr = getTeachersForBus(bus.id);
                
                const relevantRouteType = teacherAssignmentType === 'commute' ? 'Afternoon' : 'AfterSchool';
                const route = routes.find(r => r.busId === bus.id && r.dayOfWeek === 'Monday' && r.type === relevantRouteType);
                const routePath = (route?.stops || [])
                    .map(id => destinations.find(d => d.id === id)?.name)
                    .filter(Boolean)
                    .join(' -> ');

                const statusStr = !(bus.isActive ?? true) ? "비활성" : (bus.excludeFromAssignment ? "배정제외" : (isOperational ? "운행중" : "운행없음"));
                
                return [
                    bus.name,
                    t(`bus_type.${bus.type}`),
                    teachersStr,
                    routePath || "",
                    statusStr
                ];
            });

            const wsData = [headers, ...rows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            const categoryName = teacherAssignmentType === 'commute' ? "하교" : "방과후";
            XLSX.utils.book_append_sheet(wb, ws, "배정현황");
            XLSX.writeFile(wb, `KIS_Bus_Teacher_Assignments_${categoryName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    }, [buses, teacherAssignmentType, isBusOperational, t, routes, destinations, getTeachersForBus]);

    useEffect(() => {
        setSelectedTeacherIds(new Set());
        setPreviousRouteAssignments(null);
    }, [teacherAssignmentType]);

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Users className="h-6 w-6 text-primary" />
                    <CardTitle className="font-headline">{t('admin.teacher_management.title')}</CardTitle>
                </div>
                <CardDescription>{t('admin.teacher_management.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                <div className="flex flex-col gap-4">
                    <Tabs value={teacherAssignmentType} onValueChange={(v) => {
                        setTeacherAssignmentType(v as any);
                        setSelectedTeacherIds(new Set());
                    }} className="w-full">
                        <TabsList className="grid grid-cols-3 max-w-lg">
                            <TabsTrigger value="commute">{t('route_type.commute')}</TabsTrigger>
                            <TabsTrigger value="afterSchool">{t('route_type.AfterSchool')}</TabsTrigger>
                            <TabsTrigger value="saturday">토요일</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <h3 className="text-lg font-semibold">
                                {teacherAssignmentType === 'commute' ? "등하교 담당 교사 명단" : 
                                 teacherAssignmentType === 'afterSchool' ? "방과후 담당 교사 명단" : 
                                 "토요일 담당 교사 명단"}
                            </h3>
                            {teacherAssignmentType === 'afterSchool' && (
                                <div className="flex items-center gap-2 bg-muted p-1 rounded-md">
                                    <span className="text-xs font-semibold px-2">요일 필터:</span>
                                    {(['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'] as const).map(d => (
                                        <Button 
                                            key={d} 
                                            variant={afterSchoolPoolDayFilter === d ? "default" : "ghost"} 
                                            size="sm" 
                                            className="h-7 text-[10px] px-2"
                                            onClick={() => setAfterSchoolPoolDayFilter(d)}
                                        >
                                            {d === 'All' ? '전체' : t(`day_short.${d.toLowerCase()}`)}
                                        </Button>
                                    ))}
                                </div>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={handleDownloadTeacherList}><Download className="mr-2 h-4 w-4" /> 목록 다운로드</Button>
                                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}><Download className="mr-2 h-4 w-4" /> {t('admin.teacher_management.template')}</Button>
                                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> {t('batch_upload')}</Button>
                                
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10" disabled={selectedTeacherIds.size === 0}>
                                            <Trash2 className="mr-2 h-4 w-4" /> {t('delete_selected')}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t('confirm')}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t('admin.teacher_management.delete_selected.confirm_description', { count: selectedTeacherIds.size })}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteSelectedTeachers}>{t('delete')}</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" /> {t('delete_all')}</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t('admin.teacher_management.delete_all.confirm_title')}</AlertDialogTitle>
                                            <AlertDialogDescription>{t('admin.teacher_management.delete_all.confirm_description')}</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleClearAllTeachers}>{t('delete')}</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx" className="hidden" />
                            </div>
                        </div>

                        <div className="border rounded-md max-h-[300px] overflow-y-auto bg-background">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <Checkbox 
                                                checked={selectedTeacherIds.size === currentTeacherPool.length && currentTeacherPool.length > 0}
                                                onCheckedChange={handleToggleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>{t('admin.teacher_management.teacher_name')}</TableHead>
                                        {teacherAssignmentType === 'afterSchool' && <TableHead>담당 가능 요일</TableHead>}
                                        <TableHead className="text-right">{t('actions')}</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {sortedTeachersList.length > 0 ? (
                                        sortedTeachersList.map(teacher => (
                                            <TableRow key={teacher.id}>
                                                <TableCell>
                                                    <Checkbox 
                                                        checked={selectedTeacherIds.has(teacher.id)}
                                                        onCheckedChange={(checked) => handleToggleTeacherSelection(teacher.id, checked as boolean)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{teacher.name}</TableCell>
                                                {teacherAssignmentType === 'afterSchool' && (
                                                    <TableCell>
                                                        <div className="flex gap-1">
                                                            {teacher.afterSchoolDays?.map(day => (
                                                                <Badge key={day} variant="outline" className="text-[10px] py-0">{t(`day_short.${day.toLowerCase()}`)}</Badge>
                                                            )) || <span className="text-xs text-muted-foreground italic">전체</span>}
                                                        </div>
                                                    </TableCell>
                                                )}
                                                <TableCell className="text-right">
                                                    <TeacherEditDialog 
                                                        teacher={teacher} 
                                                        type={teacherAssignmentType}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={teacherAssignmentType === 'afterSchool' ? 4 : 3} className="text-center py-8 text-muted-foreground">
                                                등록된 교사가 없습니다.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>

                <Separator />

                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <h3 className="text-lg font-semibold">{t('admin.teacher_assignment.title')} (명단 기반)</h3>
                        <div className="flex gap-2 w-full md:w-auto flex-wrap">
                            <Button variant="outline" size="sm" onClick={handleDownloadAssignments} className="flex-1 sm:flex-none">
                                <Download className="mr-2 h-4 w-4"/> 배정 현황 다운로드
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleBatchAssignTeachers} className="flex-1 sm:flex-none">
                                <UserCog className="mr-2 h-4 w-4"/>{t('admin.teacher_assignment.reassign')}
                            </Button>
                            {previousRouteAssignments && (
                                <Button variant="outline" size="sm" onClick={handleRestoreAssignments} className="flex-1 sm:flex-none text-blue-600 border-blue-200 hover:bg-blue-50">
                                    <Undo2 className="mr-2 h-4 w-4"/>{t('admin.teacher_assignment.undo')}
                                </Button>
                            )}
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10 flex-1 sm:flex-none">
                                        <UserX className="mr-2 h-4 w-4"/>{t('reset')}</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t('admin.teacher_assignment.reset.confirm_title')}</AlertDialogTitle>
                                        <AlertDialogDescription>{t('admin.teacher_assignment.reset.confirm_description')}</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleUnassignAllTeachers}>{t('confirm')}</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>배정 제외</TableHead>
                                    <TableHead>{t('admin.bus_registration.bus_number')}</TableHead>
                                    <TableHead>{t('type')}</TableHead>
                                    <TableHead>{t('admin.teacher_assignment.title')}</TableHead>
                                    <TableHead className="text-right">{t('actions')}</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortBuses(buses).map(bus => {
                                    const isOperational = isBusOperational(bus.id);
                                    return (
                                        <TableRow key={bus.id} className={cn(
                                            !(bus.isActive ?? true) && "text-muted-foreground bg-muted/20",
                                            !isOperational && "opacity-60 bg-yellow-50/30"
                                        )}>
                                            <TableCell>
                                                <Switch
                                                    checked={bus.excludeFromAssignment ?? false}
                                                    onCheckedChange={() => handleToggleBusExcludeAssignment(bus)}
                                                    aria-label="Toggle bus assignment exclude state"
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium whitespace-nowrap">
                                                {bus.name}
                                                {!isOperational && (bus.isActive ?? true) && (
                                                    <Badge variant="outline" className="ml-2 text-[10px] py-0 h-4 border-yellow-300 text-yellow-700 bg-yellow-50">운행없음</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>{t(`bus_type.${bus.type}`)}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {(() => {
                                                        const assignedTeachers = getAssignedTeachers(bus.id);
                                                        if (assignedTeachers.length === 0) {
                                                            return <span className="text-muted-foreground italic text-xs">{t('unassigned')}</span>;
                                                        }
                                                        return assignedTeachers.map((teacher, i) => (
                                                            <Badge key={i} variant="secondary" className="font-normal text-xs flex items-center gap-1 pr-1 group">
                                                                {teacher.name}
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleUnassignTeacher(bus.id, teacher.id);
                                                                    }}
                                                                    className="h-3 w-3 hover:bg-muted-foreground/30 rounded-full flex items-center justify-center transition-colors focus:outline-none"
                                                                    title={t('unassign')}
                                                                >
                                                                    <X className="h-2 w-2" />
                                                                </button>
                                                            </Badge>
                                                        ));
                                                    })()}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleManualAssignClick(bus)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>

            {selectedBusForTeacher && (
              <Dialog open={isTeacherDialogOpen} onOpenChange={setIsTeacherDialogOpen}>
                <TeacherAssignmentDialog 
                    targetBus={selectedBusForTeacher} 
                    allRoutes={routes} 
                    teachers={currentTeacherPool} 
                    assignmentType={teacherAssignmentType}
                    onOpenChange={setIsTeacherDialogOpen} 
                />
              </Dialog>
            )}
        </Card>
    );
};
