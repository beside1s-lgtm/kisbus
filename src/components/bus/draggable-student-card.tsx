
'use client';
import React from 'react';
import { Student, Destination } from '@/lib/types';
import { Card } from '../ui/card';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';

interface DraggableStudentCardProps {
  student: Student;
  destinations: Destination[];
  onDestinationChange: (studentId: string, newDestinationId: string) => void;
  className?: string;
  isChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
}

export const DraggableStudentCard: React.FC<DraggableStudentCardProps> = ({ 
    student, 
    destinations, 
    onDestinationChange, 
    className,
    isChecked,
    onCheckedChange
}) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    // Prevent drag from starting if the click is on the Select trigger or Checkbox
    if (e.target instanceof HTMLElement && (e.target.closest('[data-radix-collection-item]') || e.target.closest('[role=checkbox]'))) {
        e.preventDefault();
        return;
    }
    e.dataTransfer.setData('studentId', student.id);
  };

  const studentDestinationName = destinations.find(d => d.id === student.destinationId)?.name || '미지정';
  
  const formatStudentName = (student: Student) => {
    const grade = student.grade.replace(/\D/g, '');
    const studentClass = student.class.replace(/\D/g, '');
    return `${grade}${studentClass} ${student.name}`;
  }

  return (
    <Card
      draggable
      onDragStart={handleDragStart}
      className={cn(
        'p-2 mb-2 flex items-center gap-2 cursor-grab active:cursor-grabbing bg-card hover:bg-muted/80 transition-colors',
        className
      )}
    >
      <GripVertical className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm font-medium flex-1">{formatStudentName(student)}</span>
      <Select 
        value={student.destinationId || ''} 
        onValueChange={(newDestId) => onDestinationChange(student.id, newDestId)}
      >
        <SelectTrigger className="w-[150px] text-xs">
            <SelectValue placeholder="목적지 선택">{studentDestinationName}</SelectValue>
        </SelectTrigger>
        <SelectContent>
            {destinations.map(dest => (
                <SelectItem key={dest.id} value={dest.id}>
                    {dest.name}
                </SelectItem>
            ))}
        </SelectContent>
      </Select>
      <Checkbox
        checked={isChecked}
        onCheckedChange={onCheckedChange}
        aria-label={`Select ${student.name}`}
      />
    </Card>
  );
};
