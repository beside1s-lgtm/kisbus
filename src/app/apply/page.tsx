
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
import { Separator } from '@/components/ui/separator';
import { Combobox } from '@/components/ui/combobox';

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
    
    const [morningDestinationId, setMorningDestinationId] = useState<string | null>(null);
    const [useCustomMorningDest, setUseCustomMorningDest] = useState(false);
    const [customMorningDestName, setCustomMorningDestName] = useState('');

    const [afternoonDestinationId, setAfternoonDestinationId] = useState<string | null>(null);
    const [useCustomAfternoonDest, setUseCustomAfternoonDest] = useState(false);
    const [customAfternoonDestName, setCustomAfternoonDestName] = useState('');

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
            // Sort destinations by name
            destinationsData.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            setDestinations(destinationsData);
            setAllStudents(studentsData);
        };
        fetchData();
    }, []);

    const destinationOptions = destinations.map(d => ({ value: d.id, label: d.name }));

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
        
        const hasMorningSelection = !useCustomMorningDest && morningDestinationId;
        const hasCustomMorning = useCustomMorningDest && customMorningDestName.trim();
        const hasAfternoonSelection = !useCustomAfternoonDest && afternoonDestinationId;
        const hasCustomAfternoon = useCustomAfternoonDest && customAfternoonDestName.trim();

        if (!hasMorningSelection && !hasCustomMorning && !hasAfternoonSelection && !hasCustomAfternoon) {
             toast({ title: "오류", description: "등교 또는 하교 목적지 중 하나 이상을 선택하거나 입력해주세요.", variant: "destructive" });
            return;
        }

        const existingStudent = findExistingStudent();
        let updateData: Partial<Student> = { 
            applicationStatus: 'pending',
            ...existingStudent, // Preserve existing data
            name: name.trim(),
            grade: grade.trim(),
            class: studentClass.trim(),
            gender,
        };
        
        try {
            if (useCustomMorningDest && customMorningDestName.trim()) {
                await addSuggestedDestination({ name: customMorningDestName.trim() });
                toast({ title: "제안 제출됨", description: `"${customMorningDestName.trim()}" 목적지가 제안되었습니다.` });
                updateData.suggestedMorningDestination = customMorningDestName.trim();
                updateData.morningDestinationId = null;
            } else {
                updateData.morningDestinationId = morningDestinationId;
                updateData.suggestedMorningDestination = null;
            }

            if (useCustomAfternoonDest && customAfternoonDestName.trim()) {
                await addSuggestedDestination({ name: customAfternoonDestName.trim() });
                toast({ title: "제안 제출됨", description: `"${customAfternoonDestName.trim()}" 목적지가 제안되었습니다.` });
                updateData.suggestedAfternoonDestination = customAfternoonDestName.trim();
                updateData.afternoonDestinationId = null;
            } else {
                updateData.afternoonDestinationId = afternoonDestinationId;
                updateData.suggestedAfternoonDestination = null;
            }
        } catch(e) {
            toast({ title: "오류", description: "목적지 제안 실패", variant: "destructive" });
            return;
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
                    morningDestinationId: updateData.morningDestinationId || null,
                    afternoonDestinationId: updateData.afternoonDestinationId || null,
                    afterSchoolDestinations: existingStudent?.afterSchoolDestinations || {}, // Preserve existing
                    suggestedMorningDestination: updateData.suggestedMorningDestination || null,
                    suggestedAfternoonDestination: updateData.suggestedAfternoonDestination || null,
                    applicationStatus: 'pending',
                };
                const addedStudent = await addStudent(newStudentData);
                setAllStudents(prevStudents => [...prevStudents, addedStudent]);
            }
            toast({ title: "신청 완료!", description: `${name} 학생의 등/하교 버스 정보가 업데이트되었습니다.` });
             // Clear form fields
            setMorningDestinationId(null);
            setCustomMorningDestName('');
            setUseCustomMorningDest(false);
            setAfternoonDestinationId(null);
            setCustomAfternoonDestName('');
            setUseCustomAfternoonDest(false);

        } catch (error) {
            console.error("Error submitting main application:", error);
            toast({ title: "오류", description: "신청 제출에 실패했습니다.", variant: 'destructive' });
        }
    }

    const handleAfterSchoolSubmit = async () => {
        if (!validateBaseInfo()) return;

        const existingStudent = findExistingStudent();
        let finalDestinations: Partial<Record<DayOfWeek, string | null>> = existingStudent?.afterSchoolDestinations || {};
        let finalSuggestedDests: Partial<Record<DayOfWeek, string | null>> = existingStudent?.suggestedAfterSchoolDestinations || {};

        let hasError = false;
        const suggestionPromises = [];

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
                    suggestionPromises.push(addSuggestedDestination({ name: customName }));
                    finalDestinations[day] = null;
                    finalSuggestedDests[day] = customName;
                } else {
                    finalDestinations[day] = selectedId || null;
                    finalSuggestedDests[day] = null;
                }
            } else {
                 finalDestinations[day] = finalDestinations[day] !== undefined ? finalDestinations[day] : null;
                 finalSuggestedDests[day] = finalSuggestedDests[day] !== undefined ? finalSuggestedDests[day] : null;
            }
        }
        if (hasError) return;
        
        try {
            await Promise.all(suggestionPromises);
            if (suggestionPromises.length > 0) {
                 toast({ title: "제안 제출됨", description: `새로운 방과후 목적지들이 제안되었습니다.` });
            }
        } catch(e) {
            toast({ title: "오류", description: "방과후 목적지 제안 중 오류 발생", variant: "destructive" });
            return;
        }

        const updateData: Partial<Student> = { 
            ...existingStudent, // Preserve existing data
            name: name.trim(),
            grade: grade.trim(),
            class: studentClass.trim(),
            gender,
            afterSchoolDestinations: finalDestinations,
            suggestedAfterSchoolDestinations: finalSuggestedDests,
            applicationStatus: 'pending'
        };

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
                    morningDestinationId: existingStudent?.morningDestinationId || null,
                    afternoonDestinationId: existingStudent?.afternoonDestinationId || null,
                    afterSchoolDestinations: finalDestinations,
                    suggestedAfterSchoolDestinations: finalSuggestedDests,
                    applicationStatus: 'pending'
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
                             <CardDescription>등교, 하교 시 하차할 목적지를 선택하고 신청하세요. 하나만 신청 가능합니다.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="morningDestinationId">등교 목적지</Label>
                                <Combobox 
                                    options={destinationOptions}
                                    value={morningDestinationId}
                                    onSelect={setMorningDestinationId}
                                    placeholder="목적지 선택 또는 검색..."
                                    disabled={useCustomMorningDest}
                                />
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="useCustomMorningDest" checked={useCustomMorningDest} onCheckedChange={(checked) => setUseCustomMorningDest(checked as boolean)} />
                                <label htmlFor="useCustomMorningDest" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    등교 목적지가 없나요? 직접 입력하세요.
                                </label>
                            </div>
                            {useCustomMorningDest && (
                                <div className="space-y-2">
                                    <Label htmlFor="customMorningDestName">새 등교 목적지 이름</Label>
                                    <Input id="customMorningDestName" value={customMorningDestName} onChange={e => setCustomMorningDestName(e.target.value)} placeholder="예: 서초역 1번 출구" />
                                </div>
                            )}
                            
                            <Separator />

                            <div className="space-y-2">
                                <Label htmlFor="afternoonDestinationId">하교 목적지</Label>
                                <Combobox 
                                    options={destinationOptions}
                                    value={afternoonDestinationId}
                                    onSelect={setAfternoonDestinationId}
                                    placeholder="목적지 선택 또는 검색..."
                                    disabled={useCustomAfternoonDest}
                                />
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="useCustomAfternoonDest" checked={useCustomAfternoonDest} onCheckedChange={(checked) => setUseCustomAfternoonDest(checked as boolean)} />
                                <label htmlFor="useCustomAfternoonDest" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    하교 목적지가 없나요? 직접 입력하세요.
                                </label>
                            </div>
                            {useCustomAfternoonDest && (
                                <div className="space-y-2">
                                    <Label htmlFor="customAfternoonDestName">새 하교 목적지 이름</Label>
                                    <Input id="customAfternoonDestName" value={customAfternoonDestName} onChange={e => setCustomAfternoonDestName(e.target.value)} placeholder="예: 강남역 5번 출구" />
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
                                     <Combobox 
                                        options={destinationOptions}
                                        value={afterSchoolDestinations[day]}
                                        onSelect={(value) => setAfterSchoolDestinations(prev => ({...prev, [day]: value}))}
                                        placeholder="목적지 선택 또는 검색..."
                                        disabled={!!useCustomAfterSchoolDests[day]}
                                    />
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
