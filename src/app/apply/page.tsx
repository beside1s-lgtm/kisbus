
'use client';
import React, { useState, useEffect } from 'react';
import { getStudents, getDestinations, addStudent, addSuggestedDestination, updateStudent } from '@/lib/firebase-data';
import { Destination, NewStudent, Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, PlusCircle, Bus, Clock } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { MainLayout } from '@/components/layout/main-layout';
import { Checkbox } from '@/components/ui/checkbox';

export default function ApplyPage() {
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    
    // Form States
    const [name, setName] = useState('');
    const [grade, setGrade] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [gender, setGender] = useState<'Male' | 'Female'>('Male');
    
    const [mainDestinationId, setMainDestinationId] = useState<string | null>(null);
    const [afterSchoolDestinationId, setAfterSchoolDestinationId] = useState<string | null>(null);
    
    const [useCustomMainDest, setUseCustomMainDest] = useState(false);
    const [useCustomAfterSchoolDest, setUseCustomAfterSchoolDest] = useState(false);
    const [customMainDestName, setCustomMainDestName] = useState('');
    const [customAfterSchoolDestName, setCustomAfterSchoolDestName] = useState('');

    const [newDestinationName, setNewDestinationName] = useState('');
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
    
    const handleSubmit = async (type: 'main' | 'afterSchool') => {
        if (!validateBaseInfo()) return;
        
        const isCustom = type === 'main' ? useCustomMainDest : useCustomAfterSchoolDest;
        const customDestName = type === 'main' ? customMainDestName.trim() : customAfterSchoolDestName.trim();
        const destinationId = type === 'main' ? mainDestinationId : afterSchoolDestinationId;

        if (!isCustom && !destinationId) {
            toast({ title: "오류", description: "목적지를 선택해주세요.", variant: "destructive" });
            return;
        }
        if (isCustom && !customDestName) {
            toast({ title: "오류", description: "새로운 목적지 이름을 입력해주세요.", variant: "destructive" });
            return;
        }

        const existingStudent = findExistingStudent();
        
        let updateData: Partial<NewStudent> = {};
        let newStudentData: Partial<NewStudent> = {
            name: name.trim(),
            grade: grade.trim(),
            class: studentClass.trim(),
            gender,
        };

        if (isCustom) {
            try {
                await addSuggestedDestination({ name: customDestName });
                toast({ title: "제안 제출됨", description: `"${customDestName}" 목적지가 제안되었습니다. 관리자 승인 후 정식 목록에 추가됩니다.` });

                if(type === 'main') {
                    updateData.suggestedMainDestination = customDestName;
                    updateData.mainDestinationId = null; // Clear existing selection
                } else {
                    updateData.suggestedAfterSchoolDestination = customDestName;
                    updateData.afterSchoolDestinationId = null; // Clear existing selection
                }
            } catch(e) {
                toast({ title: "오류", description: "목적지 제안 실패", variant: "destructive" });
                return;
            }
        } else {
            if(type === 'main') {
                updateData.mainDestinationId = destinationId;
                updateData.suggestedMainDestination = null;
            } else {
                updateData.afterSchoolDestinationId = destinationId;
                updateData.suggestedAfterSchoolDestination = null;
            }
        }

        try {
            if (existingStudent) {
                // Update existing student
                await updateStudent(existingStudent.id, updateData);
                
                // Update local state
                setAllStudents(prevStudents => prevStudents.map(s => 
                    s.id === existingStudent.id ? { ...s, ...updateData } : s
                ));
                
                toast({
                    title: "신청 완료!",
                    description: `${name} 학생의 ${type === 'main' ? '등/하교' : '방과후'} 버스 정보가 업데이트되었습니다.`,
                });
            } else {
                // Add new student
                const finalNewStudentData: NewStudent = {
                    name: name.trim(),
                    grade: grade.trim(),
                    class: studentClass.trim(),
                    gender,
                    mainDestinationId: type === 'main' && !isCustom ? destinationId : null,
                    afterSchoolDestinationId: type === 'afterSchool' && !isCustom ? destinationId : null,
                    suggestedMainDestination: type === 'main' && isCustom ? customDestName : null,
                    suggestedAfterSchoolDestination: type === 'afterSchool' && isCustom ? customDestName : null,
                };
                const addedStudent = await addStudent(finalNewStudentData);
                
                // Update local state
                setAllStudents(prevStudents => [...prevStudents, addedStudent]);
                
                toast({
                    title: "신청 완료!",
                    description: `${name} 학생의 ${type === 'main' ? '등/하교' : '방과후'} 버스 탑승 신청이 완료되었습니다.`,
                });
            }

            // Clear form fields after submission
            if(type === 'main') {
                setMainDestinationId(null);
                setCustomMainDestName('');
                setUseCustomMainDest(false);
            } else {
                setAfterSchoolDestinationId(null);
                setCustomAfterSchoolDestName('');
                setUseCustomAfterSchoolDest(false);
            }

        } catch (error) {
            console.error("Error submitting application:", error);
            toast({ title: "오류", description: "신청 제출에 실패했습니다.", variant: 'destructive' });
        }
    }

    const handleSuggestionSubmit = async () => {
        if (!newDestinationName.trim()) {
            toast({ title: "오류", description: "제안할 목적지 이름을 입력해주세요.", variant: "destructive" });
            return;
        }

        try {
            await addSuggestedDestination({ name: newDestinationName.trim() });
            setNewDestinationName('');
            toast({ title: "제안 제출됨", description: "새로운 목적지가 제안되었습니다. 관리자 승인 후 목록에 추가됩니다."})
            document.getElementById('suggest-dest-dialog-close')?.click();
        } catch (error) {
            console.error("Error submitting suggestion:", error);
            toast({ title: "오류", description: "제안 처리에 실패했습니다.", variant: "destructive" });
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
                            <Button onClick={() => handleSubmit('main')} className="w-full">등/하교 버스 신청</Button>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline"><Clock /> 방과후 버스</CardTitle>
                            <CardDescription>방과후 수업 하차 목적지를 선택하고 신청하세요.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="afterSchoolDestinationId">방과후 목적지</Label>
                                <Select name="afterSchoolDestinationId" value={afterSchoolDestinationId || ''} onValueChange={setAfterSchoolDestinationId} disabled={useCustomAfterSchoolDest}>
                                    <SelectTrigger id="afterSchoolDestinationId">
                                        <SelectValue placeholder="방과후 하차 목적지 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="useCustomAfterSchoolDest" checked={useCustomAfterSchoolDest} onCheckedChange={(checked) => setUseCustomAfterSchoolDest(checked as boolean)} />
                                <label htmlFor="useCustomAfterSchoolDest" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    찾는 목적지가 없나요? 직접 입력하세요.
                                </label>
                            </div>
                             {useCustomAfterSchoolDest && (
                                <div className="space-y-2">
                                    <Label htmlFor="customAfterSchoolDestName">새 방과후 목적지 이름</Label>
                                    <Input id="customAfterSchoolDestName" value={customAfterSchoolDestName} onChange={e => setCustomAfterSchoolDestName(e.target.value)} placeholder="예: 대치동 학원" />
                                </div>
                            )}
                            <Button onClick={() => handleSubmit('afterSchool')} className="w-full">방과후 버스 신청</Button>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="text-center">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="link">
                                <PlusCircle className="mr-2" />
                                찾는 목적지가 없으신가요? (단순 제안)
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                             <DialogHeader>
                                <DialogTitle>신규 목적지 제안</DialogTitle>
                             </DialogHeader>
                             <div className="flex flex-col gap-4">
                                <p className="text-sm text-muted-foreground">
                                    신청과 별개로, 목록에 추가되었으면 하는 목적지를 제안할 수 있습니다.
                                </p>
                                <Input 
                                    placeholder="예: 서초역" 
                                    value={newDestinationName}
                                    onChange={(e) => setNewDestinationName(e.target.value)}
                                />
                                <Button onClick={handleSuggestionSubmit}>제안하기</Button>
                                <DialogClose id="suggest-dest-dialog-close" />
                             </div>
                        </DialogContent>
                    </Dialog>
                </div>

            </div>
        </MainLayout>
    );
}
