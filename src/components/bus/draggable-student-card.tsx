'use client';
import React from 'react';
import { Student, Destination, RouteType, DayOfWeek } from '@/lib/types';
import { cn, getStudentName } from '@/lib/utils';
import { Checkbox } from '../ui/checkbox';
import { Button } from '../ui/button';
import { Armchair, Users } from 'lucide-react';
import { useTranslation } from '@/hooks/use-translation';

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
  const { i18n } = useTranslation();
  
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
    return `${grade}${studentClass} ${getStudentName(student, i18n.language)}`;
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
        <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{formatStudentName(student)}</span>
            {student.siblingGroupId && (
                <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1 rounded border border-primary/20" title="형제/자매">
                    <Users className="w-2.5 h-2.5" /> O
                </span>
            )}
        </div>
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
