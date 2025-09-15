
'use client';
import React, { useState, useEffect } from 'react';
import { getStudents, getDestinations, addStudent, addSuggestedDestination, updateStudent } from '@/lib/firebase-data';
import { Destination, NewStudent, Student, DayOfWeek } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Bus, Clock } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Checkbox } from '@/components/ui/checkbox';

const daysOfWeek: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayLabels: Record<DayOfWeek, string> = {
  Monday: '월',
  Tuesday: '화',
  Wednesday: '수',
  Thursday: '목',
  Friday: '금',
  Saturday: '토',
};


export default function ApplyPage() {
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    
    // Form States
    const [name, setName] = useState('');
    const [grade, setGrade] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [gender, setGender] = useState<'Male' | 'Female'>('Male');
    
    const [mainDestinationId, setMainDestinationId] = useState<string | null>(null);
    const [useCustomMainDest, setUseCustomMainDest] = useState(false);
    const [customMainDestName, setCustomMainDestName] = useState('');

    const [afterSchoolDays, setAfterSchoolDays] = useState<Partial<Record<DayOfWeek, boolean>>>({});
    const [afterSchoolDestinations, setAfterSchoolDestinations] = useState<Partial<Record<DayOfWeek, string | null>>>({});
    const [useCustomAfterSchoolDests, setUseCustomAfterSchoolDests] = useState<Partial<Record<DayOfWeek, boolean>>>({});
    const [customAfterSchoolDestNames, setCustomAfterSchoolDestNames] = useState<Partial<Record<DayOfWeek, string>>>({});


    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            const [destinationsData, studentsData] = await Promise.all([
                getDestinations(),
                getStudents()
            ]);
            setDestinations(destinationsData);
            setAllStudents(studentsData);
        };
        fetchData();
    }, []);

    const validateBaseInfo = () => {
        if (!name.trim() || !grade.trim() || !studentClass.trim() || !gender) {
            toast({ title: "오류", description: "학생 기본 정보(이름, 학년, 반, 성별)를 모두 입력해주세요.", variant: "destructive" });
            return false;
        }
        return true;
    }

    const findExistingStudent = (): Student | undefined => {
        return allStudents.find(s => 
            s.name === name.trim() && 
            s.grade === grade.trim() && 
            s.class === studentClass.trim()
        );
    }
    
    const handleMainSubmit = async () => {
        if (!validateBaseInfo()) return;
        
        if (!useCustomMainDest && !mainDestinationId) {
            toast({ title: "오류", description: "목적지를 선택해주세요.", variant: "destructive" });
            return;
        }
        if (useCustomMainDest && !customMainDestName.trim()) {
            toast({ title: "오류", description: "새로운 목적지 이름을 입력해주세요.", variant: "destructive" });
            return;
        }

        const existingStudent = findExistingStudent();
        
        let updateData: Partial<Student> = {};
        
        if (useCustomMainDest) {
            try {
                await addSuggestedDestination({ name: customMainDestName.trim() });
                toast({ title: "제안 제출됨", description: `"${customMainDestName.trim()}" 목적지가 제안되었습니다. 관리자 승인 후 정식 목록에 추가됩니다.` });
                updateData.suggestedMainDestination = customMainDestName.trim();
                updateData.mainDestinationId = null;
            } catch(e) {
                toast({ title: "오류", description: "목적지 제안 실패", variant: "destructive" });
                return;
            }
        } else {
            updateData.mainDestinationId = mainDestinationId;
            updateData.suggestedMainDestination = null;
        }

        try {
            if (existingStudent) {
                await updateStudent(existingStudent.id, updateData);
                setAllStudents(prevStudents => prevStudents.map(s => s.id === existingStudent.id ? { ...s, ...updateData } : s));
            } else {
                const newStudentData: NewStudent = {
                    name: name.trim(),
                    grade: grade.trim(),
                    class: studentClass.trim(),
                    gender,
                    mainDestinationId: updateData.mainDestinationId || null,
                    afterSchoolDestinations: {},
                    suggestedMainDestination: updateData.suggestedMainDestination || null,
                };
                const addedStudent = await addStudent(newStudentData);
                setAllStudents(prevStudents => [...prevStudents, addedStudent]);
            }
            toast({ title: "신청 완료!", description: `${name} 학생의 등/하교 버스 정보가 업데이트되었습니다.` });
             // Clear form fields
            setMainDestinationId(null);
            setCustomMainDestName('');
            setUseCustomMainDest(false);

        } catch (error) {
            console.error("Error submitting main application:", error);
            toast({ title: "오류", description: "신청 제출에 실패했습니다.", variant: 'destructive' });
        }
    }

    const handleAfterSchoolSubmit = async () => {
        if (!validateBaseInfo()) return;

        const existingStudent = findExistingStudent();
        let finalDestinations: Partial<Record<DayOfWeek, string | null>> = existingStudent?.afterSchoolDestinations || {};

        let hasError = false;
        for (const day of daysOfWeek) {
            if (afterSchoolDays[day]) {
                const isCustom = useCustomAfterSchoolDests[day];
                const customName = customAfterSchoolDestNames[day]?.trim();
                const selectedId = afterSchoolDestinations[day];

                if (!isCustom && !selectedId) {
                    toast({ title: "오류", description: `${dayLabels[day]}요일의 목적지를 선택해주세요.`, variant: "destructive" });
                    hasError = true;
                    break;
                }
                if (isCustom && !customName) {
                    toast({ title: "오류", description: `${dayLabels[day]}요일의 새로운 목적지 이름을 입력해주세요.`, variant: "destructive" });
                    hasError = true;
                    break;
                }
                 if (isCustom && customName) {
                    try {
                        await addSuggestedDestination({ name: customName });
                        toast({ title: "제안 제출됨", description: `"${customName}" 목적지가 제안되었습니다.` });
                        // This doesn't assign the student yet, just suggests. Let's mark it as null for now.
                        // Admin needs to approve and then assign.
                        finalDestinations[day] = null;
                    } catch(e) {
                         toast({ title: "오류", description: "목적지 제안 실패", variant: "destructive" });
                         hasError = true;
                         break;
                    }
                } else {
                    finalDestinations[day] = selectedId || null;
                }
            } else {
                 finalDestinations[day] = null; // Unchecked means not using the bus
            }
        }
        if (hasError) return;

        const updateData: Partial<Student> = { afterSchoolDestinations: finalDestinations };

         try {
            if (existingStudent) {
                await updateStudent(existingStudent.id, updateData);
                setAllStudents(prevStudents => prevStudents.map(s => s.id === existingStudent.id ? { ...s, ...updateData } : s));
            } else {
                 const newStudentData: NewStudent = {
                    name: name.trim(),
                    grade: grade.trim(),
                    class: studentClass.trim(),
                    gender,
                    mainDestinationId: null,
                    afterSchoolDestinations: finalDestinations,
                };
                const addedStudent = await addStudent(newStudentData);
                setAllStudents(prevStudents => [...prevStudents, addedStudent]);
            }
            toast({ title: "신청 완료!", description: `${name} 학생의 방과후 버스 정보가 업데이트되었습니다.` });

            // Reset form
            setAfterSchoolDays({});
            setAfterSchoolDestinations({});
            setUseCustomAfterSchoolDests({});
            setCustomAfterSchoolDestNames({});

        } catch (error) {
            console.error("Error submitting after school application:", error);
            toast({ title: "오류", description: "신청 제출에 실패했습니다.", variant: 'destructive' });
        }
    }


    const handleToggleAfterSchoolDay = (day: DayOfWeek, checked: boolean) => {
        setAfterSchoolDays(prev => ({...prev, [day]: checked}));
        if (!checked) {
            // Also clear destination data for that day
            setAfterSchoolDestinations(prev => ({...prev, [day]: null}));
            setUseCustomAfterSchoolDests(prev => ({...prev, [day]: false}));
            setCustomAfterSchoolDestNames(prev => ({...prev, [day]: ''}));
        }
    }

    return (
        <MainLayout>
            <div className="flex flex-col items-center gap-8">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline">
                            <UserPlus />
                            학생 기본 정보
                        </CardTitle>
                        <CardDescription>
                            먼저 학생 정보를 입력하세요. 등/하교와 방과후 버스 신청에 공통으로 사용됩니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">이름</Label>
                                <Input id="name" placeholder="예: 김민준" required value={name} onChange={e => setName(e.target.value)} />
                            </div>
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="grade">학년</Label>
                                <Input id="grade" placeholder="예: G1" required value={grade} onChange={e => setGrade(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="class">반</Label>
                                <Input id="class" placeholder="예: C1" required value={studentClass} onChange={e => setStudentClass(e.target.value)}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">성별</Label>
                                <Select required value={gender} onValueChange={(v) => setGender(v as 'Male' | 'Female')}>
                                    <SelectTrigger id="gender">
                                        <SelectValue placeholder="성별 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-8">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline"><Bus /> 등/하교 버스</CardTitle>
                             <CardDescription>등/하교 시 하차할 목적지를 선택하고 신청하세요.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="mainDestinationId">등/하교 목적지</Label>
                                <Select name="mainDestinationId" value={mainDestinationId || ''} onValueChange={setMainDestinationId} disabled={useCustomMainDest}>
                                    <SelectTrigger id="mainDestinationId">
                                        <SelectValue placeholder="목적지 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="useCustomMainDest" checked={useCustomMainDest} onCheckedChange={(checked) => setUseCustomMainDest(checked as boolean)} />
                                <label htmlFor="useCustomMainDest" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    찾는 목적지가 없나요? 직접 입력하세요.
                                </label>
                            </div>
                            {useCustomMainDest && (
                                <div className="space-y-2">
                                    <Label htmlFor="customMainDestName">새 목적지 이름</Label>
                                    <Input id="customMainDestName" value={customMainDestName} onChange={e => setCustomMainDestName(e.target.value)} placeholder="예: 서초역 1번 출구" />
                                </div>
                            )}
                            <Button onClick={handleMainSubmit} className="w-full">등/하교 버스 신청</Button>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline"><Clock /> 방과후 버스</CardTitle>
                            <CardDescription>방과후 수업 하차 요일과 목적지를 선택하고 신청하세요.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>탑승 요일 선택</Label>
                                <div className="flex flex-wrap gap-2">
                                    {daysOfWeek.map(day => (
                                        <div key={day} className="flex items-center gap-1">
                                            <Checkbox
                                                id={`day-${day}`}
                                                checked={!!afterSchoolDays[day]}
                                                onCheckedChange={(checked) => handleToggleAfterSchoolDay(day, checked as boolean)}
                                            />
                                            <Label htmlFor={`day-${day}`}>{dayLabels[day]}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {daysOfWeek.map(day => afterSchoolDays[day] && (
                                <div key={day} className="p-3 border rounded-md space-y-3">
                                    <Label className="font-semibold">{dayLabels[day]}요일 목적지</Label>
                                     <Select
                                        value={afterSchoolDestinations[day] || ''}
                                        onValueChange={(value) => setAfterSchoolDestinations(prev => ({...prev, [day]: value}))}
                                        disabled={!!useCustomAfterSchoolDests[day]}
                                    >
                                        <SelectTrigger><SelectValue placeholder="목적지 선택" /></SelectTrigger>
                                        <SelectContent>
                                            {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                     <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`custom-day-${day}`}
                                            checked={!!useCustomAfterSchoolDests[day]}
                                            onCheckedChange={(checked) => setUseCustomAfterSchoolDests(prev => ({...prev, [day]: checked as boolean}))}
                                        />
                                        <label htmlFor={`custom-day-${day}`} className="text-sm font-medium">직접 입력</label>
                                    </div>
                                    {useCustomAfterSchoolDests[day] && (
                                        <Input
                                            value={customAfterSchoolDestNames[day] || ''}
                                            onChange={(e) => setCustomAfterSchoolDestNames(prev => ({...prev, [day]: e.target.value}))}
                                            placeholder="새 방과후 목적지 이름"
                                        />
                                    )}
                                </div>
                            ))}
                            
                            <Button onClick={handleAfterSchoolSubmit} className="w-full" disabled={Object.values(afterSchoolDays).every(v => !v)}>방과후 버스 신청</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}
