'use client';

import React from 'react';
import { Search, Download, Upload, Trash2, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useTranslation } from '@/hooks/use-translation';
import type { Student, Destination, Bus, Route, DayOfWeek, RouteType } from '@/lib/types';

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
    handleDestinationChange: (id: string, val: string|null, type: 'morning'|'afternoon'|'afterSchool', day?: DayOfWeek) => void;
    handleUnassignStudentFromRoute: (routeId: string, studentId: string) => void;
    assignedRoutesForSelectedStudent: Route[];
}

export const StudentGlobalSearchPanel = ({
    destinations, buses, routes, selectedRouteType, dayOrder, selectedGlobalStudent, setSelectedGlobalStudent,
    globalSearchQuery, setGlobalSearchQuery, globalSearchResults, handleGlobalStudentClick,
    handleDownloadAllStudents, handleDownloadStudentTemplate, fileInputRef, handleStudentFileUpload,
    handleDeleteAllStudents, handleUnassignAllFromStudent, handleAssignStudentFromSearch,
    handleStudentInfoChange, handleDestinationChange, handleUnassignStudentFromRoute,
    assignedRoutesForSelectedStudent
}: StudentGlobalSearchPanelProps) => {
    const { t } = useTranslation();

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
                        <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
                            <CardContent className="p-2">
                                {globalSearchResults.map(student => (
                                    <div key={student.id} 
                                        className="p-2 text-sm hover:bg-accent rounded-md cursor-pointer"
                                        onClick={() => handleGlobalStudentClick(student)}>
                                        {student.name} ({student.grade} {student.class})
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
                            <div>
                                <h4 className="font-semibold">{selectedGlobalStudent.name} ({selectedGlobalStudent.grade} {selectedGlobalStudent.class})</h4>
                                 <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                         <Button variant="link" size="sm" className="p-0 h-auto text-destructive">
                                            <UserX className="mr-1"/>{t('admin.student_management.search.unassign_all_button')}
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
                            <Button variant="outline" size="sm" onClick={() => setSelectedGlobalStudent(null)}>{t('close')}</Button>
                        </div>
                        <Button size="sm" className="w-full" onClick={handleAssignStudentFromSearch}>이 버스에 배정</Button>
                        
                        <div className="space-y-2">
                            <Label>{t('student.name')}</Label>
                            <Input
                                value={selectedGlobalStudent.name || ''}
                                onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, name: e.target.value} : null)}
                                onBlur={(e) => handleStudentInfoChange(selectedGlobalStudent.id, 'name', e.target.value)}
                                placeholder={t('student.name_placeholder')}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>{t('student.contact')}</Label>
                            <Input
                                value={selectedGlobalStudent.contact || ''}
                                onChange={(e) => setSelectedGlobalStudent(s => s ? {...s, contact: e.target.value} : null)}
                                onBlur={(e) => handleStudentInfoChange(selectedGlobalStudent.id, 'contact', e.target.value)}
                                placeholder="베트남 전화번호 입력"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t('student.gender')}</Label>
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
                        <div className="space-y-2">
                            <Label>{t('student.morning_destination')}</Label>
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
                            <Label>{t('student.afternoon_destination')}</Label>
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
                        
                        <div className="space-y-3">
                            <Label>{t('student.after_school_destination')}</Label>
                            {dayOrder.map(day => (
                                <div key={day} className="space-y-1">
                                     <Label className="text-xs text-muted-foreground">{t(`day_short.${day.toLowerCase()}`)}</Label>
                                     <Select 
                                        value={selectedGlobalStudent.afterSchoolDestinations?.[day] || '_NONE_'} 
                                        onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'afterSchool', day)}
                                        disabled={day === 'Friday' && selectedRouteType === 'AfterSchool' && !selectedGlobalStudent.afterSchoolDestinations?.['Friday']}
                                    >
                                        <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                            {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            ))}
                        </div>

                         <div>
                            <Label>{t('admin.student_management.search.assigned_routes')}</Label>
                            <div className="space-y-2 mt-1 border rounded-md p-2 max-h-40 overflow-y-auto">
                                {assignedRoutesForSelectedStudent.length > 0 ? (
                                    assignedRoutesForSelectedStudent.map(route => {
                                        const busName = buses.find(b => b.id === route.busId)?.name || t('unknown_bus');
                                        const routeTypeName = route.type === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${route.type.toLowerCase()}`);
                                        return (
                                            <div key={route.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                                <p className="text-sm">{busName} - {t(`day.${route.dayOfWeek.toLowerCase()}`)} {routeTypeName}</p>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleUnassignStudentFromRoute(route.id, selectedGlobalStudent.id)}>
                                                    <UserX className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )
                                    })
                                ) : (
                                    <p className="text-sm text-muted-foreground p-2">{t('admin.student_management.search.no_assigned_routes')}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
