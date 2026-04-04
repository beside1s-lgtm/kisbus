'use client';

import React, { useState, useMemo } from 'react';
import type { AfterSchoolClass, Student, Bus, Route, Teacher, DayOfWeek, Destination } from '@/lib/types';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Search } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';
import { getStudentName, normalizeString } from '@/lib/utils';

interface AfterSchoolInquiryDialogProps {
    afterSchoolClasses: AfterSchoolClass[];
    afterSchoolTeachers: Teacher[];
    students: Student[];
    buses: Bus[];
    routes: Route[];
    destinations: Destination[];
}

export const AfterSchoolInquiryDialog = ({
    afterSchoolClasses,
    afterSchoolTeachers,
    students,
    buses,
    routes,
    destinations,
}: AfterSchoolInquiryDialogProps) => {
    const { t, i18n } = useTranslation();
    const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('all');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | 'all'>('all');
    const [classSearchQuery, setClassSearchQuery] = useState('');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

    const filteredClasses = useMemo(() => {
        return afterSchoolClasses.filter(c => {
            if (selectedDay !== 'all' && c.dayOfWeek !== selectedDay) return false;
            if (selectedTeacherId !== 'all' && c.teacherId !== selectedTeacherId) return false;
            if (classSearchQuery.trim()) {
                const q = normalizeString(classSearchQuery.trim());
                const nameMatch = normalizeString(c.name).includes(q);
                const teacherMatch = c.teacherName && normalizeString(c.teacherName).includes(q);
                if (!nameMatch && !teacherMatch) return false;
            }
            return true;
        }).sort((a, b) => {
            const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            if (a.dayOfWeek !== b.dayOfWeek) return days.indexOf(a.dayOfWeek) - days.indexOf(b.dayOfWeek);
            return a.name.localeCompare(b.name, 'ko');
        });
    }, [afterSchoolClasses, selectedDay, selectedTeacherId, classSearchQuery]);

    const classStudents = useMemo(() => {
        if (!selectedClassId) return [];
        const targetClass = afterSchoolClasses.find(c => c.id === selectedClassId);
        if (!targetClass) return [];

        const isSaturday = targetClass.dayOfWeek === 'Saturday';

        return students
            .filter(s => s.afterSchoolClassIds?.[targetClass.dayOfWeek] === targetClass.id)
            .map(s => {
                // 토요일은 AfterSchool 노선이 없고 일반 등하교(Morning/Afternoon) 노선을 사용
                const studentRoute = routes.find(r =>
                    r.dayOfWeek === targetClass.dayOfWeek &&
                    (isSaturday
                        ? (r.type === 'Morning' || r.type === 'Afternoon')
                        : r.type === 'AfterSchool'
                    ) &&
                    r.seating.some(seat => seat.studentId === s.id)
                );
                const bus = buses.find(b => b.id === studentRoute?.busId);
                const busName = bus?.name || t('unassigned');
                return { ...s, busName };
            })
            .sort((a, b) => {
                const gA = parseInt(a.grade) || 0;
                const gB = parseInt(b.grade) || 0;
                if (gA !== gB) return gA - gB;
                const cA = parseInt(a.class) || 0;
                const cB = parseInt(b.class) || 0;
                if (cA !== cB) return cA - cB;
                return getStudentName(a, i18n.language).localeCompare(getStudentName(b, i18n.language), 'ko');
            });
    }, [selectedClassId, students, afterSchoolClasses, routes, buses, t, i18n.language]);

    const handleDownload = () => {
        if (!selectedClassId || classStudents.length === 0) return;
        const targetClass = afterSchoolClasses.find(c => c.id === selectedClassId);
        if (!targetClass) return;
        const headers = ['학년', '반', '이름', '방과후 버스번호'];
        const rows = classStudents.map(s => [s.grade, s.class, getStudentName(s, i18n.language), s.busName].join(','));
        const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement('a'));
        link.setAttribute('href', url);
        link.setAttribute('download', `${targetClass.name}_명단.csv`);
        link.click();
        document.body.removeChild(link);
    };

    const selectedClass = afterSchoolClasses.find(c => c.id === selectedClassId);

    return (
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" /> 방과후 명단 조회
                </DialogTitle>
                <DialogDescription>수업별 학생 목록과 탑승 버스를 확인합니다.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 flex-1 min-h-0">
                {/* 필터 영역 */}
                <div className="space-y-1">
                    <Label className="text-xs">요일 선택</Label>
                    <Select value={selectedDay} onValueChange={(v: any) => { setSelectedDay(v); setSelectedClassId(null); }}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">전체</SelectItem>
                            {(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as DayOfWeek[]).map(d => (
                                <SelectItem key={d} value={d}>{t(`day.${d.toLowerCase()}`)}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs">수업명 또는 교사명 검색</Label>
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            className="h-8 pl-8 text-sm"
                            placeholder="수업명 또는 교사명으로 검색..."
                            value={classSearchQuery}
                            onChange={e => { setClassSearchQuery(e.target.value); setSelectedClassId(null); }}
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs">수업 선택</Label>
                    <Select
                        value={selectedClassId || 'none'}
                        onValueChange={v => setSelectedClassId(v === 'none' ? null : v)}
                    >
                        <SelectTrigger className="h-10">
                            <SelectValue placeholder="수업을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">수업 선택 안 함</SelectItem>
                            {filteredClasses.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                    [{t(`day_short.${c.dayOfWeek.toLowerCase()}`)}] {c.name} ({c.teacherName || '교사 미정'})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* 학생 목록 */}
                {selectedClassId && (
                    <div className="flex flex-col gap-2 flex-1 min-h-0">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                                총 <strong className="text-foreground">{classStudents.length}</strong>명
                                {selectedClass && (
                                    <span className="ml-1">
                                        — {t(`day.${selectedClass.dayOfWeek.toLowerCase()}`)} {selectedClass.name}
                                    </span>
                                )}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleDownload}
                                disabled={classStudents.length === 0}
                            >
                                <Download className="mr-1 h-3 w-3" /> 다운로드
                            </Button>
                        </div>
                        <div className="rounded-md border overflow-y-auto flex-1">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[60px]">학년</TableHead>
                                        <TableHead className="w-[50px]">반</TableHead>
                                        <TableHead>이름</TableHead>
                                        <TableHead className="text-right">방과후 버스</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {classStudents.length > 0 ? (
                                        classStudents.map(s => (
                                            <TableRow key={s.id}>
                                                <TableCell>{s.grade}</TableCell>
                                                <TableCell>{s.class}</TableCell>
                                                <TableCell className="font-medium">{getStudentName(s, i18n.language)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={s.busName === t('unassigned') ? 'outline' : 'secondary'}>
                                                        {s.busName}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                                배정된 학생이 없습니다.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
            </div>
        </DialogContent>
    );
};
