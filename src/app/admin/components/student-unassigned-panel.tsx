'use client';

import React from 'react';
import { Search, Download, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { StudentCard } from '@/components/bus/draggable-student-card';
import { useTranslation } from '@/hooks/use-translation';
import type { Student, Destination, DayOfWeek, RouteType } from '@/lib/types';

interface StudentUnassignedPanelProps {
    filteredUnassignedStudents: Student[];
    destinations: Destination[];
    selectedStudentIds: Set<string>;
    unassignedSearchQuery: string;
    setUnassignedSearchQuery: (query: string) => void;
    unassignedView: 'current' | 'all';
    setUnassignedView: (view: 'current' | 'all') => void;
    unassignedTitle: string;
    selectedRouteType: RouteType;
    selectedDay: DayOfWeek;
    handleDownloadUnassignedStudents: () => void;
    handleToggleSelectAll: () => void;
    handleDeleteSelectedStudents: () => void;
    handleToggleStudentSelection: (id: string, isChecked: boolean) => void;
    handleUnassignedStudentClick: (student: Student) => void;
    handleStudentCardClick: (id: string) => void;
}

export const StudentUnassignedPanel = ({
    filteredUnassignedStudents, destinations, selectedStudentIds, unassignedSearchQuery, setUnassignedSearchQuery,
    unassignedView, setUnassignedView, unassignedTitle, selectedRouteType, selectedDay,
    handleDownloadUnassignedStudents, handleToggleSelectAll, handleDeleteSelectedStudents,
    handleToggleStudentSelection, handleUnassignedStudentClick, handleStudentCardClick
}: StudentUnassignedPanelProps) => {
    const { t } = useTranslation();

    const siblingCount = filteredUnassignedStudents.filter(s => !!s.siblingGroupId).length;

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="font-headline">{unassignedTitle}</CardTitle>
                    <Tabs value={unassignedView} onValueChange={(v) => setUnassignedView(v as 'current'|'all')}>
                        <TabsList>
                            <TabsTrigger value="current">현재 노선</TabsTrigger>
                            <TabsTrigger value="all">전체</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
                <CardDescription className="flex items-center justify-between">
                    <span>
                        {unassignedView === 'current' ? '현재 노선에 맞는 학생들입니다.' : '아직 배정되지 않은 모든 학생들입니다.'}
                    </span>
                    {siblingCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                            <Users className="w-3 h-3" /> 형제/자매: {siblingCount}명
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className='pt-4 max-h-[40vh] overflow-y-auto'>
                <div className="relative mb-4">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder={t('admin.student_management.unassigned.search_placeholder')}
                        className="pl-8 w-full"
                        value={unassignedSearchQuery}
                        onChange={(e) => setUnassignedSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex justify-end mb-2 gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={handleDownloadUnassignedStudents}>
                        <Download className="mr-2 h-4 w-4" /> {t('admin.student_management.unassigned.download_list')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleToggleSelectAll}>
                        {selectedStudentIds.size === filteredUnassignedStudents.length && filteredUnassignedStudents.length > 0 ? t('deselect_all') : t('select_all')}
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" disabled={selectedStudentIds.size === 0}>
                                <Trash2 className="mr-2 h-4 w-4" /> {t('delete_selected')}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('admin.student_management.unassigned.delete_confirm_title')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                    {t('admin.student_management.unassigned.delete_confirm_description', { count: selectedStudentIds.size })}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSelectedStudents}>{t('delete')}</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
                <div className="min-h-[200px]">
                    {filteredUnassignedStudents.map((student) => (
                        <StudentCard 
                            key={student.id}
                            student={student} 
                            destinations={destinations}
                            isChecked={selectedStudentIds.has(student.id)}
                            onCheckedChange={(isChecked) => handleToggleStudentSelection(student.id, isChecked)}
                            onCardClick={() => handleUnassignedStudentClick(student)}
                            onAssignClick={() => handleStudentCardClick(student.id)}
                            routeType={selectedRouteType}
                            dayOfWeek={selectedDay}
                        />
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
