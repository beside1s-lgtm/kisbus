
'use client';

import React, { useEffect, useRef } from 'react';
import { Bus, Student, Destination } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Crown, User as UserIcon, XCircle, CircleUserRound } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

// Provided layout from the image for 45-seater
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

// Assuming a similar layout logic for 29-seater
const SEAT_MAP_29: (number | null)[] = [
  1, 2, null, 3, 4,
  5, 6, null, 7, 8,
  9, 10, null, 11, 12,
  13, 14, null, 15, 16,
  17, 18, null, 19, 20,
  21, 22, null, 23, 24,
  25, 26, 27, 28, 29,
];

// Layout for 15-seater
const SEAT_MAP_15: (number | null)[] = [
   null, null, 1, // Exit
   2, 3, null,
   4, 5, null,
   6, 7, null,
   8, 9, 10,
   11, 12, 13,
   14, 15, null, // This layout is a bit odd. Let's try another one.
];

const SEAT_MAP_15_ALT: (number | null)[] = [
// D A S
// S A S
// S A S
// S A S
// S A S
// S A S S
  // This is a complex layout. Let's try to map it based on 3 columns
  null, null, 1, // Driver, Aisle, Seat 1 (This seems wrong, let's follow the old logic for 15-seater for now as it was not the main issue)
];


const getLayoutInfo = (capacity: number) => {
    if (capacity === 45) {
        return { gridClass: 'grid-cols-5 gap-1 md:gap-2', seatMap: SEAT_MAP_45, hasFrontDriver: true };
    }
    if (capacity === 29) {
        return { gridClass: 'grid-cols-5 gap-1 md:gap-2', seatMap: SEAT_MAP_29, hasFrontDriver: true };
    }
    if (capacity === 15) {
        // This is a 2-2-3-3-3-2 layout. It's complex. Let's stick to the old grid logic that worked for 15.
        // It seems to be 3 columns.
         return { 
            gridClass: 'grid-cols-3 gap-1 md:gap-2',
            seatMap: [
                null, // Driver
                null, // Aisle
                1,
                2,
                null,
                3,
                4,
                null,
                5,
                6,
                null,
                7,
                8,
                null,
                9,
                10,
                11,
                12,
                13,
                14,
                15
            ],
            hasFrontDriver: false
        };
    }
    // Fallback
    return { gridClass: 'grid-cols-5 gap-1 md:gap-2', seatMap: [], hasFrontDriver: true };
};


export function BusSeatMap({
  bus,
  seating,
  students,
  destinations,
  onSeatDrop,
  onSeatClick,
  draggable,
  absentStudentIds = [],
  boardedStudentIds = [],
  highlightedStudentId = null,
}: BusSeatMapProps) {
  const highlightedSeatRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (highlightedSeatRef.current) {
      highlightedSeatRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      });
    }
  }, [highlightedStudentId]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, seatNumber: number) => {
    e.preventDefault();
    if (onSeatDrop) {
      const studentId = e.dataTransfer.getData('studentId');
      onSeatDrop(seatNumber, studentId);
    }
  };

  const getStudentById = (id: string | null) => {
    if (!id) return null;
    return students.find(s => s.id === id);
  };
  
  const { gridClass, seatMap, hasFrontDriver } = getLayoutInfo(bus.capacity);

  const formatStudentName = (student: Student) => {
    const grade = student.grade.replace(/\D/g, '');
    const studentClass = student.class.replace(/\D/g, '');
    return `${grade}${studentClass} ${student.name}`;
  }


  const renderSeat = (seatNumber: number | null) => {
    if (seatNumber === null) {
      return <div className="w-full h-full"></div>; // Aisle or empty space
    }
    
    const seat = seating.find(s => s.seatNumber === seatNumber);
    if (!seat) return null;

    const student = getStudentById(seat.studentId);
    const isAbsent = student ? absentStudentIds.includes(student.id) : false;
    const isBoarded = student ? boardedStudentIds.includes(student.id) : false;
    const isHighlighted = student ? highlightedStudentId === student.id : false;

    const seatClasses = cn(
      'relative h-10 rounded-md flex flex-col items-center justify-end pb-1 transition-all duration-200 shadow-sm p-1',
      onSeatClick && 'hover:scale-105 hover:shadow-lg',
      onSeatClick ? 'cursor-pointer' : 'cursor-default',
      student ? 'bg-card' : 'bg-muted/50 border-2 border-dashed',
      isBoarded && 'bg-green-300 dark:bg-green-800',
      isHighlighted && 'ring-4 ring-primary ring-offset-2 ring-offset-background',
      isAbsent && 'bg-destructive/20 text-destructive-foreground/50 opacity-60',
      student && student.isGroupLeader && !isBoarded && 'border-4 border-yellow-400',
      student && student.isGroupLeader && isBoarded && 'border-4 border-yellow-600 dark:border-yellow-300'
    );

    return (
      <Tooltip key={`seat-tooltip-${seat.seatNumber}`}>
        <TooltipTrigger asChild>
          <div
            ref={isHighlighted ? highlightedSeatRef : null}
            id={`seat-${seat.seatNumber}`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, seat.seatNumber)}
            onClick={() => onSeatClick && onSeatClick(seat.seatNumber, student?.id || null)}
            className={seatClasses}
          >
            {student ? (
              <>
                {student.isGroupLeader && (
                  <Crown className="absolute w-3 h-3 -top-1.5 -right-1.5 text-yellow-500" />
                )}
                {isAbsent && (
                   <XCircle className="absolute w-3 h-3 text-destructive" />
                )}
                <span className="text-xs font-medium text-center break-words leading-tight">{formatStudentName(student)}</span>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
            <span className="absolute top-1 left-1 text-[10px] font-bold text-muted-foreground">{seat.seatNumber}</span>
          </div>
        </TooltipTrigger>
        {student && (
          <TooltipContent>
            <p>이름: {formatStudentName(student)}</p>
            <p>목적지: {destinations.find(d => d.id === student.destinationId)?.name || 'N/A'}</p>
          </TooltipContent>
        )}
      </Tooltip>
    );
  };


  return (
    <TooltipProvider>
      <div className="p-2 border rounded-lg bg-muted/20 overflow-auto max-w-md mx-auto">
        {hasFrontDriver && (
            <div className="mb-2 flex justify-start">
                 <div className="w-1/5">
                    <div className="relative h-10 rounded-md flex flex-col items-center justify-center bg-secondary text-secondary-foreground">
                        <CircleUserRound className="w-5 h-5" />
                        <span className="mt-1 text-[9px] font-medium">운전석</span>
                    </div>
                </div>
            </div>
        )}
         {!hasFrontDriver && bus.capacity === 15 && (
             <div className="grid grid-cols-3 gap-1 md:gap-2 mb-2">
                 <div className="relative h-10 rounded-md flex flex-col items-center justify-center bg-secondary text-secondary-foreground">
                    <CircleUserRound className="w-5 h-5" />
                    <span className="mt-1 text-[9px] font-medium">운전석</span>
                </div>
                <div></div>
                <div></div>
             </div>
        )}
        <div className={cn('grid', gridClass)}>
            {seatMap.map((seatNumber, index) => (
                <React.Fragment key={index}>
                    {renderSeat(seatNumber)}
                </React.Fragment>
            ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
