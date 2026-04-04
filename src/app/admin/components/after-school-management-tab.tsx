'use client';

import React, { useState, useMemo, useRef } from 'react';
import { 
    addAfterSchoolClass, 
    updateAfterSchoolClass, 
    deleteAfterSchoolClass, 
    addAfterSchoolClassesInBatch,
    clearAllAfterSchoolClasses,
    addTeacher
} from '@/lib/firebase-data';
import type { 
    AfterSchoolClass, 
    Student, 
    Bus, 
    Route, 
    Teacher, 
    DayOfWeek,
    NewAfterSchoolClass, 
    Destination
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { 
    PlusCircle, 
    Download, 
    Upload, 
    Trash2, 
    Search, 
    Users, 
    FileText, 
    GraduationCap,
    Calendar,
    ChevronRight,
    Loader2
} from 'lucide-react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogTrigger, 
    DialogFooter, 
    DialogDescription 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';
import { getStudentName, normalizeString } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface AfterSchoolManagementTabProps {
    afterSchoolClasses: AfterSchoolClass[];
    students: Student[];
    buses: Bus[];
    routes: Route[];
    teachers: Teacher[];
    afterSchoolTeachers: Teacher[];
    destinations: Destination[];
}

export const AfterSchoolManagementTab = ({
    afterSchoolClasses,
    students,
    buses,
    routes,
    teachers,
    afterSchoolTeachers,
    destinations
}: AfterSchoolManagementTabProps) => {
    const { toast } = useToast();
    const { t, i18n } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAddClassDialogOpen, setIsAddClassDialogOpen] = useState(false);
    const [newClass, setNewClass] = useState<Partial<NewAfterSchoolClass>>({
        name: '',
        dayOfWeek: 'Monday',
        teacherId: '',
        teacherName: ''
    });

    // Filtering for inquiry
    const [selectedDay, setSelectedDay] = useState<DayOfWeek | 'all'>('all');
    const [selectedTeacherId, setSelectedTeacherId] = useState<string | 'all'>('all');
    const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
    const [classSearchQuery, setClassSearchQuery] = useState('');

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

        return students.filter(s => s.afterSchoolClassIds?.[targetClass.dayOfWeek] === targetClass.id)
            .map(s => {
                // Find assigned bus for this student on this day's AfterSchool route
                const studentRoute = routes.find(r => 
                    r.dayOfWeek === targetClass.dayOfWeek && 
                    r.type === 'AfterSchool' && 
                    r.seating.some(seat => seat.studentId === s.id)
                );
                const bus = buses.find(b => b.id === studentRoute?.busId);
                return {
                    ...s,
                    busName: bus?.name || t('unassigned')
                };
            }).sort((a, b) => {
                const gA = parseInt(a.grade) || 0;
                const gB = parseInt(b.grade) || 0;
                if (gA !== gB) return gA - gB;
                const cA = parseInt(a.class) || 0;
                const cB = parseInt(b.class) || 0;
                if (cA !== cB) return cA - cB;
                return getStudentName(a, i18n.language).localeCompare(getStudentName(b, i18n.language), 'ko');
            });
    }, [selectedClassId, students, afterSchoolClasses, routes, buses, t, i18n.language]);

    const handleAddClass = async () => {
        if (!newClass.name || !newClass.dayOfWeek) {
            toast({ title: t('error'), description: "수업명과 요일을 입력해주세요.", variant: 'destructive' });
            return;
        }

        try {
            const teacher = [...teachers, ...afterSchoolTeachers].find(t => t.id === newClass.teacherId);
            await addAfterSchoolClass({
                name: newClass.name,
                dayOfWeek: newClass.dayOfWeek,
                teacherId: newClass.teacherId || null,
                teacherName: teacher?.name || null
            });
            setIsAddClassDialogOpen(false);
            setNewClass({ name: '', dayOfWeek: 'Monday', teacherId: '', teacherName: '' });
            toast({ title: t('success'), description: "방과후 수업이 등록되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "등록 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleDownloadTemplate = () => {
        import('xlsx').then(XLSX => {
            const headers = ["요일", "수업명", "교사명"];
            const examples = [
                ["월", "축구부", "홍길동"],
                ["화요일", "바이올린", "김철수"],
                ["Wednesday", "합창단", ""]
            ];
            const wsData = [headers, ...examples];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "방과후_수업_템플릿");
            XLSX.writeFile(wb, "after_school_class_template.xlsx");
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

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

                const allTeachers = [...teachers, ...afterSchoolTeachers];
                const dayMap: Record<string, DayOfWeek> = {
                    '월': 'Monday', '월요일': 'Monday', 'Mon': 'Monday', 'Monday': 'Monday',
                    '화': 'Tuesday', '화요일': 'Tuesday', 'Tue': 'Tuesday', 'Tuesday': 'Tuesday',
                    '수': 'Wednesday', '수요일': 'Wednesday', 'Wed': 'Wednesday', 'Wednesday': 'Wednesday',
                    '목': 'Thursday', '목요일': 'Thursday', 'Thu': 'Thursday', 'Thursday': 'Thursday',
                    '금': 'Friday', '금요일': 'Friday', 'Fri': 'Friday', 'Friday': 'Friday',
                    '토': 'Saturday', '토요일': 'Saturday', 'Sat': 'Saturday', 'Saturday': 'Saturday'
                };

                const classesToAdd: NewAfterSchoolClass[] = results.map((row: any) => {
                    const dayInput = (row['요일'] || row['Day'] || '').toString().trim();
                    const name = (row['수업명'] || row['ClassName'] || '').toString().trim();
                    const teacherName = (row['교사명'] || row['TeacherName'] || '').toString().trim();
                    
                    const day = dayMap[dayInput] || 'Monday';
                    const teacher = allTeachers.find(t => t.name === teacherName);

                    return {
                        name,
                        dayOfWeek: day,
                        teacherId: teacher?.id || null,
                        teacherName: teacherName || null
                    };
                }).filter((c: any) => c.name);

                if (classesToAdd.length > 0) {
                    await addAfterSchoolClassesInBatch(classesToAdd);
                    toast({ title: t('success'), description: `${classesToAdd.length}개의 수업이 등록되었습니다.` });
                } else {
                    toast({ title: t('error'), description: "등록할 수업 데이터가 없습니다.", variant: 'destructive' });
                }
            } catch (error) {
                toast({ title: t('error'), description: "파일 처리 중 오류가 발생했습니다.", variant: 'destructive' });
            }
        };
        reader.readAsArrayBuffer(file);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDownloadAllClasses = () => {
        if (afterSchoolClasses.length === 0) return;
        import('xlsx').then(XLSX => {
            const headers = ["요일", "수업명", "지도교사"];
            const wsData = [
                headers,
                ...afterSchoolClasses.map(c => [
                    t(`day.${c.dayOfWeek.toLowerCase()}`),
                    c.name,
                    c.teacherName || '-'
                ])
            ];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "수업목록");
            XLSX.writeFile(wb, "after_school_classes.xlsx");
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    const handleDownloadBusByDayRosters = () => {
        if (students.length === 0 || routes.length === 0) return;
        
        import('xlsx').then(XLSX => {
            const wb = XLSX.utils.book_new();
            const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const dayLabels: Record<string, string> = {
                'Monday': '월요일', 'Tuesday': '화요일', 'Wednesday': '수요일',
                'Thursday': '목요일', 'Friday': '금요일'
            };
            
            for (const bus of buses) {
                const busRoutes = routes.filter(r => r.busId === bus.id && r.type === 'AfterSchool');
                if (busRoutes.length === 0) continue;
                
                let wsData: any[][] = [];
                
                for (const day of days) {
                    const route = busRoutes.find(r => r.dayOfWeek === day);
                    if (!route) continue;
                    
                    const seatedStudents = route.seating
                        .filter(seat => seat.studentId)
                        .map(seat => {
                            const student = students.find(s => s.id === seat.studentId);
                            return { seatNumber: seat.seatNumber, student };
                        })
                        .filter(item => item.student);
                    
                    if (seatedStudents.length > 0) {
                        wsData.push([`[ ${dayLabels[day]} ]`]);
                        wsData.push(["좌석 번호", "학년", "반", "이름", "목적지"]);
                        
                        seatedStudents.forEach(item => {
                            const student = item.student!;
                            const destId = student.afterSchoolDestinations?.[day as DayOfWeek];
                            const destName = destinations.find(d => d.id === destId)?.name || '지정되지 않음';
                            wsData.push([
                                item.seatNumber,
                                student.grade,
                                student.class,
                                getStudentName(student, i18n.language),
                                destName
                            ]);
                        });
                        wsData.push([]); 
                    }
                }
                
                if (wsData.length > 0) {
                    const ws = XLSX.utils.aoa_to_sheet(wsData);
                    XLSX.utils.book_append_sheet(wb, ws, bus.name.substring(0, 31)); 
                }
            }
            
            if (wb.SheetNames.length === 0) {
                toast({ title: t('notice'), description: "출력할 방과후 버스 명단 데이터가 없습니다." });
                return;
            }
            
            XLSX.writeFile(wb, `방과후_버스별_탑승명단_${new Date().toISOString().split('T')[0]}.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    const handleDownloadClassStudents = () => {
        if (!selectedClassId || classStudents.length === 0) return;
        const targetClass = afterSchoolClasses.find(c => c.id === selectedClassId);
        if (!targetClass) return;

        import('xlsx').then(XLSX => {
            const headers = ["학년", "반", "이름", "방과후 버스번호"];
            const wsData = [
                headers,
                ...classStudents.map(s => [
                    s.grade,
                    s.class,
                    getStudentName(s, i18n.language),
                    s.busName
                ])
            ];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "학생명단");
            XLSX.writeFile(wb, `${targetClass.name}_명단.xlsx`);
        }).catch(err => {
            console.error(err);
            toast({ title: t('error'), description: "Excel 다운로드 중 오류가 발생했습니다.", variant: 'destructive' });
        });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <GraduationCap className="h-5 w-5" /> 방과후 수업 관리
                        </CardTitle>
                        <CardDescription>수업 목록을 등록하고 관리합니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                            <Dialog open={isAddClassDialogOpen} onOpenChange={setIsAddClassDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button size="sm">
                                        <PlusCircle className="mr-2 h-4 w-4" /> 개별 등록
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>방과후 수업 추가</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>요일</Label>
                                            <Select value={newClass.dayOfWeek} onValueChange={(v: any) => setNewClass({...newClass, dayOfWeek: v})}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
                                                        <SelectItem key={d} value={d}>{t(`day.${d.toLowerCase()}`)}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>수업명</Label>
                                            <Input value={newClass.name} onChange={e => setNewClass({...newClass, name: e.target.value})} placeholder="예: 축구부" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>지도교사 (선택)</Label>
                                            <Select value={newClass.teacherId || 'none'} onValueChange={(v) => setNewClass({...newClass, teacherId: v === 'none' ? '' : v})}>
                                                <SelectTrigger><SelectValue placeholder="선생님 선택" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none">선택 불필요</SelectItem>
                                                    {afterSchoolTeachers.map(t => (
                                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={handleAddClass} className="w-full">등록</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="mr-2 h-4 w-4" /> 일괄 등록
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                                <Download className="mr-2 h-4 w-4" /> 템플릿
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownloadAllClasses}>
                                <FileText className="mr-2 h-4 w-4" /> 수업 목록 다운로드
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleDownloadBusByDayRosters}>
                                <Download className="mr-2 h-4 w-4" /> 버스별 탑승명단 (엑셀)
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => { if(confirm("모든 방과후 수업을 삭제하시겠습니까? 학생들의 수업 배정도 해제됩니다.")) clearAllAfterSchoolClasses(); }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx" className="hidden" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Search className="h-5 w-5" /> 방과후 명단 조회
                        </CardTitle>
                        <CardDescription>수업별 학생 목록과 탑승 버스를 확인합니다.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <Label className="text-xs">요일 선택</Label>
                        <Select value={selectedDay} onValueChange={(v: any) => { setSelectedDay(v); setSelectedClassId(null); }}>
                            <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">전체</SelectItem>
                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
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
                            <Select value={selectedClassId || 'none'} onValueChange={(v) => setSelectedClassId(v === 'none' ? null : v)}>
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
                    </CardContent>
                </Card>
            </div>

            {selectedClassId && (
                <Card className="animate-in fade-in slide-in-from-bottom-2">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <div>
                            <CardTitle className="text-lg">
                                {afterSchoolClasses.find(c => c.id === selectedClassId)?.name} 학생 명단
                            </CardTitle>
                            <CardDescription>
                                총 {classStudents.length}명의 학생이 배정되었습니다.
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleDownloadClassStudents} disabled={classStudents.length === 0}>
                            <Download className="mr-2 h-4 w-4" /> 명단 다운로드
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[80px]">학년</TableHead>
                                        <TableHead className="w-[80px]">반</TableHead>
                                        <TableHead>이름</TableHead>
                                        <TableHead className="text-right">방과후 버스번호</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {classStudents.length > 0 ? (
                                        classStudents.map((s) => (
                                            <TableRow key={s.id}>
                                                <TableCell>{s.grade}</TableCell>
                                                <TableCell>{s.class}</TableCell>
                                                <TableCell className="font-medium">{getStudentName(s, i18n.language)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={s.busName === t('unassigned') ? "outline" : "secondary"}>
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
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
