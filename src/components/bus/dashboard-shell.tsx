'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bus, DayOfWeek, RouteType } from '@/lib/types';
import { Separator } from '../ui/separator';

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
  sidePanelTitle = "Details"
}: DashboardShellProps) {
  const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="font-headline">Route Configuration</CardTitle>
          <div className="flex items-center gap-2">
            {topActions}
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium">Bus</label>
            <Select value={selectedBusId} onValueChange={setSelectedBusId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a bus" />
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
            <label className="text-sm font-medium">Day of Week</label>
            <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a day" />
              </SelectTrigger>
              <SelectContent>
                {days.map((day) => (
                  <SelectItem key={day} value={day}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Route</label>
            <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="Morning">Morning</TabsTrigger>
                <TabsTrigger value="Afternoon">Afternoon</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {mainContent}
        </div>
        {sidePanel && (
          <div className="lg:col-span-1">
             <Card className="sticky top-20">
              <CardHeader>
                <CardTitle className="font-headline">{sidePanelTitle}</CardTitle>
              </CardHeader>
              <Separator className="mb-4" />
              <CardContent className='max-h-[60vh] overflow-y-auto'>
                {sidePanel}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
