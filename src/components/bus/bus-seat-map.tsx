
'use client';

import React, { useEffect, useRef } from 'react';
import { Bus, Student, Destination } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Crown, User as UserIcon, XCircle, CircleUserRound } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface BusSeatMapProps {
  bus: Bus;
  seating: { seatNumber: number; studentId: string | null }[];
  students: Student[];
  destinations: Destination[];
  onSeatDrop?: (seatNumber: number, studentId: string) => void;
  onSeatClick?: (seatNumber: number, studentId: string | null) => void;
  draggable: boolean;
  absentStudentIds?: string[];
  boardedStudentIds?: string[];
  highlightedStudentId?: string | null;
}

const getGridLayoutInfo = (capacity: number) => {
    if (capacity === 15) {
        // 1 driver + 15 seats = 16 items. 
        // Layout: 
        // D A S
        // S A S
        // S A S
        // S A S
        // S A S
        // S A S S
        return { 
            gridClass: 'grid-cols-3 gap-1 md:gap-2',
            totalItems: 17, // Driver(1) + Seats(15) + Aisles(x), we'll use a loop and counters
            aislePosition: 1, // 2nd column
        };
    }
    // 29 and 45 seaters use a 5-column layout
    // S S A S S
    const regularRows = Math.floor(capacity / 4);
    const lastRowSeats = capacity % 4 === 0 ? (capacity > 0 ? 4 : 0) : capacity % 4;
    
    // For 29 and 45, the last row is special (5 seats)
    if (capacity === 29 || capacity === 45) {
         const numRegularRows = (capacity - 5) / 4;
         const totalItems = (numRegularRows * 5) + 5; // 5 items per row for regular, 5 for last row
         return {
            gridClass: 'grid-cols-5 gap-1 md:gap-2',
            totalItems: totalItems,
            aislePosition: 2,
         }
    }
    
    // Fallback for other capacities, though we only have 15, 29, 45
    return {
        gridClass: 'grid-cols-5 gap-1 md:gap-2',
        totalItems: Math.ceil(capacity / 4) * 5,
        aislePosition: 2,
    };
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
  
  const { gridClass, totalItems, aislePosition } = getGridLayoutInfo(bus.capacity);
  const isLargeBus = bus.capacity === 29 || bus.capacity === 45;

  const formatStudentName = (student: Student) => {
    const grade = student.grade.replace(/\D/g, '');
    const studentClass = student.class.replace(/\D/g, '');
    return `${grade}${studentClass} ${student.name}`;
  }

  let seatCounter = 0;

  return (
    <TooltipProvider>
      <div className="p-2 border rounded-lg bg-muted/20 overflow-auto max-w-md mx-auto">
        {isLargeBus && (
            <div className="mb-2 flex justify-start">
                 <div className="w-1/5">
                    <div className="relative h-10 rounded-md flex flex-col items-center justify-center bg-secondary text-secondary-foreground">
                        <CircleUserRound className="w-5 h-5" />
                        <span className="mt-1 text-[9px] font-medium">운전석</span>
                    </div>
                </div>
            </div>
        )}
        <div className={cn('grid', gridClass)}>
          {Array.from({ length: totalItems }).map((_, i) => {
             const col = i % (aislePosition * 2 + 1); // e.g. 5 for large, 3 for small
             
             // --- Driver Seat ---
             if (!isLargeBus && i === 0) {
                 return (
                    <div key="driver-seat" className="relative h-10 rounded-md flex flex-col items-center justify-center bg-secondary text-secondary-foreground">
                        <CircleUserRound className="w-5 h-5" />
                        <span className="mt-1 text-[9px] font-medium">운전석</span>
                    </div>
                 );
             }
             
             // --- Aisle ---
             let isAisle = col === aislePosition;
             // Special case for last row on large buses
             if(isLargeBus) {
                 const numRegularRows = (bus.capacity - 5) / 4;
                 const row = Math.floor(i / 5);
                 if (row >= numRegularRows) { // This is the last row
                     isAisle = false;
                 }
             }
             if (bus.capacity === 15) {
                 const numRows = Math.ceil(15 / 2);
                 const row = Math.floor(i / 3);
                 if (row === numRows) { // Last row of 15-seater is special
                    isAisle = false;
                 }
                 if(i === 16) isAisle = true; // Manual aisle for last row
             }

             if (isAisle) {
                return <div key={`aisle-${i}`} className="w-full h-full"></div>;
             }
             
             // --- Seat ---
             seatCounter++;
             const seatNumber = seatCounter;
             
             if (seatNumber > bus.capacity) {
                if (bus.capacity === 15 && seatNumber === 16) {
                    return <div key={`empty-16`}></div>; // Special empty spot for 15-seater layout
                }
                return null;
             }

             const seat = seating.find(s => s.seatNumber === seatNumber);
             if (!seat) return null; // Should not happen if seating array is correct

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
              <Tooltip key={`seat-tooltip-${seat.seatNumber}-${i}`}>
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
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
