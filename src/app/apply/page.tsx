
'use client';
import React, { useState, useEffect } from 'react';
import { getDestinations, addStudent, addSuggestedDestination } from '@/lib/firebase-data';
import { Destination, NewStudent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, PlusCircle } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { MainLayout } from '@/components/layout/main-layout';
import { Checkbox } from '@/components/ui/checkbox';

export default function ApplyPage() {
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [formData, setFormData] = useState<Partial<NewStudent>>({ gender: 'Male' });
    const [newDestinationName, setNewDestinationName] = useState('');
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [applyForAfterSchool, setApplyForAfterSchool] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            const destinationsData = await getDestinations();
            setDestinations(destinationsData);
        };
        fetchData();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSelectChange = (name: keyof NewStudent, value: string) => {
        setFormData(prev => ({ ...prev, [name]: value }));
         if(name === 'mainDestinationId') {
            setIsSuggesting(false);
        }
    };

    const validateForm = (data: Partial<NewStudent>): data is NewStudent => {
        const baseInfoValid = !!data.name && !!data.grade && !!data.class && !!data.gender;
        if (!baseInfoValid) return false;

        const mainDestinationValid = !!data.mainDestinationId || isSuggesting;
        const afterSchoolDestinationValid = applyForAfterSchool ? !!data.afterSchoolDestinationId : true;

        return mainDestinationValid && afterSchoolDestinationValid;
    }

    const submitApplication = async (studentData: NewStudent) => {
        try {
            await addStudent(studentData);
            toast({
              title: "신청 완료!",
              description: `${studentData.name} 학생의 탑승 신청이 완료되었습니다. 관리자 확인 후 배정됩니다.`,
            });
            setFormData({ gender: 'Male' });
            setNewDestinationName('');
            setApplyForAfterSchool(false);
        } catch (error) {
            console.error("Error submitting application:", error);
            toast({ title: "오류", description: "신청 제출에 실패했습니다.", variant: 'destructive' });
        }
    };
    
    const handleApplicationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        
        const finalStudentData: Partial<NewStudent> = {
            ...formData,
            afterSchoolDestinationId: applyForAfterSchool ? formData.afterSchoolDestinationId : null,
        };

        if (!validateForm(finalStudentData)) {
            toast({ title: "오류", description: "모든 필수 필드를 입력하거나 목적지를 제안해주세요.", variant: 'destructive' });
            return;
        }

        await submitApplication(finalStudentData as NewStudent);
    };

    const handleSuggestionSubmit = async () => {
        const { name, grade, class: studentClass, gender } = formData;

        if (!name || !grade || !studentClass || !gender) {
            toast({ title: "오류", description: "목적지를 제안하기 전에 학생 정보를 먼저 입력해주세요.", variant: "destructive" });
            return;
        }
        if (!newDestinationName.trim()) {
            toast({ title: "오류", description: "목적지 이름을 입력해주세요.", variant: "destructive" });
            return;
        }

        try {
            // This is a simplified approach. In a real app, you might want to wait for approval
            // before making it selectable. Here we just submit with a special marker.
            const suggestedDestinationId = `suggested: ${newDestinationName.trim()}`;
            
            await addSuggestedDestination({ name: newDestinationName.trim() });
            
            // Assume suggestion applies to main destination for simplicity here
            setFormData(prev => ({...prev, mainDestinationId: suggestedDestinationId }));
            setIsSuggesting(false);
            
            toast({ title: "제안 제출됨", description: "새로운 목적지가 제안되었습니다. 목록에서 선택하여 신청을 완료해주세요."})

            document.getElementById('suggest-dest-dialog-close')?.click();
        } catch (error) {
            console.error("Error submitting suggestion:", error);
            toast({ title: "오류", description: "제안 처리에 실패했습니다.", variant: "destructive" });
        }
    }


    return (
        <MainLayout>
            <div className="flex justify-center items-start">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline">
                            <UserPlus />
                            스쿨버스 탑승 신청
                        </CardTitle>
                        <CardDescription>
                            아래 양식을 작성하여 스쿨버스 탑승을 신청하세요. 관리자 확인 후 좌석이 배정됩니다.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleApplicationSubmit} className="grid gap-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">이름</Label>
                                    <Input id="name" name="name" placeholder="예: 김민준" required value={formData.name || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mainDestinationId">등/하교 목적지</Label>
                                    <div className="flex gap-2">
                                        <Select name="mainDestinationId" required={!isSuggesting} value={formData.mainDestinationId || ''} onValueChange={(v) => handleSelectChange('mainDestinationId', v)}>
                                            <SelectTrigger id="mainDestinationId">
                                                <SelectValue placeholder="목적지 선택" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" type="button" className="shrink-0" onClick={() => setIsSuggesting(true)}>
                                                    <PlusCircle className="mr-2 h-4 w-4" /> 제안
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>신규 목적지 제안</DialogTitle>
                                                </DialogHeader>
                                                <div className="grid gap-4 py-4">
                                                    <p className="text-sm text-muted-foreground">
                                                        목록에 원하는 목적지가 없나요? 새로운 목적지를 제안해주세요. 관리자 승인 후 노선에 추가됩니다.
                                                    </p>
                                                    <Input 
                                                        placeholder="예: 서초역" 
                                                        value={newDestinationName}
                                                        onChange={(e) => setNewDestinationName(e.target.value)}
                                                    />
                                                </div>
                                                <Button onClick={handleSuggestionSubmit}>제안하기</Button>
                                                <DialogClose id="suggest-dest-dialog-close" />
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                    {isSuggesting && (
                                        <p className="text-sm text-primary font-medium mt-2">
                                            '제안' 버튼을 통해 목적지를 제안하고 신청을 완료해주세요.
                                        </p>
                                    )}
                                </div>
                            </div>
                             <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="grade">학년</Label>
                                    <Input id="grade" name="grade" placeholder="예: G1" required value={formData.grade || ''} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="class">반</Label>
                                    <Input id="class" name="class" placeholder="예: C1" required value={formData.class || ''} onChange={handleInputChange}/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gender">성별</Label>
                                    <Select name="gender" required value={formData.gender || 'Male'} onValueChange={(v) => handleSelectChange('gender', v as 'Male' | 'Female')}>
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
                            <div className="space-y-4 rounded-md border p-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="afterSchool" checked={applyForAfterSchool} onCheckedChange={(checked) => setApplyForAfterSchool(checked as boolean)} />
                                    <label
                                        htmlFor="afterSchool"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        방과후 버스 탑승 신청
                                    </label>
                                </div>
                                {applyForAfterSchool && (
                                     <div className="space-y-2">
                                        <Label htmlFor="afterSchoolDestinationId">방과후 목적지</Label>
                                        <Select name="afterSchoolDestinationId" required={applyForAfterSchool} value={formData.afterSchoolDestinationId || ''} onValueChange={(v) => handleSelectChange('afterSchoolDestinationId', v)}>
                                            <SelectTrigger id="afterSchoolDestinationId">
                                                <SelectValue placeholder="방과후 하차 목적지 선택" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">방과후 수업 후 하차할 목적지를 선택하세요. (등/하교 목적지와 달라도 됩니다.)</p>
                                    </div>
                                )}
                            </div>
                            <Button type="submit" className="w-full" disabled={isSuggesting}>신청하기</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
