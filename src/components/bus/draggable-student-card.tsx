
'use client';
import React from 'react';
import { Student, Destination, RouteType, DayOfWeek } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/button';
import { Armchair } from 'lucide-react';

interface StudentCardProps {
  student: Student;
  destinations: Destination[];
  className?: string;
  isChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
  onCardClick: () => void;
  onAssignClick: () => void;
  routeType: RouteType;
  dayOfWeek: DayOfWeek;
}

export const StudentCard: React.FC<StudentCardProps> = ({ 
    student, 
    destinations, 
    className,
    isChecked,
    onCheckedChange,
    onCardClick,
    onAssignClick,
    routeType,
    dayOfWeek,
}) => {
  
  let destinationId: string | null | undefined = null;
  let suggestedDestName: string | null | undefined = null;

  if (routeType === 'Morning') {
    destinationId = student.morningDestinationId;
    suggestedDestName = student.suggestedMorningDestination;
  } else if (routeType === 'Afternoon') {
    destinationId = student.afternoonDestinationId;
    suggestedDestName = student.suggestedAfternoonDestination;
  } else if (routeType === 'AfterSchool') {
    destinationId = student.afterSchoolDestinations?.[dayOfWeek];
    suggestedDestName = student.suggestedAfterSchoolDestinations?.[dayOfWeek];
  }

  const studentDestinationName = destinations.find(d => d.id === destinationId)?.name || suggestedDestName || '미지정';
  
  const formatStudentName = (student: Student) => {
    const grade = student.grade.toUpperCase();
    const studentClass = student.class;
    return `${grade}${studentClass} ${student.name}`;
  }

  return (
    <div
      className={cn(
        'p-2 mb-2 flex items-center gap-2 cursor-pointer bg-card hover:bg-muted/80 transition-colors border rounded-md',
        className
      )}
      onClick={onCardClick}
    >
      <Checkbox
        checked={isChecked}
        onCheckedChange={onCheckedChange}
        aria-label={`Select ${student.name}`}
        onClick={(e) => e.stopPropagation()} // Prevent card click when checkbox is clicked
      />
      <div className="flex-1 truncate">
        <span className="text-sm font-medium">{formatStudentName(student)}</span>
        <p className="text-xs text-muted-foreground">{studentDestinationName}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={(e) => {
          e.stopPropagation();
          onAssignClick();
        }}
        aria-label={`Assign ${student.name} to seat`}
      >
        <Armchair className="h-4 w-4" />
      </Button>
    </div>
  );
};
