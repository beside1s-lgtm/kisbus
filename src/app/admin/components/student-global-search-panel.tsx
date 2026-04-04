'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Download, Upload, Trash2, UserX, Users, UserPlus, X, Pencil, Check, CheckCircle2 } from 'lucide-react';
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
import { cn, normalizeString, getStudentName } from '@/lib/utils';
import { updateStudent, addDestination, deleteStudentsInBatch } from '@/lib/firebase-data';
import { useToast } from '@/hooks/use-toast';

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
    handleDownloadRouteAssignments: () => void;
    handleDownloadStudentTemplate: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    handleStudentFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleDeleteAllStudents: () => void;
    handleUnassignAllFromStudent: () => void;
    handleAssignStudentFromSearch: () => void;
    handleStudentInfoChange: (id: string, field: 'name'|'gender'|'contact'|'grade'|'class', val: string) => void;
    handleDestinationChange: (id: string, val: string|null, type: 'morning'|'afternoon'|'afterSchool'|'satMorning'|'satAfternoon', day?: DayOfWeek) => void;
    handleUnassignStudentFromRoute: (routeId: string, studentId: string) => void;
    assignedRoutesForSelectedStudent: Route[];
}

export const StudentGlobalSearchPanel = ({
    students, destinations, buses, routes, selectedRouteType, dayOrder, selectedGlobalStudent, setSelectedGlobalStudent,
    globalSearchQuery, setGlobalSearchQuery, globalSearchResults, handleGlobalStudentClick,
    handleDownloadAllStudents, handleDownloadRouteAssignments, handleDownloadStudentTemplate, fileInputRef, handleStudentFileUpload,
    handleDeleteAllStudents, handleUnassignAllFromStudent, handleAssignStudentFromSearch,
    handleStudentInfoChange, handleDestinationChange, handleUnassignStudentFromRoute,
    assignedRoutesForSelectedStudent
}: StudentGlobalSearchPanelProps) => {
    const { t, i18n } = useTranslation();
    const { toast } = useToast();
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
            (normalizeString(s.nameKo || '').includes(lowerQuery) || 
             normalizeString(s.nameEn || '').includes(lowerQuery) || 
             normalizeString(s.name || '').includes(lowerQuery))
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
            handleStudentInfoChange(selectedGlobalStudent.id, 'name', selectedGlobalStudent.nameEn || selectedGlobalStudent.nameKo || selectedGlobalStudent.name);
            updateStudent(selectedGlobalStudent.id, { 
                nameKo: selectedGlobalStudent.nameKo || '', 
                nameEn: selectedGlobalStudent.nameEn || '' 
            });
        }
        setIsEditingName(!isEditingName);
    };

    const handleApproveStudentDestination = async (studentId: string, suggestion: string, type: 'morning' | 'afternoon' | 'satMorning' | 'satAfternoon') => {
        try {
            const newDest = await addDestination({ name: suggestion });
            const updates: any = {};
            if (type === 'morning') {
                updates.morningDestinationId = newDest.id;
                updates.suggestedMorningDestination = null;
            } else if (type === 'afternoon') {
                updates.afternoonDestinationId = newDest.id;
                updates.suggestedAfternoonDestination = null;
            } else if (type === 'satMorning') {
                updates.satMorningDestinationId = newDest.id;
                updates.suggestedSatMorningDestination = null;
            } else if (type === 'satAfternoon') {
                updates.satAfternoonDestinationId = newDest.id;
                updates.suggestedSatAfternoonDestination = null;
            }
            
            await updateStudent(studentId, updates);
            toast({ 
                title: t('success'), 
                description: `'${suggestion}'이(가) 정식 목적지로 등록되고 학생에게 배정되었습니다.` 
            });

            if (selectedGlobalStudent?.id === studentId) {
                setSelectedGlobalStudent(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (error) {
            toast({ title: t('error'), description: "승인 처리 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleRejectStudentDestination = async (studentId: string, type: 'morning' | 'afternoon' | 'satMorning' | 'satAfternoon') => {
        try {
            const updates: any = {};
            if (type === 'morning') updates.suggestedMorningDestination = null;
            else if (type === 'afternoon') updates.suggestedAfternoonDestination = null;
            else if (type === 'satMorning') updates.suggestedSatMorningDestination = null;
            else if (type === 'satAfternoon') updates.suggestedSatAfternoonDestination = null;
            
            await updateStudent(studentId, updates);
            toast({ title: t('success'), description: "신청된 목적지를 거절 처리했습니다." });

            if (selectedGlobalStudent?.id === studentId) {
                setSelectedGlobalStudent(prev => prev ? { ...prev, ...updates } : null);
            }
        } catch (error) {
            toast({ title: t('error'), description: "처리 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleDeleteSelectedStudent = async () => {
        if (!selectedGlobalStudent) return;
        try {
            await deleteStudentsInBatch([selectedGlobalStudent.id]);
            setSelectedGlobalStudent(null);
            toast({ title: t('success'), description: "학생 신청 정보가 삭제되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "삭제 중 오류가 발생했습니다.", variant: 'destructive' });
        }
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
                                        onClick={() => { handleGlobalStudentClick(student); setGlobalSearchQuery(''); }}>
                                        <span>{getStudentName(student, i18n.language)} ({student.grade} {student.class})</span>
                                        {student.siblingGroupId && <Users className="w-3 h-3 text-primary" />}
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}
                </div>
                <div className="flex justify-end mb-4 gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={handleDownloadAllStudents}><Download className="mr-2 h-4 w-4" /> 전체 학생 명단</Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadRouteAssignments}><Download className="mr-2 h-4 w-4" /> 버스 배차 명단</Button>
                    <Button size="sm" variant="outline" onClick={handleDownloadStudentTemplate}><Download className="mr-2 h-4 w-4" /> {t('admin.student_management.student_template')}</Button>
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> {t('batch_upload')}</Button>
                    <input type="file" ref={fileInputRef as React.RefObject<HTMLInputElement>} onChange={handleStudentFileUpload} accept=".xlsx" className="hidden" />
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
                    <div className="space-y-4 p-4 border rounded-md bg-card/50">
                        <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-semibold">{getStudentName(selectedGlobalStudent, i18n.language)}</h4>
                                    {selectedGlobalStudent.siblingGroupId && <Badge variant="secondary" className="text-[10px] py-0 h-4"><Users className="w-2 h-2 mr-1"/>가족</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">{selectedGlobalStudent.grade} {selectedGlobalStudent.class}</p>
                                <div className="flex flex-wrap gap-2 mt-1">
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
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="link" size="sm" className="p-0 h-auto text-destructive justify-start">
                                                <Trash2 className="mr-1 w-3 h-3"/>신청 삭제
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>학생 신청 정보를 삭제하시겠습니까?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {selectedGlobalStudent.name} 학생의 모든 정보와 배정 내역이 영구적으로 삭제됩니다.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                <AlertDialogAction onClick={handleDeleteSelectedStudent}>{t('delete')}</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setSelectedGlobalStudent(null)}><X className="w-4 h-4"/></Button>
                        </div>
                        
                        <Button size="sm" className="w-full" onClick={handleAssignStudentFromSearch}>이 버스에 배정</Button>
                        
                        <div className="flex justify-between items-center">
                            <Label className="text-xs">{t('student.name')}</Label>
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                className="h-6 text-[10px]"
                                onClick={toggleNameEdit}
                            >
                                {isEditingName ? <><Check className="h-3 w-3 mr-1" /> 저장</> : <><Pencil className="h-3 w-3 mr-1" /> 수정</>}
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">한글</Label>
                                <Input
                                    value={selectedGlobalStudent.nameKo || ''}
                                    onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, nameKo: e.target.value} : null)}
                                    placeholder="한글 이름"
                                    disabled={!isEditingName}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">English</Label>
                                <Input
                                    value={selectedGlobalStudent.nameEn || ''}
                                    onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, nameEn: e.target.value} : null)}
                                    placeholder="English Name"
                                    disabled={!isEditingName}
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label className="text-xs">{t('student.grade')}</Label>
                                <Input
                                    value={selectedGlobalStudent.grade || ''}
                                    onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, grade: e.target.value} : null)}
                                    onBlur={(e) => handleStudentInfoChange(selectedGlobalStudent.id, 'grade', e.target.value)}
                                    placeholder="예: 1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs">{t('student.class')}</Label>
                                <Input
                                    value={selectedGlobalStudent.class || ''}
                                    onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, class: e.target.value} : null)}
                                    onBlur={(e) => handleStudentInfoChange(selectedGlobalStudent.id, 'class', e.target.value)}
                                    placeholder="예: 1"
                                />
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
                                        <span>{getStudentName(sib, i18n.language)} ({sib.grade} {sib.class})</span>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleRemoveSibling(sib.id)}>
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                                <div className="relative mt-2">
                                    <Search className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                                    <Input
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
                                                        <span>{getStudentName(s, i18n.language)} ({s.grade} {s.class})</span>
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
                            {selectedGlobalStudent.suggestedMorningDestination && (
                                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-md mb-1 animate-in fade-in slide-in-from-left-1">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-amber-600 font-bold uppercase">{t('admin.student_management.search.suggested_label')}</span>
                                        <span className="text-xs font-semibold text-amber-900">{selectedGlobalStudent.suggestedMorningDestination}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-[10px] bg-white hover:bg-amber-100 border-amber-300 text-amber-700"
                                            onClick={() => handleApproveStudentDestination(selectedGlobalStudent.id, selectedGlobalStudent.suggestedMorningDestination!, 'morning')}
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.student_management.search.approve_suggestion')}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-7 w-7 p-0 text-amber-600 hover:text-destructive hover:bg-amber-100"
                                            onClick={() => handleRejectStudentDestination(selectedGlobalStudent.id, 'morning')}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
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
                            {selectedGlobalStudent.suggestedAfternoonDestination && (
                                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-md mb-1 animate-in fade-in slide-in-from-left-1">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-amber-600 font-bold uppercase">{t('admin.student_management.search.suggested_label')}</span>
                                        <span className="text-xs font-semibold text-amber-900">{selectedGlobalStudent.suggestedAfternoonDestination}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-[10px] bg-white hover:bg-amber-100 border-amber-300 text-amber-700"
                                            onClick={() => handleApproveStudentDestination(selectedGlobalStudent.id, selectedGlobalStudent.suggestedAfternoonDestination!, 'afternoon')}
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.student_management.search.approve_suggestion')}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-7 w-7 p-0 text-amber-600 hover:text-destructive hover:bg-amber-100"
                                            onClick={() => handleRejectStudentDestination(selectedGlobalStudent.id, 'afternoon')}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
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
                            {selectedGlobalStudent.suggestedSatMorningDestination && (
                                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-md mb-1 animate-in fade-in slide-in-from-left-1">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-amber-600 font-bold uppercase">{t('admin.student_management.search.suggested_label')}</span>
                                        <span className="text-xs font-semibold text-amber-900">{selectedGlobalStudent.suggestedSatMorningDestination}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-[10px] bg-white hover:bg-amber-100 border-amber-300 text-amber-700"
                                            onClick={() => handleApproveStudentDestination(selectedGlobalStudent.id, selectedGlobalStudent.suggestedSatMorningDestination!, 'satMorning')}
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.student_management.search.approve_suggestion')}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-7 w-7 p-0 text-amber-600 hover:text-destructive hover:bg-amber-100"
                                            onClick={() => handleRejectStudentDestination(selectedGlobalStudent.id, 'satMorning')}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
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
                            {selectedGlobalStudent.suggestedSatAfternoonDestination && (
                                <div className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded-md mb-1 animate-in fade-in slide-in-from-left-1">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] text-amber-600 font-bold uppercase">{t('admin.student_management.search.suggested_label')}</span>
                                        <span className="text-xs font-semibold text-amber-900">{selectedGlobalStudent.suggestedSatAfternoonDestination}</span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-7 text-[10px] bg-white hover:bg-amber-100 border-amber-300 text-amber-700"
                                            onClick={() => handleApproveStudentDestination(selectedGlobalStudent.id, selectedGlobalStudent.suggestedSatAfternoonDestination!, 'satAfternoon')}
                                        >
                                            <CheckCircle2 className="w-3 h-3 mr-1" /> {t('admin.student_management.search.approve_suggestion')}
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-7 w-7 p-0 text-amber-600 hover:text-destructive hover:bg-amber-100"
                                            onClick={() => handleRejectStudentDestination(selectedGlobalStudent.id, 'satAfternoon')}
                                        >
                                            <X className="w-3 h-3" />
                                        </Button>
                                    </div>
                                </div>
                            )}
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
                                        
                                        let destId: string | null = null;
                                        if (route.dayOfWeek === 'Saturday') {
                                            destId = route.type === 'Morning' ? selectedGlobalStudent.satMorningDestinationId : selectedGlobalStudent.satAfternoonDestinationId;
                                        } else {
                                            if (route.type === 'Morning') destId = selectedGlobalStudent.morningDestinationId;
                                            else if (route.type === 'Afternoon') destId = selectedGlobalStudent.afternoonDestinationId;
                                            else destId = selectedGlobalStudent.afterSchoolDestinations?.[route.dayOfWeek] || null;
                                        }
                                        const destName = destinations.find(d => d.id === destId)?.name || t('unassigned');

                                        return (
                                            <div key={route.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                                <div className="flex flex-col gap-0.5">
                                                    <p className="text-[10px] font-bold">{busName} - {t(`day_short.${route.dayOfWeek.toLowerCase()}`)} {routeTypeName}</p>
                                                    <p className="text-[9px] text-muted-foreground">{t('destination')}: {destName}</p>
                                                </div>
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
