
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

const getGridLayout = (capacity: number) => {
    if (capacity === 15) {
        return 'grid-cols-3 gap-1 md:gap-2';
    }
    // 29 and 45 seaters use the same grid layout logic, just different row counts
    return 'grid-cols-5 gap-1 md:gap-2';
};

const isAisle = (itemIndex: number, capacity: number): boolean => {
    if (capacity === 15) {
        const col = itemIndex % 3;
        return col === 1; // Aisle in the middle of 3 columns
    }
    
    const itemCol = itemIndex % 5;
    
    if (capacity === 45 || capacity === 29) {
        const numRows = Math.ceil(capacity / 4);
        const itemRow = Math.floor(itemIndex / 5);

        // The last row of 5 seats has no aisle for 45-seater and 29-seater
        if ((capacity === 45 && itemRow === Math.ceil(45 / 4) -1) || (capacity === 29 && itemRow === Math.ceil(29 / 4) - 1)) {
            return false;
        }
    }
    
    // For 29 and 45 seaters, the aisle is the 3rd column (index 2)
    return itemCol === 2;
};


const getSeatNumberFromIndex = (itemIndex: number, capacity: number): number | null => {
    if (capacity === 15) {
        // Driver is handled separately in JSX
        const seatIndex = itemIndex - 1; // Adjust for driver
        if (itemIndex === 0) return null;
        if (isAisle(itemIndex, capacity)) return null;

        const row = Math.floor(seatIndex / 3);
        const col = seatIndex % 3;

        const seatsInPrevRows = row * 2;
        let seatInRow = col + 1;
        if (col > 1) seatInRow--;
        
        const seatNumber = seatsInPrevRows + seatInRow;
        return seatNumber <= 15 ? seatNumber : null;
    }
    
    // For 29 and 45 seaters
    const itemCol = itemIndex % 5;
    const itemRow = Math.floor(itemIndex / 5);
    
    if (itemIndex === 0) return null; // Driver seat is now handled outside this logic for these capacities

    if (isAisle(itemIndex, capacity)) return null;
   
    const seatsInPrevRows = itemRow * 4;
    let seatInRow = itemCol + 1;
    if (itemCol > 2) seatInRow--;
   
    let seatNumber = seatsInPrevRows + seatInRow;

    if (capacity === 29 && itemRow === Math.ceil(29/4) - 1) {
       seatNumber = (29 - 5) + itemCol + 1;
    } else if (capacity === 45 && itemRow === Math.ceil(45/4) - 1) {
       seatNumber = (45 - 5) + itemCol + 1;
    }
    
    const adjustedIndex = itemIndex -1;
    const adjustedRow = Math.floor(adjustedIndex/5);
    const adjustedCol = adjustedIndex % 5;
    
    if(isAisle(adjustedIndex, capacity)) return null;

    let calculatedSeatNumber = adjustedRow * 4;
    if (adjustedCol < 2) {
      calculatedSeatNumber += adjustedCol + 1;
    } else {
      calculatedSeatNumber += adjustedCol;
    }
    
    if (capacity === 29 && calculatedSeatNumber > 24) {
      return 24 + (adjustedCol + 1);
    }
    if (capacity === 45 && calculatedSeatNumber > 40) {
        return 40 + (adjustedCol + 1);
    }


    return calculatedSeatNumber <= capacity ? calculatedSeatNumber : null;
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
  
  const totalGridItems = bus.capacity === 15 ? (Math.ceil(15/2) * 3) : Math.ceil(bus.capacity / 4) * 5;
  const isLargeBus = bus.capacity === 29 || bus.capacity === 45;

  const formatStudentName = (student: Student) => {
    const grade = student.grade.replace(/\D/g, '');
    const studentClass = student.class.replace(/\D/g, '');
    return `${grade}${studentClass} ${student.name}`;
  }

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
        <div className={cn('grid', getGridLayout(bus.capacity))}>
          {Array.from({ length: totalGridItems }).map((_, i) => {
             if (bus.capacity === 15 && i === 0) {
                 return (
                    <div key="driver-seat" className="relative h-10 rounded-md flex flex-col items-center justify-center bg-secondary text-secondary-foreground">
                        <CircleUserRound className="w-5 h-5" />
                        <span className="mt-1 text-[9px] font-medium">운전석</span>
                    </div>
                 );
             }
             
             let seatNumber: number | null;
             if(isLargeBus) {
                 const adjustedIndex = i;
                 const itemRow = Math.floor(adjustedIndex / 5);
                 const itemCol = adjustedIndex % 5;
                 
                 if(isAisle(adjustedIndex, bus.capacity)) {
                     seatNumber = null;
                 } else {
                     const seatsInPrevRows = itemRow * 4;
                     let seatInRow = itemCol + 1;
                     if(itemCol > 2) seatInRow--;
                     seatNumber = seatsInPrevRows + seatInRow;

                     if (bus.capacity === 29 && itemRow === Math.ceil(bus.capacity/4) - 1) {
                         seatNumber = (bus.capacity - 5) + itemCol + 1;
                     }
                      if (bus.capacity === 45 && itemRow === Math.ceil(bus.capacity/4) - 1) {
                         seatNumber = (bus.capacity - 5) + itemCol + 1;
                     }
                 }

             } else {
                seatNumber = getSeatNumberFromIndex(i, bus.capacity);
             }


             if (seatNumber === null || seatNumber > bus.capacity) {
                 return <div key={`aisle-or-empty-${i}`} className="w-full h-full"></div>;
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
