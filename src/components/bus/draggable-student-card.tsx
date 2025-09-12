'use client';
import React from 'react';
import { Student } from '@/lib/types';
import { Card } from '../ui/card';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DraggableStudentCardProps {
  student: Student;
  className?: string;
}

export const DraggableStudentCard: React.FC<DraggableStudentCardProps> = ({ student, className }) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData('studentId', student.id);
  };

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
      <span className="text-sm font-medium">{student.name}</span>
    </Card>
  );
};
