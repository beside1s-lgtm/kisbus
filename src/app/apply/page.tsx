
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
import { UserPlus } from 'lucide-react';

export default function ApplyPage() {
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
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

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
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

    return (
        <div className="flex justify-center items-start pt-8">
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
                    <form onSubmit={handleSubmit} className="grid gap-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">이름</Label>
                                <Input id="name" name="name" placeholder="예: 김민준" required />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="destination">목적지</Label>
                                <Select name="destination" required>
                                    <SelectTrigger id="destination">
                                        <SelectValue placeholder="목적지 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
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
    );
}
