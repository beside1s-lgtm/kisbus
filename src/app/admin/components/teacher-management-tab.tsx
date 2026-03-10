'use client';

import React, { useRef, useState, useMemo, useEffect, useCallback } from 'react';
import Papa from 'papaparse';
import { 
    addTeachersInBatch, deleteTeacher, deleteAllTeachers, updateBus, deleteTeachersInBatch,
    addAfterSchoolTeachersInBatch, deleteAfterSchoolTeacher, deleteAfterSchoolTeachersInBatch, deleteAllAfterSchoolTeachers
} from '@/lib/firebase-data';
import type { Teacher, NewTeacher, Bus, Route, DayOfWeek, Destination } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Upload, Trash2, UserCog, UserX, Pencil, Users, Undo2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';

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

interface TeacherAssignmentDialogProps {
    targetBus: Bus;
    allRoutes: Route[];
    teachers: Teacher[];
    assignmentType: 'commute' | 'afterSchool';
    onOpenChange: (open: boolean) => void;
}
  
const TeacherAssignmentDialog = ({ targetBus, allRoutes, teachers, assignmentType, onOpenChange }: TeacherAssignmentDialogProps) => {
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
    const { toast } = useToast();
    const { t } = useTranslation();
    const weekdays: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], []);

    const relevantRoutes = useMemo(() => {
        if (assignmentType === 'commute') {
            return allRoutes.filter(r => r.busId === targetBus.id && weekdays.includes(r.dayOfWeek) && r.type === 'Afternoon');
        }
        return allRoutes.filter(r => r.busId === targetBus.id && r.type === 'AfterSchool');
    }, [allRoutes, targetBus, assignmentType, weekdays]);

    useEffect(() => {
        if (relevantRoutes.length > 0) {
            setSelectedTeacherIds(relevantRoutes[0].teacherIds || []);
        }
    }, [relevantRoutes]);
    
    const handleSave = async () => {
        if (relevantRoutes.length === 0) return;
        
        try {
            const batch = writeBatch(db);
            relevantRoutes.forEach(route => {
                const routeRef = doc(db, 'routes', route.id);
                batch.update(routeRef, { teacherIds: selectedTeacherIds });
            });
            await batch.commit();
            toast({ title: t('success'), description: t('admin.teacher_assignment.change.success') });
            onOpenChange(false);
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.change.error'), variant: "destructive" });
        }
    };

    const handleCheckboxChange = (teacherId: string, checked: boolean) => {
        setSelectedTeacherIds(prev =>
            checked ? [...prev, teacherId] : prev.filter(id => id !== teacherId)
        );
    };
    
    const handleReset = () => {
        setSelectedTeacherIds([]);
    }

    const sortedTeachers = useMemo(() => [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [teachers]);
    
    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>{t('admin.teacher_assignment.change.title')} - {targetBus.name}</DialogTitle>
                <CardDescription>
                    {assignmentType === 'commute' ? "평일 하교" : "방과후"} 노선에 대한 담당교사를 변경합니다.
                </CardDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                {sortedTeachers.map(teacher => (
                    <div key={teacher.id} className="flex items-center space-x-2">
                        <Checkbox
                            id={`teacher-${teacher.id}`}
                            checked={selectedTeacherIds.includes(teacher.id)}
                            onCheckedChange={(checked) => handleCheckboxChange(teacher.id, checked as boolean)}
                        />
                        <Label htmlFor={`teacher-${teacher.id}`}>
                            {teacher.name}
                        </Label>
                    </div>
                ))}
            </div>
            <DialogFooter className="justify-between">
                <Button variant="destructive" onClick={handleReset}>{t('reset')}</Button>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
                    <Button onClick={handleSave}>{t('save')}</Button>
                </div>
            </DialogFooter>
        </DialogContent>
    );
};

interface TeacherManagementTabProps {
    teachers: Teacher[];
    afterSchoolTeachers: Teacher[];
    buses: Bus[];
    routes: Route[];
    destinations: Destination[];
}

