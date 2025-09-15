

'use client';

import React, { useEffect, useRef } from 'react';
import { Bus, Student, Destination } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Crown, User as UserIcon, XCircle, CircleUserRound } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { Draggable, Droppable } from '@hello-pangea/dnd';

interface BusSeatMapProps {
  bus: Bus;
  seating: { seatNumber: number; studentId: string | null }[];
  students: Student[];
  destinations: Destination[];
  onSeatClick?: (seatNumber: number, studentId: string | null) => void;
  draggable?: boolean;
  absentStudentIds?: string[];
  boardedStudentIds?: string[];
  highlightedStudentId?: string | null;
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

const SEAT_MAP_15: (number | null)[] = [
    null, null, 1,
    2, 3, null,
    4, 5, null,
    6, 7, null,
    8, 9, 10,
    11, 12, null,
    13, 14, 15
];

const getLayoutInfo = (capacity: number) => {
    if (capacity === 45) {
        return { gridClass: 'grid-cols-5 gap-1 md:gap-2', seatMap: SEAT_MAP_45, hasFrontDriver: true };
    }
    if (capacity === 29) {
        return { gridClass: 'grid-cols-5 gap-1 md:gap-2', seatMap: SEAT_MAP_29, hasFrontDriver: true };
    }
    if (capacity === 15) {
         return { 
            gridClass: 'grid-cols-3 gap-1 md:gap-2',
            seatMap: SEAT_MAP_15,
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
  onSeatClick,
  draggable = false,
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

  return (
    <TooltipProvider>
      <div className="p-2 border rounded-lg bg-muted/20 overflow-auto max-w-md mx-auto">
        {hasFrontDriver && (
            <div className="mb-4 flex justify-start">
                 <div className="w-1/5">
                    <div className="relative h-10 rounded-md flex flex-col items-center justify-center bg-secondary text-secondary-foreground">
                        <CircleUserRound className="w-5 h-5" />
                        <span className="mt-1 text-[9px] font-medium">운전석</span>
                    </div>
                </div>
            </div>
        )}
         {!hasFrontDriver && bus.capacity === 15 && (
             <div className="grid grid-cols-3 gap-1 md:gap-2 mb-4">
                 <div className="relative h-10 rounded-md flex flex-col items-center justify-center bg-secondary text-secondary-foreground">
                    <CircleUserRound className="w-5 h-5" />
                    <span className="mt-1 text-[9px] font-medium">운전석</span>
                </div>
                <div></div>
                <div className="relative h-10 rounded-md flex flex-col items-center justify-center bg-secondary text-secondary-foreground">
                    <span className="text-[9px] font-medium">출입문</span>
                </div>
             </div>
        )}
        <div className={cn('grid', gridClass)}>
            {seatMap.map((seatNumber, index) => {
                 if (seatNumber === null) {
                    return <div key={`aisle-${index}`}></div>;
                }

                const seat = seating.find(s => s.seatNumber === seatNumber);
                if (!seat) return null;

                const student = getStudentById(seat.studentId);
                const isAbsent = student ? absentStudentIds.includes(student.id) : false;
                const isBoarded = student ? boardedStudentIds.includes(student.id) : false;
                const isHighlighted = student ? highlightedStudentId === student.id : false;

                const seatContent = (
                  <Droppable 
                      droppableId={`seat-${seat.seatNumber}`} 
                      isDropDisabled={!draggable}
                  >
                      {(provided, snapshot) => (
                          <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              onClick={() => onSeatClick && onSeatClick(seat.seatNumber, student?.id || null)}
                              className={cn(
                                  'relative h-10 rounded-md flex flex-col items-center justify-end pb-1 transition-all duration-200 shadow-sm p-1',
                                  onSeatClick && 'cursor-pointer hover:scale-105 hover:shadow-lg',
                                  'bg-muted/50 border-2 border-dashed',
                                  snapshot.isDraggingOver && 'bg-primary/20',
                                  isBoarded && 'bg-green-300 dark:bg-green-800 border-solid',
                                  isHighlighted && 'ring-4 ring-primary ring-offset-2 ring-offset-background',
                                  isAbsent && 'bg-destructive/20 text-destructive-foreground/50 opacity-60 border-solid'
                              )}
                          >
                            <span className="absolute top-1 left-1 text-[10px] font-bold text-muted-foreground">{seat.seatNumber}</span>
                            {student ? (
                                <Draggable draggableId={student.id} index={0}>
                                    {(provided, snapshot) => (
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div
                                                    ref={isHighlighted ? (el) => { provided.innerRef(el); highlightedSeatRef.current = el; } : provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                    className={cn(
                                                        'w-full h-full absolute top-0 left-0 rounded-md flex flex-col items-center justify-end pb-1',
                                                        draggable && 'cursor-grab active:cursor-grabbing',
                                                        snapshot.isDragging ? 'bg-muted/50 border-2 border-dashed text-transparent' : 'bg-card',
                                                        isBoarded && !snapshot.isDragging && 'bg-green-300 dark:bg-green-800',
                                                        isHighlighted && !snapshot.isDragging && 'ring-4 ring-primary ring-offset-2 ring-offset-background',
                                                        isAbsent && !snapshot.isDragging && 'bg-destructive/20 text-destructive-foreground/50 opacity-60'
                                                    )}
                                                >
                                                   {!snapshot.isDragging && (
                                                      <>
                                                        {student.isGroupLeader && <Crown className="absolute w-3 h-3 -top-1.5 -right-1.5 text-yellow-500" />}
                                                        {isAbsent && <XCircle className="absolute w-3 h-3 text-destructive" />}
                                                        <span className="text-xs font-medium text-center break-words leading-tight">{formatStudentName(student)}</span>
                                                      </>
                                                   )}
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>이름: {formatStudentName(student)}</p>
                                                <p>목적지: {destinations.find(d => d.id === student.destinationId)?.name || 'N/A'}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    )}
                                </Draggable>
                            ) : (
                               <UserIcon className="w-4 h-4 text-muted-foreground self-center my-auto" />
                            )}
                            {provided.placeholder}
                          </div>
                      )}
                  </Droppable>
                );
                
                return <div key={seatNumber}>{seatContent}</div>
            })}
        </div>
      </div>
    </TooltipProvider>
  );
}
