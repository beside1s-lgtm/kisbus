
'use client';

import React, { useEffect, useRef } from 'react';
import { Bus, Student, Destination, RouteType, DayOfWeek, GroupLeaderRecord } from '@/lib/types';
import { cn, getStudentName } from '@/lib/utils';
import { Crown, User as UserIcon, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useTranslation } from '@/hooks/use-translation';

interface BusSeatMapProps {
  bus: Bus;
  seating: { seatNumber: number; studentId: string | null }[];
  students: Student[];
  destinations: Destination[];
  onSeatClick?: (seatNumber: number, studentId: string | null) => void;
  onSeatContextMenu?: (e: React.MouseEvent, seatNumber: number) => void;
  notBoardingStudentIds?: string[];
  boardedStudentIds?: string[];
  highlightedStudentId?: string | null;
  highlightedSeatNumber?: number | null;
  routeType?: RouteType;
  dayOfWeek?: DayOfWeek;
  groupLeaderRecords?: GroupLeaderRecord[];
}

const SEAT_MAP_45: (number | null)[] = [
  null, null, null, null, 0,
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
   null, null,  1,  2, // Row 1: 운전석, 공간, 좌석1, 좌석2 (2자리)
     3,  4, null,  5,  // Row 2: 3자리
     6,  7, null,  8,  // Row 3: 3자리
     9, 10, null, 11,  // Row 4: 3자리
    12, 13, 14, 15     // Row 5: 4자리
];


export const getLayoutInfo = (capacity: number) => {
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
  notBoardingStudentIds = [],
  boardedStudentIds = [],
  highlightedStudentId = null,
  highlightedSeatNumber = null,
  routeType = 'Morning',
  dayOfWeek = 'Monday',
  groupLeaderRecords = [],
}: BusSeatMapProps) {
  const { i18n, t } = useTranslation();
  const highlightedRef = useRef<HTMLDivElement>(null);

  const getStudentById = (id: string | null) => {
    if (!id) return null;
    return students.find(s => s.id === id);
  };
  
  const { gridClass, seatMap } = getLayoutInfo(bus.capacity);

  const formatStudentName = (student: Student) => {
    const grade = (student.grade || '').toUpperCase();
    const studentClass = student.class || '';
    const name = getStudentName(student, i18n.language) || '';
    return `${grade}${studentClass} ${name}`.trim();
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

            let seat = seating.find(s => s.seatNumber === seatNumber);
            if (!seat) {
                // For backward compatibility (if an existing route doesn't have the newly added jump seat)
                // render an empty faked seat so teachers/admins can still manually assign a student to it.
                seat = { seatNumber, studentId: null };
            }

            const student = getStudentById(seat.studentId);
            const isNotBoarding = !!student && notBoardingStudentIds.includes(student.id);
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
                      isNotBoarding && 'bg-blue-300 dark:bg-blue-800'
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
                    isNotBoarding && 'bg-blue-300 dark:bg-blue-800 border-solid'
                  )}
                >
                  <span className="absolute top-1 left-1 text-[10px] font-bold text-muted-foreground">{seat.seatNumber === 0 ? '입석' : seat.seatNumber}</span>
                  {seatContent}
                </div>
              </div>
            );
          })}
        </div>

        {/* Overflow / Standby Students section */}
        {(() => {
          const seatNumbersInMap = new Set(seatMap.filter(n => n !== null) as number[]);
          const overflowStudents = seating.filter(s => s.studentId && !seatNumbersInMap.has(s.seatNumber));
          
          if (overflowStudents.length === 0) return null;
          
          return (
            <div className="mt-8 border-t pt-4 border-amber-200">
              <h4 className="text-[11px] font-bold text-amber-600 mb-3 flex items-center gap-2 uppercase tracking-tight">
                <XCircle className="w-3.5 h-3.5" /> {t('admin.student_management.overflow.title', '기타/대기 좌석')} (레이아웃 외 배정: {overflowStudents.length}명)
              </h4>
              <div className="flex flex-wrap gap-2.5">
                {overflowStudents.map(seat => {
                  const student = getStudentById(seat.studentId);
                  if (!student) return null;
                  
                  return (
                    <div 
                      key={`overflow-${seat.seatNumber}-${student.id}`} 
                      onClick={() => onSeatClick && onSeatClick(seat.seatNumber, student.id)}
                      className={cn(
                        "px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-amber-100 transition-all hover:shadow-sm",
                        highlightedSeatNumber === seat.seatNumber && "ring-2 ring-primary ring-offset-2"
                      )}
                    >
                      <span className="font-bold text-amber-700 bg-amber-200/50 px-1 rounded">{seat.seatNumber === 0 ? '입석' : seat.seatNumber}</span>
                      <span className="font-medium text-amber-900">{formatStudentName(student)}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-amber-600/70 mt-2.5 leading-relaxed bg-amber-50/50 p-2 rounded border border-dashed border-amber-200">
                * 버스 종류 변경 등으로 인해 기존 좌석 번호가 현재 레이아웃에 맞지 않는 학생들입니다.<br/>
                * <b>성함 또는 아이콘을 클릭</b>하면 해당 학생이 선택되며, 이후 좌석표의 <b>빈자리를 클릭</b>하여 정상적으로 재배정할 수 있습니다.
              </p>
            </div>
          );
        })()}
      </div>
    </TooltipProvider>
  );
}
