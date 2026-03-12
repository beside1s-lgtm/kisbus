'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, Upload, Trash2, UserX, Users, UserPlus, X, Pencil, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTranslation } from '@/hooks/use-translation';
import type { Student, Destination, Bus, Route, DayOfWeek, RouteType } from '@/lib/types';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { cn, normalizeString } from '@/lib/utils';
import { updateStudent } from '@/lib/firebase-data';

interface StudentGlobalSearchPanelProps {
    students: Student[];
    destinations: Destination[];
    buses: Bus[];
    routes: Route[];
    selectedRouteType: RouteType;
    dayOrder: DayOfWeek[];
    selectedGlobalStudent: Student | null;
    setSelectedGlobalStudent: React.Dispatch<React.SetStateAction<Student | null>>;
    globalSearchQuery: string;
    setGlobalSearchQuery: (query: string) => void;
    globalSearchResults: Student[];
    handleGlobalStudentClick: (student: Student) => void;
    handleDownloadAllStudents: () => void;
    handleDownloadStudentTemplate: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleStudentFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDeleteAllStudents: () => void;
    handleUnassignAllFromStudent: () => void;
    handleAssignStudentFromSearch: () => void;
    handleStudentInfoChange: (id: string, field: 'name'|'gender'|'contact', val: string) => void;
    handleDestinationChange: (id: string, val: string|null, type: 'morning'|'afternoon'|'afterSchool'|'satMorning'|'satAfternoon', day?: DayOfWeek) => void;
    handleUnassignStudentFromRoute: (routeId: string, studentId: string) => void;
    assignedRoutesForSelectedStudent: Route[];
}

