'use client';
import { useState, useEffect, useTransition } from 'react';
import { calculateVolunteerTime } from '@/ai/flows/calculate-volunteer-time';
import { Student } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RotateCw, Sparkles } from 'lucide-react';

interface VolunteerTimeCalculatorProps {
    student: Student;
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
}

export function VolunteerTimeCalculator({ student, setStudents }: VolunteerTimeCalculatorProps) {
  const [days, setDays] = useState(student.daysAsGroupLeader);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // Sync local state if the selected student changes
    setDays(student.daysAsGroupLeader);
  }, [student]);

  useEffect(() => {
    const calculate = async () => {
      if (student.isGroupLeader && days > 0) {
        startTransition(async () => {
            try {
              const result = await calculateVolunteerTime({
                isGroupLeader: true,
                daysAsGroupLeader: days,
              });
              setTotalMinutes(result.totalVolunteerTimeMinutes);
            } catch (error) {
              console.error("Failed to calculate volunteer time:", error);
            }
        });
      } else {
        setTotalMinutes(0);
      }
    };
    calculate();
  }, [days, student.isGroupLeader]);

  const handleDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDays = parseInt(e.target.value, 10) || 0;
    setDays(newDays);
    setStudents(prev => prev.map(s => s.id === student.id ? {...s, daysAsGroupLeader: newDays} : s));
  };
  
  const handleReset = () => {
    setDays(0);
    setStudents(prev => prev.map(s => s.id === student.id ? {...s, daysAsGroupLeader: 0} : s));
  }

  return (
    <Card className="bg-accent/50 border-accent">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-headline">
          <Sparkles className="w-5 h-5 text-accent-foreground" />
          Volunteer Time Calculator
        </CardTitle>
        <CardDescription>Time is calculated at 20 minutes per day.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="daysAsLeader">Days as Group Leader</Label>
            <Input id="daysAsLeader" type="number" value={days} onChange={handleDaysChange} />
        </div>
        <div className="text-center p-4 bg-background rounded-md">
            <p className="text-sm text-muted-foreground">Total Volunteer Time</p>
            <p className="text-3xl font-bold font-headline flex items-center justify-center gap-2">
              {isPending ? <RotateCw className="w-6 h-6 animate-spin" /> : `${totalMinutes}`}
              <span className="text-lg font-medium text-muted-foreground">minutes</span>
            </p>
        </div>
        <Button variant="outline" className="w-full" onClick={handleReset}>Reset Time</Button>
      </CardContent>
    </Card>
  );
}
