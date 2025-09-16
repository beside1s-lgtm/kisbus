
'use client';
import React from 'react';
import { Student, Destination, RouteType, DayOfWeek } from '@/lib/types';
import { Card } from '../ui/card';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
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
    onDestinationChange, 
    className,
    isChecked,
    onCheckedChange,
    routeType,
    dayOfWeek,
    isDragging = false,
}) => {
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement && (e.target.closest('[data-radix-collection-item]') || e.target.closest('[role=checkbox]'))) {
        e.preventDefault();
        return;
    }
    // We don't set data here anymore because react-beautiful-dnd handles it.
  };
  
  let destinationId: string | null | undefined = null;
  let destinationType: 'morning' | 'afternoon' | 'afterSchool' = 'morning';

  if (routeType === 'Morning') {
    destinationId = student.morningDestinationId;
    destinationType = 'morning';
  } else if (routeType === 'Afternoon') {
    destinationId = student.afternoonDestinationId;
    destinationType = 'afternoon';
  } else if (routeType === 'AfterSchool') {
    destinationId = student.afterSchoolDestinations?.[dayOfWeek];
    destinationType = 'afterSchool';
  }

  const studentDestinationName = destinations.find(d => d.id === destinationId)?.name || '미지정';
  
  const formatStudentName = (student: Student) => {
    const grade = student.grade.replace(/\D/g, '');
    const studentClass = student.class.replace(/\D/g, '');
    return `${grade}${studentClass} ${student.name}`;
  }

  return (
    <Card
      onDragStart={handleDragStart} // Keep this to prevent drag on select/checkbox
      className={cn(
        'p-2 mb-2 flex items-center gap-2 cursor-grab active:cursor-grabbing bg-card hover:bg-muted/80 transition-colors',
        className
      )}
    >
      <GripVertical className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm font-medium flex-1">{formatStudentName(student)}</span>
      <Select 
        value={destinationId || ''} 
        onValueChange={(newDestId) => onDestinationChange(student.id, newDestId, destinationType)}
        disabled={isDragging}
      >
        <SelectTrigger className={cn("w-[150px] text-xs", isDragging && "hidden")}>
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
        className={cn(isDragging && "hidden")}
        disabled={isDragging}
      />
    </Card>
  );
};
