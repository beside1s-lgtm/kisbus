
'use client';
import React, { useState, useEffect } from 'react';
import { getDestinations, getStudents } from '@/lib/mock-data';
import { Destination, Student } from '@/lib/types';
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
    const [students, setStudents] = useState<Student[]>([]);
    const [newDestinationName, setNewDestinationName] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            const [destinationsData, studentsData] = await Promise.all([
                getDestinations(),
                getStudents(),
            ]);
            setDestinations(destinationsData);
            setStudents(studentsData);
        };
        fetchData();
    }, []);

    const handleApplicationSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const newStudent: Student = {
            id: `student${students.length + 1}`,
            name: formData.get('name') as string,
            grade: formData.get('grade') as string,
            class: formData.get('class') as string,
            gender: formData.get('gender') as 'Male' | 'Female',
            destinationId: formData.get('destination') as string,
            isGroupLeader: false,
            daysAsGroupLeader: 0,
        };

        // In a real application, you would send this to a server.
        // For now, we'll just add it to the local state to simulate.
        setStudents(prev => [...prev, newStudent]);
        
        toast({
          title: "신청 완료!",
          description: `${newStudent.name} 학생의 탑승 신청이 완료되었습니다. 관리자 확인 후 배정됩니다.`,
        });
        
        (event.target as HTMLFormElement).reset();
    };

    const handleSuggestionSubmit = () => {
        if (!newDestinationName.trim()) {
            toast({ title: "오류", description: "목적지 이름을 입력해주세요.", variant: "destructive" });
            return;
        }

        const newSuggestion: Destination = {
            id: `sugg_${Date.now()}`,
            name: newDestinationName.trim(),
        };

        // In a real app, this would be sent to a database.
        // We'll simulate by storing it in session storage to be picked up by the admin page.
        if(typeof window !== "undefined") {
            const currentSuggestions = JSON.parse(window.sessionStorage.getItem('suggestedDestinations') || '[]');
            window.sessionStorage.setItem('suggestedDestinations', JSON.stringify([...currentSuggestions, newSuggestion]));
        }

        toast({
          title: "제안 완료!",
          description: `'${newSuggestion.name}' 목적지 제안이 관리자에게 전달되었습니다.`,
        });
        setNewDestinationName('');
        // This closes the dialog, but we need to find the trigger and click it.
        // A better approach would be to manage dialog's open state.
        document.getElementById('suggest-dest-dialog-close')?.click();
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
