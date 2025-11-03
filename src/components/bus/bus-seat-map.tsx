
'use client';

import React, { useEffect, useRef } from 'react';
import { Bus, Student, Destination, RouteType, DayOfWeek, GroupLeaderRecord } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Crown, User as UserIcon, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface BusSeatMapProps {
  bus: Bus;
  seating: { seatNumber: number; studentId: string | null }[];
  students: Student[];
  destinations: Destination[];
  onSeatClick?: (seatNumber: number, studentId: string | null) => void;
  onSeatContextMenu?: (e: React.MouseEvent, seatNumber: number) => void;
  absentStudentIds?: string[];
  boardedStudentIds?: string[];
  highlightedStudentId?: string | null;
  highlightedSeatNumber?: number | null;
  routeType?: RouteType;
  dayOfWeek?: DayOfWeek;
  groupLeaderRecords?: GroupLeaderRecord[];
}

const SEAT_MAP_45: (number | null)[] = [
  1, 2, null, 3, 4,
  5, 6, null, 7, 8,
  9, 10, null, 11, 12,
  13, 14, null, 15, 16,
  17, 18, null, 19, 20,
  21, 22, null, 23, 24,
  25, 26, null, 27, 28,
  29, 30, null, 31, 32,
  33, 34, null, 35, 36,
  37, 38, null, 39, 40,
  41, 42, 43, 44, 45,
];

const SEAT_MAP_29: (number | null)[] = [
  1, 2, null, 3, 4,
  5, 6, null, 7, 8,
  9, 10, null, 11, 12,
  13, 14, null, 15, 16,
  17, 18, null, 19, 20,
  21, 22, null, 23, 24,
  25, 26, 27, 28, 29,
];

const SEAT_MAP_16: (number | null)[] = [
   null,  1,  2,  3,
    4,  5, null,  6,
    7,  8, null,  9,
   10, 11, null, 12,
   13, 14, 15, 16
];


const getLayoutInfo = (capacity: number) => {
    if (capacity === 45) {
        return { gridClass: 'grid-cols-5 gap-1 md:gap-2', seatMap: SEAT_MAP_45 };
    }
    if (capacity === 29) {
        return { gridClass: 'grid-cols-5 gap-1 md:gap-2', seatMap: SEAT_MAP_29 };
    }
    if (capacity === 16) {
         return { 
            gridClass: 'grid-cols-4 gap-1 md:gap-2',
            seatMap: SEAT_MAP_16,
        };
    }
    // Fallback
    return { gridClass: 'grid-cols-5 gap-1 md:gap-2', seatMap: [] };
};


export function BusSeatMap({
  bus,
  seating,
  students,
  destinations,
  onSeatClick,
  onSeatContextMenu,
  absentStudentIds = [],
  boardedStudentIds = [],
  highlightedStudentId = null,
  highlightedSeatNumber = null,
  routeType = 'Morning',
  dayOfWeek = 'Monday',
  groupLeaderRecords = [],
}: BusSeatMapProps) {
  const highlightedRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (highlightedRef.current) {
      highlightedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  }, [highlightedStudentId, highlightedSeatNumber]);

  const getStudentById = (id: string | null) => {
    if (!id) return null;
    return students.find(s => s.id === id);
  };
  
  const { gridClass, seatMap } = getLayoutInfo(bus.capacity);

  const formatStudentName = (student: Student) => {
    const grade = student.grade.toUpperCase();
    const studentClass = student.class;
    return `${grade}${studentClass} ${student.name}`;
  }

  const getDestinationName = (student: Student) => {
      let destId: string | null = null;
      if (routeType === 'Morning') {
        destId = student.morningDestinationId;
      } else if (routeType === 'Afternoon') {
        destId = student.afternoonDestinationId;
      } else if (routeType === 'AfterSchool') {
        destId = student.afterSchoolDestinations?.[dayOfWeek] || null;
      }
      return destinations.find(d => d.id === destId)?.name || 'N/A';
  }

  return (
    <TooltipProvider>
      <div
        data-cy="scroll-container"
        className="p-2 border rounded-lg bg-muted/20 overflow-auto"
      >
        <div className={cn('grid', gridClass)}>
          {seatMap.map((seatNumber, index) => {
            if (seatNumber === null) {
              return <div key={`aisle-${index}`} />;
            }

            const seat = seating.find(s => s.seatNumber === seatNumber);
            if (!seat) return null;

            const student = getStudentById(seat.studentId);
            const isAbsent = !!student && absentStudentIds.includes(student.id);
            const isBoarded = !!student && boardedStudentIds.includes(student.id);
            const isHighlightedByStudent = !!student && highlightedStudentId === student.id;
            const isHighlightedBySeat = highlightedSeatNumber === seat.seatNumber;

            const isHighlighted = isHighlightedByStudent || isHighlightedBySeat;

            const seatContent = (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      'w-full h-full absolute top-0 left-0 rounded-md flex flex-col items-center justify-end pb-1',
                      'bg-card',
                      isBoarded && 'bg-green-300 dark:bg-green-800',
                      isAbsent && 'bg-blue-300 dark:bg-blue-800'
                    )}
                  >
                    {student ? (
                      <>
                        {groupLeaderRecords.some(r => r.studentId === student.id && r.endDate === null) && <Crown className="absolute w-3 h-3 -top-1.5 -right-1.5 text-yellow-500" />}
                        <span className="text-xs font-medium text-center break-keep leading-tight">{formatStudentName(student)}</span>
                      </>
                    ) : (
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </TooltipTrigger>
                {student && (
                  <TooltipContent>
                    <p>이름: {formatStudentName(student)}</p>
                    <p>목적지: {getDestinationName(student)}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            );

            return (
              <div key={seatNumber} className="p-1">
                <div
                  ref={isHighlighted ? highlightedRef : null}
                  data-seat-number={seat.seatNumber}
                  onClick={(e) => {
                    if (onSeatClick) {
                      e.preventDefault();
                      e.stopPropagation();
                      onSeatClick(seat.seatNumber, student?.id || null)
                    }
                  }}
                  onContextMenu={(e) => onSeatContextMenu && onSeatContextMenu(e, seat.seatNumber)}
                  className={cn(
                    'relative h-10 w-full rounded-md flex flex-col justify-center items-center pb-1 transition-all duration-200 shadow-sm',
                    onSeatClick && 'cursor-pointer hover:scale-105 hover:shadow-lg',
                    'bg-card border',
                    isBoarded && 'bg-green-300 dark:bg-green-800 border-solid',
                    isHighlighted && 'ring-4 ring-primary ring-offset-2 ring-offset-background',
                    isAbsent && 'bg-blue-300 dark:bg-blue-800 border-solid'
                  )}
                >
                  <span className="absolute top-1 left-1 text-[10px] font-bold text-muted-foreground">{seat.seatNumber}</span>
                  {seatContent}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
