
'use client';
import React from 'react';
import { Student, Destination, RouteType, DayOfWeek } from '@/lib/types';
import { Card } from '../ui/card';
import { cn } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';

interface StudentCardProps {
  student: Student;
  destinations: Destination[];
  className?: string;
  isChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
  onClick: () => void;
  routeType: RouteType;
  dayOfWeek: DayOfWeek;
}

export const StudentCard: React.FC<StudentCardProps> = ({ 
    student, 
    destinations, 
    className,
    isChecked,
    onCheckedChange,
    onClick,
    routeType,
    dayOfWeek,
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
        'p-2 mb-2 flex items-center gap-2 cursor-pointer bg-card hover:bg-muted/80 transition-colors',
        className
      )}
      onClick={onClick}
    >
      <div className="flex-1 truncate">
        <span className="text-sm font-medium">{formatStudentName(student)}</span>
        <p className="text-xs text-muted-foreground">{studentDestinationName}</p>
      </div>
      <Checkbox
        checked={isChecked}
        onCheckedChange={onCheckedChange}
        aria-label={`Select ${student.name}`}
        onClick={(e) => e.stopPropagation()} // Prevent card click when checkbox is clicked
      />
    </Card>
  );
};
