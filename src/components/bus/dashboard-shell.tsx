'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bus, DayOfWeek, RouteType } from '@/lib/types';
import { Separator } from '../ui/separator';
import { cn } from '@/lib/utils';

interface DashboardShellProps {
  buses: Bus[];
  selectedBusId: string;
  setSelectedBusId: (id: string) => void;
  selectedDay: DayOfWeek;
  setSelectedDay: (day: DayOfWeek) => void;
  selectedRouteType: RouteType;
  setSelectedRouteType: (type: RouteType) => void;
  mainContent: React.ReactNode;
  sidePanel?: React.ReactNode;
  topActions?: React.ReactNode;
  sidePanelTitle?: string;
}

export function DashboardShell({
  buses,
  selectedBusId,
  setSelectedBusId,
  selectedDay,
  setSelectedDay,
  selectedRouteType,
  setSelectedRouteType,
  mainContent,
  sidePanel,
  topActions,
  sidePanelTitle = "세부 정보"
}: DashboardShellProps) {
  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dayLabels: { [key in DayOfWeek]: string } = {
    Monday: '월요일',
    Tuesday: '화요일',
    Wednesday: '수요일',
    Thursday: '목요일',
    Friday: '금요일',
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="font-headline">노선 및 현황 조회</CardTitle>
          <div className="flex items-center gap-2">
            {topActions}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium">버스</label>
            <Select value={selectedBusId} onValueChange={setSelectedBusId}>
              <SelectTrigger>
                <SelectValue placeholder="버스를 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {buses.map((bus) => (
                  <SelectItem key={bus.id} value={bus.id}>
                    {bus.name} ({bus.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">요일</label>
            <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
              <SelectTrigger>
                <SelectValue placeholder="요일을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {days.map((day) => (
                  <SelectItem key={day} value={day}>
                    {dayLabels[day]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">경로</label>
            <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="Morning">등교</TabsTrigger>
                <TabsTrigger value="Afternoon">하교</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <div className={cn("grid grid-cols-1 gap-6", sidePanel && "lg:grid-cols-3")}>
        <div className={cn(sidePanel && "lg:col-span-2")}>
          {mainContent}
        </div>
        {sidePanel && (
          <div className="lg:col-span-1">
             <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="font-headline">{sidePanelTitle}</CardTitle>
              </CardHeader>
              <Separator className="mb-4" />
              <CardContent className='max-h-[75vh] overflow-y-auto'>
                {sidePanel}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