export const TeacherManagementTab = ({ teachers, afterSchoolTeachers, buses, routes, destinations }: TeacherManagementTabProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { t } = useTranslation();
    const [teacherAssignmentType, setTeacherAssignmentType] = useState<'commute' | 'afterSchool'>('commute');
    const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);
    const [selectedBusForTeacher, setSelectedBusForTeacher] = useState<Bus | null>(null);
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(new Set());
    const [previousRouteAssignments, setPreviousRouteAssignments] = useState<Record<string, string[]> | null>(null);

    const currentTeacherPool = teacherAssignmentType === 'commute' ? teachers : afterSchoolTeachers;
    const sortedTeachersList = useMemo(() => [...currentTeacherPool].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [currentTeacherPool]);

    const isBusOperational = useCallback((busId: string) => {
        let categoryRoutes: Route[] = [];
        if (teacherAssignmentType === 'commute') {
            categoryRoutes = routes.filter(r => r.busId === busId && ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && r.type === 'Afternoon');
        } else {
            categoryRoutes = routes.filter(r => r.busId === busId && r.type === 'AfterSchool');
        }
        return categoryRoutes.some(r => r.stops.length > 0 || r.seating.some(s => s.studentId !== null));
    }, [routes, teacherAssignmentType]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const newTeachersData: NewTeacher[] = results.data.map((row: any) => ({
                    name: (row['선생님 이름'] || row['name'] || '').trim()
                })).filter(teacher => teacher.name);

                if (newTeachersData.length === 0) {
                    toast({ title: t('error'), description: t('admin.teacher_management.batch.validation_error'), variant: "destructive" });
                    return;
                }
                const { dismiss } = toast({ title: t('processing'), description: t('admin.teacher_management.batch.processing') });
                try {
                    if (teacherAssignmentType === 'commute') {
                        await addTeachersInBatch(newTeachersData);
                    } else {
                        await addAfterSchoolTeachersInBatch(newTeachersData);
                    }
                    dismiss();
                    toast({ title: t('success'), description: t('admin.teacher_management.batch.success', { count: newTeachersData.length }) });
                } catch (error) {
                    dismiss();
                    toast({ title: t('error'), description: t('admin.teacher_management.batch.error'), variant: "destructive" });
                }
            },
            error: (error) => {
                toast({ title: t('admin.file_parse_error'), description: error.message, variant: "destructive" });
            }
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const handleDownloadTemplate = () => {
        const headers = "선생님 이름";
        const example = "Hong-Gildong";
        const csvContent = "\uFEFF" + headers + "\n" + example;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement("a"));
        link.setAttribute("href", url);
        link.setAttribute("download", `teacher_template_${teacherAssignmentType}.csv`);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadTeacherList = () => {
        if (currentTeacherPool.length === 0) {
            toast({ title: t('notice'), description: "다운로드할 교사 데이터가 없습니다." });
            return;
        }
        const headers = ["선생님 이름"];
        const csvRows = currentTeacherPool.map(t => `"${t.name.replace(/"/g, '""')}"`);
        const csvContent = "\uFEFF" + headers.join(',') + "\n" + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement("a"));
        link.setAttribute("href", url);
        link.setAttribute("download", `KIS_Teacher_List_${teacherAssignmentType}_${format(new Date(), 'yyyyMMdd')}.csv`);
        link.click();
        document.body.removeChild(link);
    };

    const handleClearAllTeachers = async () => {
        try {
            if (teacherAssignmentType === 'commute') {
                await deleteAllTeachers();
            } else {
                await deleteAllAfterSchoolTeachers();
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
            } else {
                await deleteAfterSchoolTeachersInBatch(ids);
            }
            setSelectedTeacherIds(new Set());
            dismiss();
            toast({ title: t('success'), description: t('admin.teacher_management.delete_success_count', { count: ids.length }) });
        } catch (error) {
            dismiss();
            toast({ title: t('error'), description: t('admin.teacher_management.delete.error'), variant: 'destructive' });
        }
    };

    const getTeachersForBus = (busId: string) => {
        const relevantRouteType = teacherAssignmentType === 'commute' ? 'Afternoon' : 'AfterSchool';
        const relevantRoute = routes.find(r => r.busId === busId && r.dayOfWeek === 'Monday' && r.type === relevantRouteType);
        if (!relevantRoute || !relevantRoute.teacherIds) return t('unassigned');
        
        const names = relevantRoute.teacherIds
            .map(id => currentTeacherPool.find(t => t.id === id)?.name)
            .filter(Boolean);
        return names.length > 0 ? names.join(', ') : t('unassigned');
    };

    const handleBatchAssignTeachers = async () => {
        if (currentTeacherPool.length === 0) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.assign.no_teacher_error'), variant: 'destructive' });
            return;
        }

        let routesToUpdate: Route[] = [];
        let relevantDays: DayOfWeek[];
        if (teacherAssignmentType === 'commute') {
            relevantDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            routesToUpdate = routes.filter(r => relevantDays.includes(r.dayOfWeek) && r.type === 'Afternoon');
        } else {
            relevantDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            routesToUpdate = routes.filter(r => relevantDays.includes(r.dayOfWeek) && r.type === 'AfterSchool');
        }

        const targetBuses = sortBuses(buses.filter(bus => {
            const isActive = bus.isActive ?? true;
            const isExcluded = bus.excludeFromAssignment ?? false;
            if (!isActive || isExcluded) return false;
            return isBusOperational(bus.id);
        }));

        if (targetBuses.length === 0) {
            toast({ title: t('notice'), description: t('admin.teacher_assignment.assign.no_operational_buses') });
            return;
        }

        const busyTeacherIds = new Set<string>();
        const excludedBusIds = new Set(buses.filter(bus => bus.excludeFromAssignment === true).map(bus => bus.id));
        routesToUpdate.forEach(r => {
            if (excludedBusIds.has(r.busId)) {
                r.teacherIds?.forEach(id => busyTeacherIds.add(id));
            }
        });
        
        const availableTeachers = currentTeacherPool.filter(t => !busyTeacherIds.has(t.id));
        const shuffledTeachers = [...availableTeachers].sort(() => Math.random() - 0.5);
        
        if (shuffledTeachers.length === 0) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.assign.not_enough_teachers', { count: 0 }), variant: 'destructive' });
            return;
        }

        const backup: Record<string, string[]> = {};
        routesToUpdate.forEach(r => {
            backup[r.id] = r.teacherIds || [];
        });
        setPreviousRouteAssignments(backup);

        const batch = writeBatch(db);
        let teacherIndex = 0;
        const totalBuses = targetBuses.length;

        if (shuffledTeachers.length < totalBuses) {
            toast({ title: t('notice'), description: t('admin.teacher_assignment.assign.not_enough_teachers', { count: shuffledTeachers.length }) });
            return;
        }

        let extraTeachersCount = Math.max(0, shuffledTeachers.length - totalBuses);
        const buses45 = targetBuses.filter(b => b.capacity === 45);
        let assignmentCountFor45 = Math.min(extraTeachersCount, buses45.length);

        for (const bus of targetBuses) {
            const assignedIds: string[] = [];
            if (teacherIndex < shuffledTeachers.length) {
                assignedIds.push(shuffledTeachers[teacherIndex++].id);
            }
            if (bus.capacity === 45 && assignmentCountFor45 > 0 && teacherIndex < shuffledTeachers.length) {
                assignedIds.push(shuffledTeachers[teacherIndex++].id);
                assignmentCountFor45--;
            }

            const busRoutesToUpdate = routesToUpdate.filter(r => r.busId === bus.id);
            busRoutesToUpdate.forEach(route => {
                batch.update(doc(db, 'routes', route.id), { teacherIds: assignedIds });
            });
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
        } else {
            routesToClear = routes.filter(r => r.type === 'AfterSchool');
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
            
            const escape = (val: string) => `"${val.toString().replace(/"/g, '""')}"`;
            return [
                escape(bus.name),
                escape(t(`bus_type.${bus.type}`)),
                escape(teachersStr),
                escape(routePath || ""),
                escape(statusStr)
            ].join(',');
        });

        const csvContent = "\uFEFF" + headers.join(',') + "\n" + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement("a"));
        const categoryName = teacherAssignmentType === 'commute' ? "하교" : "방과후";
        link.setAttribute("href", url);
        link.setAttribute("download", `KIS_Bus_Teacher_Assignments_${categoryName}_${format(new Date(), 'yyyyMMdd')}.csv`);
        link.click();
        document.body.removeChild(link);
    }, [buses, teacherAssignmentType, isBusOperational, t, routes, destinations]);

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
                    <Tabs value={teacherAssignmentType} onValueChange={(v) => setTeacherAssignmentType(v as any)} className="w-full">
                        <TabsList className="grid grid-cols-2 max-w-md">
                            <TabsTrigger value="commute">{t('route_type.commute')}</TabsTrigger>
                            <TabsTrigger value="afterSchool">{t('route_type.AfterSchool')}</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <h3 className="text-lg font-semibold">
                                {teacherAssignmentType === 'commute' ? "등하교 담당 교사 명단" : "방과후 담당 교사 명단"}
                            </h3>
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
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
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
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
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
                                                    {getTeachersForBus(bus.id).split(', ').map((name, i) => (
                                                        name === t('unassigned') ? 
                                                        <span key={i} className="text-muted-foreground italic text-xs">{name}</span> :
                                                        <Badge key={i} variant="secondary" className="font-normal text-xs">{name}</Badge>
                                                    ))}
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
