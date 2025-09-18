
'use client';
import React from 'react';
import { Student, Destination, RouteType, DayOfWeek } from '@/lib/types';
import { Card } from '../ui/card';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';

interface DraggableStudentCardProps {
  student: Student;
  destinations: Destination[];
  onDestinationChange: (studentId: string, newDestinationId: string, type: 'morning' | 'afternoon' | 'afterSchool') => void;
  className?: string;
  isChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
  routeType: RouteType;
  dayOfWeek: DayOfWeek;
  isDragging?: boolean;
}

export const DraggableStudentCard: React.FC<DraggableStudentCardProps> = ({ 
    student, 
    destinations, 
    className,
    isChecked,
    onCheckedChange,
    routeType,
    dayOfWeek,
    isDragging = false,
}) => {
  
  let destinationId: string | null | undefined = null;

  if (routeType === 'Morning') {
    destinationId = student.morningDestinationId;
  } else if (routeType === 'Afternoon') {
    destinationId = student.afternoonDestinationId;
  } else if (routeType === 'AfterSchool') {
    destinationId = student.afterSchoolDestinations?.[dayOfWeek];
  }

  const studentDestinationName = destinations.find(d => d.id === destinationId)?.name || '미지정';
  
  const formatStudentName = (student: Student) => {
    const grade = student.grade.replace(/\D/g, '');
    const studentClass = student.class.replace(/\D/g, '');
    return `${grade}${studentClass} ${student.name}`;
  }

  return (
    <Card
      className={cn(
        'p-2 mb-2 flex items-center gap-2 cursor-grab active:cursor-grabbing bg-card hover:bg-muted/80 transition-colors',
        className,
        isDragging && 'shadow-lg'
      )}
    >
      <GripVertical className="h-5 w-5 text-muted-foreground" />
      <div className="flex-1">
        <span className="text-sm font-medium">{formatStudentName(student)}</span>
        <p className="text-xs text-muted-foreground">{studentDestinationName}</p>
      </div>
      <Checkbox
        checked={isChecked}
        onCheckedChange={onCheckedChange}
        aria-label={`Select ${student.name}`}
        className={cn(isDragging && "hidden")}
        disabled={isDragging}
      />
    </Card>
  );
};