export const StudentGlobalSearchPanel = ({
    students, destinations, buses, routes, selectedRouteType, dayOrder, selectedGlobalStudent, setSelectedGlobalStudent,
    globalSearchQuery, setGlobalSearchQuery, globalSearchResults, handleGlobalStudentClick,
    handleDownloadAllStudents, handleDownloadStudentTemplate, fileInputRef, handleStudentFileUpload,
    handleDeleteAllStudents, handleUnassignAllFromStudent, handleAssignStudentFromSearch,
    handleStudentInfoChange, handleDestinationChange, handleUnassignStudentFromRoute,
    assignedRoutesForSelectedStudent
}: StudentGlobalSearchPanelProps) => {
    const { t } = useTranslation();
    const [siblingSearchQuery, setSiblingSearchQuery] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);

    // Reset editing state when student changes
    useEffect(() => {
        setIsEditingName(false);
    }, [selectedGlobalStudent?.id]);

    const siblingSearchResults = useMemo(() => {
        if (!siblingSearchQuery || !selectedGlobalStudent) return [];
        const lowerQuery = normalizeString(siblingSearchQuery);
        return students.filter(s => 
            s.id !== selectedGlobalStudent.id && 
            normalizeString(s.name).includes(lowerQuery)
        ).slice(0, 5);
    }, [siblingSearchQuery, students, selectedGlobalStudent]);

    const currentSiblings = useMemo(() => {
        if (!selectedGlobalStudent || !selectedGlobalStudent.siblingGroupId) return [];
        return students.filter(s => 
            s.siblingGroupId === selectedGlobalStudent.siblingGroupId && 
            s.id !== selectedGlobalStudent.id
        );
    }, [selectedGlobalStudent, students]);

    const handleAddSibling = async (sibling: Student) => {
        if (!selectedGlobalStudent) return;
        
        const newGroupId = selectedGlobalStudent.siblingGroupId || `group_${Date.now()}`;
        
        await updateStudent(selectedGlobalStudent.id, { siblingGroupId: newGroupId });
        await updateStudent(sibling.id, { siblingGroupId: newGroupId });
        
        setSelectedGlobalStudent(prev => prev ? { ...prev, siblingGroupId: newGroupId } : null);
        setSiblingSearchQuery('');
    };

    const handleRemoveSibling = async (siblingId: string) => {
        await updateStudent(siblingId, { siblingGroupId: null });
        if (currentSiblings.length === 1) {
             await updateStudent(selectedGlobalStudent!.id, { siblingGroupId: null });
             setSelectedGlobalStudent(prev => prev ? { ...prev, siblingGroupId: null } : null);
        }
    };

    const toggleNameEdit = () => {
        if (isEditingName && selectedGlobalStudent) {
            handleStudentInfoChange(selectedGlobalStudent.id, 'name', selectedGlobalStudent.name);
        }
        setIsEditingName(!isEditingName);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="font-headline">{t('admin.student_management.search.title')}</CardTitle>
                <CardDescription>{t('admin.student_management.search.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="relative mb-4">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder={t('admin.student_management.search.placeholder')}
                        className="pl-8 w-full"
                        value={globalSearchQuery}
                        onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    />
                    {globalSearchResults.length > 0 && (
                        <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto shadow-lg">
                            <CardContent className="p-2">
                                {globalSearchResults.map(student => (
                                    <div key={student.id} 
                                        className="p-2 text-sm hover:bg-accent rounded-md cursor-pointer flex justify-between items-center"
                                        onClick={() => handleGlobalStudentClick(student)}>
                                        <span>{student.name} ({student.grade} {student.class})</span>
                                        {student.siblingGroupId && <Users className="w-3 h-3 text-primary" />}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
                <div className="flex justify-end mb-4 gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={handleDownloadAllStudents}><Download className="mr-2 h-4 w-4" /> 전체 학생 명단</Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadStudentTemplate}><Download className="mr-2 h-4 w-4" /> {t('admin.student_management.student_template')}</Button>
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> {t('batch_upload')}</Button>
                    <input type="file" ref={fileInputRef as React.RefObject<HTMLInputElement>} onChange={handleStudentFileUpload} accept=".csv" className="hidden" />
                </div>
                <div className="mb-4">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className="w-full">
                                <Trash2 className="mr-2 h-4 w-4" /> 전체 학생 명단 초기화
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>정말 모든 학생 명단을 초기화하시겠습니까?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    이 작업은 되돌릴 수 없습니다. 모든 학생 정보 및 버스 배정 내역이 영구적으로 삭제됩니다. 새 학년이 시작될 때 사용해주세요.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteAllStudents}>초기화</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                {selectedGlobalStudent && (
                    <div className="space-y-4 p-4 border rounded-md">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold">{selectedGlobalStudent.name}</h4>
                                    {selectedGlobalStudent.siblingGroupId && <Badge variant="secondary" className="text-[10px] py-0 h-4"><Users className="w-2 h-2 mr-1"/>가족</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">{selectedGlobalStudent.grade} {selectedGlobalStudent.class}</p>
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                         <Button variant="link" size="sm" className="p-0 h-auto text-destructive justify-start">
                                            <UserX className="mr-1 w-3 h-3"/>{t('admin.student_management.search.unassign_all_button')}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t('admin.student_management.search.unassign_all_confirm_title')}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t('admin.student_management.search.unassign_all_confirm_description', { studentName: selectedGlobalStudent.name })}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleUnassignAllFromStudent}>{t('unassign')}</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedGlobalStudent(null)}><X className="w-4 h-4"/></Button>
                        </div>
                        
                        <Button size="sm" className="w-full" onClick={handleAssignStudentFromSearch}>이 버스에 배정</Button>
                        
                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.name')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={selectedGlobalStudent.name || ''}
                                    onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, name: e.target.value} : null)}
                                    placeholder={t('student.name_placeholder')}
                                    disabled={!isEditingName}
                                    className={cn(!isEditingName && "bg-muted cursor-not-allowed")}
                                />
                                <Button 
                                    size="icon" 
                                    variant={isEditingName ? "default" : "outline"} 
                                    onClick={toggleNameEdit}
                                    title={isEditingName ? "저장" : "수정"}
                                >
                                    {isEditingName ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.contact')}</Label>
                            <Input
                                value={selectedGlobalStudent.contact || ''}
                                onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, contact: e.target.value} : null)}
                                onBlur={(e) => handleStudentInfoChange(selectedGlobalStudent.id, 'contact', e.target.value)}
                                placeholder="베트남 전화번호 입력"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.gender')}</Label>
                            <Select 
                                value={selectedGlobalStudent.gender} 
                                onValueChange={(v) => handleStudentInfoChange(selectedGlobalStudent.id, 'gender', v)}
                            >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='Male'>{t('student.male')}</SelectItem>
                                    <SelectItem value='Female'>{t('student.female')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator className="my-2" />
                        
                        <div className="space-y-2">
                            <Label className="text-xs flex items-center gap-1"><Users className="w-3 h-3"/>형제/자매 관리</Label>
                            <div className="space-y-1">
                                {currentSiblings.map(sib => (
                                    <div key={sib.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md text-xs">
                                        <span>{sib.name} ({sib.grade} {sib.class})</span>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleRemoveSibling(sib.id)}>
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="relative mt-2">
                                    <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                                    <Input
                                        size="sm"
                                        placeholder="연결할 형제 검색..."
                                        className="pl-7 h-8 text-xs"
                                        value={siblingSearchQuery}
                                        onChange={(e) => setSiblingSearchQuery(e.target.value)}
                                    />
                                    {siblingSearchResults.length > 0 && (
                                        <Card className="absolute z-20 w-full mt-1 shadow-lg">
                                            <CardContent className="p-1">
                                                {siblingSearchResults.map(s => (
                                                    <div key={s.id} 
                                                        className="p-2 text-xs hover:bg-accent rounded-md cursor-pointer flex justify-between items-center"
                                                        onClick={() => handleAddSibling(s)}>
                                                        <span>{s.name} ({s.grade} {s.class})</span>
                                                        <UserPlus className="w-3 h-3 text-primary" />
                                                    </div>
                                                ))}
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.morning_destination')}</Label>
                            <Select 
                                value={selectedGlobalStudent.morningDestinationId || '_NONE_'} 
                                onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'morning')}
                            >
                                <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.afternoon_destination')}</Label>
                            <Select 
                                value={selectedGlobalStudent.afternoonDestinationId || '_NONE_'} 
                                onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'afternoon')}
                            >
                                <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <Separator className="my-2" />

                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.sat_morning_destination')}</Label>
                            <Select 
                                value={selectedGlobalStudent.satMorningDestinationId || '_NONE_'} 
                                onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'satMorning')}
                            >
                                <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs">{t('student.sat_afternoon_destination')}</Label>
                            <Select 
                                value={selectedGlobalStudent.satAfternoonDestinationId || '_NONE_'} 
                                onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'satAfternoon')}
                            >
                                <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator className="my-2" />

                        <div className="space-y-3">
                            <Label className="text-xs">{t('student.after_school_destination')}</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {dayOrder.filter(d => d !== 'Saturday').map(day => (
                                    <div key={day} className="space-y-1">
                                        <Label className="text-[10px] text-muted-foreground">{t(`day_short.${day.toLowerCase()}`)}</Label>
                                        <Select 
                                            value={selectedGlobalStudent.afterSchoolDestinations?.[day] || '_NONE_'} 
                                            onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'afterSchool', day)}
                                        >
                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="-" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='_NONE_'>-</SelectItem>
                                                {destinations.map(d => <SelectItem key={d.id} value={d.id} className="text-xs">{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        </div>

                         <div>
                            <Label className="text-xs">{t('admin.student_management.search.assigned_routes')}</Label>
                            <div className="space-y-2 mt-1 border rounded-md p-2 max-h-40 overflow-y-auto">
                                {assignedRoutesForSelectedStudent.length > 0 ? (
                                    assignedRoutesForSelectedStudent.map(route => {
                                        const busName = buses.find(b => b.id === route.busId)?.name || t('unknown_bus');
                                        const routeTypeName = route.type === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${route.type.toLowerCase()}`);
                                        return (
                                            <div key={route.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                                <p className="text-[10px]">{busName} - {t(`day_short.${route.dayOfWeek.toLowerCase()}`)} {routeTypeName}</p>
                                                <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleUnassignStudentFromRoute(route.id, selectedGlobalStudent.id)}>
                                                    <UserX className="h-3 h-3" />
                                                </Button>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <p className="text-[10px] text-muted-foreground p-2">{t('admin.student_management.search.no_assigned_routes')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
