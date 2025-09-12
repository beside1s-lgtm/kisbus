'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { getBuses, getStudents, getRoutes } from '@/lib/mock-data';
import { Bus, Student, Route, DayOfWeek, RouteType } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { DashboardShell } from '@/components/bus/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PartyPopper } from 'lucide-react';

// For demo, we'll hardcode the student's ID
const LOGGED_IN_STUDENT_ID = 'student6';

export default function StudentPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');

  const [boardedStudentIds, setBoardedStudentIds] = useState<string[]>([]);
  
  useEffect(() => {
    const fetchData = async () => {
      const [busesData, studentsData, routesData] = await Promise.all([
        getBuses(),
        getStudents(),
        getRoutes(),
      ]);
      setBuses(busesData);
      setStudents(studentsData);
      setRoutes(routesData);
      if (busesData.length > 0) {
        setSelectedBusId(busesData[0].id);
      }
    };
    fetchData();
  }, []);

  const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
  
  const currentRoute = useMemo(() => {
    return routes.find(r => 
      r.busId === selectedBusId && 
      r.dayOfWeek === selectedDay && 
      r.type === selectedRouteType
    );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  const handleSeatClick = (seatNumber: number, studentId: string | null) => {
    if (studentId === LOGGED_IN_STUDENT_ID) {
      setBoardedStudentIds(prev =>
        prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
      );
    }
  };
  
  const loggedInStudentOnThisBus = useMemo(() => {
    return currentRoute?.seating.some(s => s.studentId === LOGGED_IN_STUDENT_ID);
  }, [currentRoute]);


  if (!selectedBus || !currentRoute) {
    return <div className="p-4">Loading or select a bus...</div>;
  }

  const mainContent = (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Your Bus Seating</CardTitle>
        <CardDescription>Find your seat and tap it to mark yourself as boarded.</CardDescription>
      </CardHeader>
      <CardContent>
        {loggedInStudentOnThisBus ? (
             <BusSeatMap 
                bus={selectedBus}
                seating={currentRoute.seating}
                students={students}
                draggable={false}
                onSeatClick={handleSeatClick}
                boardedStudentIds={boardedStudentIds}
             />
        ) : (
            <Alert>
                <AlertTitle>You are not on this bus route.</AlertTitle>
                <AlertDescription>Please check your schedule or select a different bus/day.</AlertDescription>
            </Alert>
        )}
      </CardContent>
    </Card>
  );

  const sidePanel = (
    <div>
        <h3 className="text-lg font-semibold mb-2 font-headline">Instructions</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
            <li>Find your name on the seating map.</li>
            <li>Tap your seat when you board the bus. Your seat will turn green.</li>
            <li>Tap your seat again when you get off the bus.</li>
            <li>Only you can change the status of your own seat.</li>
        </ul>
        <Alert className="mt-6 bg-accent/50 border-accent">
            <PartyPopper className="h-4 w-4" />
            <AlertTitle className="font-headline">You are logged in as:</AlertTitle>
            <AlertDescription className="font-semibold text-accent-foreground">
                {students.find(s=>s.id === LOGGED_IN_STUDENT_ID)?.name || 'Student'}
            </AlertDescription>
        </Alert>
    </div>
  );

  return (
    <DashboardShell
      buses={buses}
      selectedBusId={selectedBusId}
      setSelectedBusId={setSelectedBusId}
      selectedDay={selectedDay}
      setSelectedDay={setSelectedDay}
      selectedRouteType={selectedRouteType}
      setSelectedRouteType={setSelectedRouteType}
      mainContent={mainContent}
      sidePanel={sidePanel}
      sidePanelTitle="How to Use"
    />
  );
}
