'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import Papa from 'papaparse';
import { addBus, deleteBus, updateBus, addRoute } from '@/lib/firebase-data';
import type { Bus, Route, NewBus, Teacher, DayOfWeek, RouteType, Destination } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Upload, Trash2, PlusCircle, Download, UserCog, UserX, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/use-translation';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Checkbox } from '@/components/ui/checkbox';

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
            return allRoutes.filter(r => r.busId === targetBus.id && weekdays.includes(r.dayOfWeek) && (r.type === 'Morning' || r.type === 'Afternoon'));
        }
        return allRoutes.filter(r => r.busId === targetBus.id && r.type === 'AfterSchool');
    }, [allRoutes, targetBus, assignmentType, weekdays]);

    useEffect(() => {
        if (relevantRoutes.length > 0) {
            setSelectedTeacherIds(relevantRoutes[0].teacherIds || []);
        }
    }, [relevantRoutes]);
    
    const assignedToOtherRoutesIds = useMemo(() => {
        const otherRoutes = allRoutes.filter(r => {
            if (r.busId === targetBus.id) return false;
            if (assignmentType === 'commute') {
                return weekdays.includes(r.dayOfWeek) && (r.type === 'Morning' || r.type === 'Afternoon');
            }
            return r.type === 'AfterSchool';
        });

        const ids = new Set<string>();
        otherRoutes.forEach(r => {
            r.teacherIds?.forEach(id => ids.add(id));
        });
        return ids;
    }, [allRoutes, targetBus.id, assignmentType, weekdays]);

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
                    {assignmentType === 'commute' ? "평일 등하교" : "방과후"} 노선에 대한 담당교사를 변경합니다.
                </CardDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                {sortedTeachers.map(teacher => {
                    const isAssignedToOtherRoute = assignedToOtherRoutesIds.has(teacher.id);
                    const isAssignedToCurrentRoute = selectedTeacherIds.includes(teacher.id);
                    const isDisabled = isAssignedToOtherRoute && !isAssignedToCurrentRoute;

                    return (
                        <div key={teacher.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={`teacher-${teacher.id}`}
                                checked={selectedTeacherIds.includes(teacher.id)}
                                onCheckedChange={(checked) => handleCheckboxChange(teacher.id, checked as boolean)}
                                disabled={isDisabled}
                            />
                            <Label htmlFor={`teacher-${teacher.id}`} className={cn(isDisabled && "text-muted-foreground")}>
                                {teacher.name}
                                {isDisabled && <span className="text-xs ml-2">{t('admin.teacher_assignment.change.assigned_other')}</span>}
                            </Label>
                        </div>
                    );
                })}
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

interface BusRegistrationTabProps {
    buses: Bus[];
    routes: Route[];
    teachers: Teacher[];
    destinations: Destination[]; // 추가된 부분
}

const generateInitialSeating = (capacity: number): { seatNumber: number; studentId: string | null }[] => {
    return Array.from({ length: capacity }, (_, i) => ({
        seatNumber: i + 1,
        studentId: null,
    }));
};

export const BusRegistrationTab = ({ buses, routes, teachers, destinations }: BusRegistrationTabProps) => {
    const [newBusName, setNewBusName] = useState('');
    const [newBusType, setNewBusType] = useState<'16-seater' | '29-seater' | '45-seater'>('45-seater');
    const { toast } = useToast();
    const { t } = useTranslation();
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const routeTypes: RouteType[] = ['Morning', 'Afternoon', 'AfterSchool'];
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [teacherAssignmentType, setTeacherAssignmentType] = useState<'commute' | 'afterSchool'>('commute');
    const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);
    const [selectedBusForTeacher, setSelectedBusForTeacher] = useState<Bus | null>(null);

    const handleAddBusLogic = async (busData: NewBus) => {
        try {
            const newBus = await addBus(busData);
            const routePromises = days.flatMap(day => 
                routeTypes.map(type => 
                    addRoute({
                        busId: newBus.id,
                        dayOfWeek: day,
                        type: type,
                        stops: [],
                        seating: generateInitialSeating(newBus.capacity),
                        teacherIds: [],
                    })
                )
            );
            await Promise.all(routePromises);
            return newBus;
        } catch (error) {
            console.error("Error adding bus:", error);
            throw error;
        }
    };
    
    const handleManualAddBus = async () => {
        if (!newBusName || !newBusType) {
            toast({ title: t('error'), description: t('admin.bus_registration.add.validation_error'), variant: 'destructive' });
            return;
        }
        const capacityMap = { '16-seater': 16, '29-seater': 29, '45-seater': 45 } as const;
        const newBusData: NewBus = { name: newBusName, type: newBusType, capacity: capacityMap[newBusType] };
        try {
            await handleAddBusLogic(newBusData);
            setNewBusName('');
            toast({ title: t('success'), description: t('admin.bus_registration.add.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.bus_registration.add.error'), variant: 'destructive' });
        }
    };
    
    const handleDeleteBus = async (busId: string) => {
        try {
            await deleteBus(busId);
            toast({ title: t('success'), description: t('admin.bus_registration.delete.success')});
        } catch (error) {
            console.error("Error deleting bus:", error);
            toast({ title: t('error'), description: t('admin.bus_registration.delete.error'), variant: 'destructive' });
        }
    }

    const handleToggleBusActive = async (bus: Bus) => {
        try {
            const newIsActive = !(bus.isActive ?? true);
            await updateBus(bus.id, { isActive: newIsActive });
            toast({ title: t('success'), description: `"${bus.name}" 버스 상태가 ${newIsActive ? '활성' : '비활성'}으로 변경되었습니다.` });
        } catch (error) {
            console.error("Error updating bus status:", error);
            toast({ title: t('error'), description: "버스 상태 변경 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleToggleBusExcludeAssignment = async (bus: Bus) => {
        try {
            const newExclude = !(bus.excludeFromAssignment ?? false);
            await updateBus(bus.id, { excludeFromAssignment: newExclude });
            toast({ title: t('success'), description: `"${bus.name}" 버스 배정 제외 상태가 ${newExclude ? '설정' : '해제'}되었습니다.` });
        } catch (error) {
            console.error("Error updating bus assignment status:", error);
            toast({ title: t('error'), description: "상태 변경 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleDownloadBusTemplate = () => {
        const headers = "번호,타입";
        const examples = [
            "Bus 10,45-seater",
            "Bus 11,29-seater",
            "Bus 12,16-seater",
            "# 타입은 16-seater, 29-seater, 45-seater 중 하나를 입력해야 합니다."
        ];
        const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + headers + "\n" + examples.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "bus_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            comments: "#",
            complete: async (results) => {
                const capacityMap = { '16-seater': 16, '29-seater': 29, '45-seater': 45 } as const;
                const validTypes = Object.keys(capacityMap);
                const newBusesData: NewBus[] = results.data.map((row: any) => {
                    const type = (row['타입'] || row['type'] || '').trim();
                    return {
                        name: (row['번호'] || row['name'] || '').trim(),
                        type: type as '16-seater' | '29-seater' | '45-seater',
                        capacity: capacityMap[type as keyof typeof capacityMap]
                    }
                }).filter(bus => bus.name && bus.type && validTypes.includes(bus.type));
                if (newBusesData.length === 0) {
                    toast({ title: t('error'), description: t('admin.bus_registration.batch.validation_error'), variant: "destructive" });
                    return;
                }
                const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_registration.batch.processing') });
                try {
                    await Promise.all(newBusesData.map(busData => handleAddBusLogic(busData)));
                    dismiss();
                    toast({ title: t('success'), description: t('admin.bus_registration.batch.success', { count: newBusesData.length }) });
                } catch (error) {
                    dismiss();
                    toast({ title: t('error'), description: t('admin.bus_registration.batch.error'), variant: "destructive" });
                }
            },
            error: (error) => {
                toast({ title: t('admin.file_parse_error'), description: error.message, variant: "destructive" });
            }
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // 🚀 [새 기능] 버스 목록 다운로드 함수
    const handleDownloadBusList = () => {
        if (buses.length === 0) {
            toast({ title: t('notice'), description: "다운로드할 버스 데이터가 없습니다." });
            return;
        }
        const headers = ["버스 번호", "타입", "담당 교사", "노선 경로(정류장)"];
        const sorted = sortBuses(buses);
        const csvRows = sorted.map(bus => {
            const relevantType = teacherAssignmentType === 'commute' ? 'Morning' : 'AfterSchool';
            const route = routes.find(r => r.busId === bus.id && r.dayOfWeek === 'Monday' && r.type === relevantType);
            const teacherNames = route?.teacherIds
                ?.map(id => teachers.find(t => t.id === id)?.name)
                .filter(Boolean)
                .join(', ') || "미배정";
            const stopNames = route?.stops
                ?.map(id => destinations.find(d => d.id === id)?.name)
                .filter(Boolean)
                .join(' -> ') || "경로 정보 없음";
            const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
            return [escape(bus.name), escape(t(`bus_type.${bus.type}`)), escape(teacherNames), escape(stopNames)].join(',');
        });
        const csvContent = "\uFEFF" + headers.join(',') + "\n" + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const fileName = `KIS_Bus_List_${teacherAssignmentType === 'commute' ? '등하교' : '방과후'}.csv`;
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const getTeachersForBus = (busId: string) => {
        const relevantRouteType = teacherAssignmentType === 'commute' ? 'Morning' : 'AfterSchool';
        const relevantRoute = routes.find(r => r.busId === busId && r.dayOfWeek === 'Monday' && r.type === relevantRouteType);
        if (!relevantRoute || !relevantRoute.teacherIds) return t('unassigned');
        const teacherNames = relevantRoute.teacherIds
            .map(id => teachers.find(t => t.id === id)?.name)
            .filter(Boolean);
        return teacherNames.length > 0 ? teacherNames.join(', ') : t('unassigned');
    };

    const handleBatchAssignTeachers = async () => {
        if (teachers.length === 0) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.assign.no_teacher_error'), variant: 'destructive' });
            return;
        }
        let routesToUpdate: Route[] = [];
        let otherRoutes: Route[] = [];
        let relevantDays: DayOfWeek[];
        if (teacherAssignmentType === 'commute') {
            relevantDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            routesToUpdate = routes.filter(r => relevantDays.includes(r.dayOfWeek) && (r.type === 'Morning' || r.type === 'Afternoon'));
            otherRoutes = routes.filter(r => !routesToUpdate.includes(r));
        } else {
            relevantDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            routesToUpdate = routes.filter(r => relevantDays.includes(r.dayOfWeek) && r.type === 'AfterSchool');
            otherRoutes = routes.filter(r => !routesToUpdate.includes(r));
        }
        const busyTeacherIds = new Set<string>();
        otherRoutes.forEach(r => r.teacherIds?.forEach(id => busyTeacherIds.add(id)));
        const availableTeachers = teachers.filter(t => !busyTeacherIds.has(t.id));
        const shuffledTeachers = [...availableTeachers].sort(() => Math.random() - 0.5);
        let teacherIndex = 0;
        const targetBuses = sortBuses(buses.filter(bus => (bus.isActive ?? true) && !(bus.excludeFromAssignment ?? false)));
        if (targetBuses.length === 0) return;
        const totalBuses = targetBuses.length;
        let extraTeachersCount = Math.max(0, shuffledTeachers.length - totalBuses);
        const buses45 = targetBuses.filter(b => b.capacity === 45);
        let assignmentCountFor45 = Math.min(extraTeachersCount, buses45.length);
        const batch = writeBatch(db);
        for (const bus of targetBuses) {
            const assignedIds: string[] = [];
            if (teacherIndex < shuffledTeachers.length) assignedIds.push(shuffledTeachers[teacherIndex++].id);
            if (bus.capacity === 45 && assignmentCountFor45 > 0 && teacherIndex < shuffledTeachers.length) {
                assignedIds.push(shuffledTeachers[teacherIndex++].id);
                assignmentCountFor45--;
            }
            const busRoutesToUpdate = routesToUpdate.filter(r => r.busId === bus.id);
            busRoutesToUpdate.forEach(route => batch.update(doc(db, 'routes', route.id), { teacherIds: assignedIds }));
        }
        try {
            await batch.commit();
            if (teacherIndex < totalBuses) {
                toast({ title: t('notice'), description: `일부 버스에 교사가 배정되지 않았습니다.` });
            } else {
                toast({ title: t('success'), description: t('admin.teacher_assignment.assign.success') });
            }
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.assign.error'), variant: 'destructive' });
        }
    };

    const handleUnassignAllTeachers = async () => {
        let routesToClear: Route[] = [];
        if (teacherAssignmentType === 'commute') {
            routesToClear = routes.filter(r => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].includes(r.dayOfWeek) && (r.type === 'Morning' || r.type === 'Afternoon'));
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

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin.bus_registration.title')}</CardTitle>
                <CardDescription>{t('admin.bus_registration.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <Tabs value={teacherAssignmentType} onValueChange={(v) => setTeacherAssignmentType(v as any)} className="w-auto">
                          <TabsList className="grid grid-cols-2">
                            <TabsTrigger value="commute">{t('route_type.commute')}</TabsTrigger>
                            <TabsTrigger value="afterSchool">{t('route_type.AfterSchool')}</TabsTrigger>
                          </TabsList>
                        </Tabs>
                        <Button variant="outline" onClick={handleBatchAssignTeachers}><UserCog className="mr-2"/>{t('admin.teacher_assignment.reassign')}</Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline" className="text-destructive border-destructive hover:bg-destructive/10"><UserX className="mr-2"/>{t('reset')}</Button>
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
                    <div className="flex gap-2 self-end sm:self-center flex-wrap">
                        {/* 🚀 목록 다운로드 버튼 추가 */}
                        <Button variant="outline" onClick={handleDownloadBusList}><Download className="mr-2 h-4 w-4" /> 목록 다운로드</Button>
                        <Button variant="outline" onClick={handleDownloadBusTemplate}><Download className="mr-2 h-4 w-4" /> {t('admin.bus_registration.template')}</Button>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> {t('batch_upload')}</Button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button><PlusCircle className="mr-2" /> {t('admin.bus_registration.add_new_bus')}</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>{t('admin.bus_registration.add_new_bus')}</DialogTitle></DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="bus-name" className="text-right">{t('admin.bus_registration.bus_number')}</Label>
                                        <Input id="bus-name" placeholder={t('admin.bus_registration.bus_number_placeholder')} className="col-span-3" value={newBusName} onChange={e => setNewBusName(e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="bus-type" className="text-right">{t('type')}</Label>
                                        <Select onValueChange={(v) => setNewBusType(v as any)} value={newBusType}>
                                            <SelectTrigger className="col-span-3">
                                                <SelectValue placeholder={t('admin.bus_registration.select_type')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="16-seater">{t('bus_type.16')}</SelectItem>
                                                <SelectItem value="29-seater">{t('bus_type.29')}</SelectItem>
                                                <SelectItem value="45-seater">{t('bus_type.45')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button onClick={handleManualAddBus}>{t('add')}</Button>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>활성화</TableHead>
                            <TableHead>배정 제외</TableHead>
                            <TableHead>{t('admin.bus_registration.bus_number')}</TableHead>
                            <TableHead>{t('type')}</TableHead>
                            <TableHead>{t('admin.teacher_assignment.title')}</TableHead>
                            <TableHead className="text-right">{t('actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {buses.map(bus => (
                            <TableRow key={bus.id} className={cn(!(bus.isActive ?? true) && "text-muted-foreground")}>
                                <TableCell>
                                    <Switch
                                        checked={bus.isActive ?? true}
                                        onCheckedChange={() => handleToggleBusActive(bus)}
                                        aria-label="Toggle bus active state"
                                    />
                                </TableCell>
                                <TableCell>
                                    <Switch
                                        checked={bus.excludeFromAssignment ?? false}
                                        onCheckedChange={() => handleToggleBusExcludeAssignment(bus)}
                                        aria-label="Toggle bus assignment exclude state"
                                    />
                                </TableCell>
                                <TableCell>{bus.name}</TableCell>
                                <TableCell>{t(`bus_type.${bus.type}`)}</TableCell>
                                <TableCell>{getTeachersForBus(bus.id)}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleManualAssignClick(bus)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>{t('admin.bus_registration.delete.confirm_title')}</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {t('admin.bus_registration.delete.confirm_description')}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteBus(bus.id)}>{t('delete')}</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            {selectedBusForTeacher && (
              <Dialog open={isTeacherDialogOpen} onOpenChange={setIsTeacherDialogOpen}>
                <TeacherAssignmentDialog 
                    targetBus={selectedBusForTeacher} 
                    allRoutes={routes} 
                    teachers={teachers} 
                    assignmentType={teacherAssignmentType}
                    onOpenChange={setIsTeacherDialogOpen} 
                />
              </Dialog>
            )}
        </Card>
    );
};