
'use client';

import React, { useEffect, useRef } from 'react';
import { Bus, Student, Destination } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Crown, User as UserIcon, XCircle } from 'lucide-react';
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

const getGridLayout = (capacity: number) => {
  switch (capacity) {
    case 45:
      return 'grid-cols-5 gap-2 md:gap-4';
    case 29:
    case 15:
      return 'grid-cols-4 gap-2 md:gap-4';
    default:
      return 'grid-cols-5 gap-4';
  }
};

const isAisle = (seatIndex: number, capacity: number) => {
  const seatNumber = seatIndex + 1;
  switch (capacity) {
    case 45:
      return (seatNumber - 3) % 5 === 0;
    case 29:
    case 15:
      return (seatNumber - 3) % 4 === 0;
    default:
      return false;
  }
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

  return (
    <TooltipProvider>
      <div className="p-4 border rounded-lg bg-muted/20 overflow-auto">
        <div className="w-full mb-4 text-center">
          <div className="inline-block px-4 py-2 font-bold border-2 rounded-md bg-secondary text-secondary-foreground">
            {bus.name} - 운전석
          </div>
        </div>
        <div className={cn('grid', getGridLayout(bus.capacity))}>
          {Array.from({ length: bus.capacity + Math.floor(bus.capacity / 4) }).map((_, i) => {
             const aisle = isAisle(i, bus.capacity);
             if (aisle) {
               return <div key={`aisle-${i}`} className="w-full h-full"></div>;
             }

             const seatIndex = i - Math.floor(i / (bus.capacity === 45 ? 5 : 4));
             const seat = seating.find(s => s.seatNumber === seatIndex + 1);
             
             if (!seat) return null;

             const student = getStudentById(seat.studentId);
             const isAbsent = student ? absentStudentIds.includes(student.id) : false;
             const isBoarded = student ? boardedStudentIds.includes(student.id) : false;
             const isHighlighted = student ? highlightedStudentId === student.id : false;

             const seatClasses = cn(
               'relative aspect-square rounded-md flex flex-col items-center justify-center transition-all duration-200 shadow-sm',
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
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, seat.seatNumber)}
                    onClick={() => onSeatClick && onSeatClick(seat.seatNumber, student?.id || null)}
                    className={seatClasses}
                  >
                    {student ? (
                      <>
                        {student.isGroupLeader && (
                          <Crown className="absolute w-5 h-5 -top-3 -right-3 text-yellow-500" />
                        )}
                        {isAbsent && (
                           <XCircle className="absolute w-5 h-5 text-destructive" />
                        )}
                        <Avatar className="w-8 h-8 md:w-10 md:h-10">
                          <AvatarFallback className={cn(isBoarded && 'bg-green-200 dark:bg-green-900')}>{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="mt-1 text-xs font-medium text-center truncate">{student.name}</span>
                      </>
                    ) : (
                      <UserIcon className="w-6 h-6 text-muted-foreground" />
                    )}
                    <span className="absolute top-1 left-1 text-[10px] font-bold text-muted-foreground">{seat.seatNumber}</span>
                  </div>
                </TooltipTrigger>
                {student && (
                  <TooltipContent>
                    <p>이름: {student.name}</p>
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
