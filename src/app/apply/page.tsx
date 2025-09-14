
'use client';
import React, { useState, useEffect } from 'react';
import { getDestinations, addStudent, addSuggestedDestination } from '@/lib/firebase-data';
import { Destination, Student, NewStudent } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, PlusCircle } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MainLayout } from '@/components/layout/main-layout';

export default function ApplyPage() {
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [newDestinationName, setNewDestinationName] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            const destinationsData = await getDestinations();
            setDestinations(destinationsData);
        };
        fetchData();
    }, []);

    const handleApplicationSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const newStudentData: NewStudent = {
            name: formData.get('name') as string,
            grade: formData.get('grade') as string,
            class: formData.get('class') as string,
            gender: formData.get('gender') as 'Male' | 'Female',
            destinationId: formData.get('destination') as string,
        };

        if (!newStudentData.name || !newStudentData.grade || !newStudentData.class || !newStudentData.gender || !newStudentData.destinationId) {
            toast({ title: "오류", description: "모든 필드를 입력해주세요.", variant: 'destructive' });
            return;
        }

        try {
            await addStudent(newStudentData);
            toast({
              title: "신청 완료!",
              description: `${newStudentData.name} 학생의 탑승 신청이 완료되었습니다. 관리자 확인 후 배정됩니다.`,
            });
            (event.target as HTMLFormElement).reset();
        } catch (error) {
            console.error("Error submitting application:", error);
            toast({ title: "오류", description: "신청 제출에 실패했습니다.", variant: 'destructive' });
        }
    };

    const handleSuggestionSubmit = async () => {
        if (!newDestinationName.trim()) {
            toast({ title: "오류", description: "목적지 이름을 입력해주세요.", variant: "destructive" });
            return;
        }
        
        try {
            await addSuggestedDestination({ name: newDestinationName.trim() });
            toast({
              title: "제안 완료!",
              description: `'${newDestinationName.trim()}' 목적지 제안이 관리자에게 전달되었습니다.`,
            });
            setNewDestinationName('');
            document.getElementById('suggest-dest-dialog-close')?.click();
        } catch (error) {
            console.error("Error submitting suggestion:", error);
            toast({ title: "오류", description: "목적지 제안에 실패했습니다.", variant: "destructive" });
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
                                    <Input id="name" name="name" placeholder="예: 김민준" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="destination">목적지</Label>
                                    <div className="flex gap-2">
                                        <Select name="destination" required>
                                            <SelectTrigger id="destination">
                                                <SelectValue placeholder="목적지 선택" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <Dialog>
                                            <DialogTrigger asChild>
                                                <Button variant="outline" type="button" className="shrink-0">
                                                    <PlusCircle className="mr-2 h-4 w-4" /> 제안
                                                </Button>
                                            </DialogTrigger>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>신규 목적지 제안</DialogTitle>
                                                </DialogHeader>
                                                <div className="grid gap-4 py-4">
                                                    <p className="text-sm text-muted-foreground">
                                                        목록에 원하는 목적지가 없나요? 새로운 목적지를 제안해주세요. 관리자 승인 후 목록에 추가됩니다.
                                                    </p>
                                                    <Input 
                                                        placeholder="예: 서초역" 
                                                        value={newDestinationName}
                                                        onChange={(e) => setNewDestinationName(e.target.value)}
                                                    />
                                                </div>
                                                <Button onClick={handleSuggestionSubmit}>제안하기</Button>
                                                <div id="suggest-dest-dialog-close" />
                                            </DialogContent>
                                        </Dialog>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="grade">학년</Label>
                                    <Input id="grade" name="grade" placeholder="예: G1" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="class">반</Label>
                                    <Input id="class" name="class" placeholder="예: C1" required />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="gender">성별</Label>
                                    <Select name="gender" required>
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
                            <Button type="submit" className="w-full">신청하기</Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </MainLayout>
    );
}
