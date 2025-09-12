'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { getBuses, getStudents, getRoutes, getDestinations } from '@/lib/mock-data';
import { Bus, Student, Route, Destination, DayOfWeek, RouteType } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { DashboardShell } from '@/components/bus/dashboard-shell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Crown, UserX, ArrowLeftRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { VolunteerTimeCalculator } from './components/volunteer-time-calculator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function TeacherPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  
  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
  
  const [absentStudentIds, setAbsentStudentIds] = useState<string[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [busesData, studentsData, routesData, destinationsData] = await Promise.all([
        getBuses(),
        getStudents(),
        getRoutes(),
        getDestinations(),
      ]);
      setBuses(busesData);
      setStudents(studentsData);
      setRoutes(routesData);
      setDestinations(destinationsData);
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

  const toggleAbsence = (studentId: string) => {
    setAbsentStudentIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };
  
  const toggleGroupLeader = (studentId: string) => {
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, isGroupLeader: !s.isGroupLeader } : s
    ));
    const student = students.find(s => s.id === studentId);
    if(student){
        setSelectedStudent({...student, isGroupLeader: !student.isGroupLeader});
    }
  };
  
  const handleSeatClick = (seatNumber: number, studentId: string | null) => {
    if (studentId) {
      const student = students.find(s => s.id === studentId);
      setSelectedStudent(student || null);
    } else {
      setSelectedStudent(null);
    }
  };

  if (!selectedBus || !currentRoute) {
    return <div className="p-4">Loading or select a bus...</div>;
  }

  const mainContent = (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline">Bus Seating</CardTitle>
        <CardDescription>Click on a student to see details and actions.</CardDescription>
      </CardHeader>
      <CardContent>
        <BusSeatMap 
          bus={selectedBus}
          seating={currentRoute.seating}
          students={students}
          draggable={false}
          onSeatClick={handleSeatClick}
          absentStudentIds={absentStudentIds}
        />
      </CardContent>
    </Card>
  );

  const sidePanel = selectedStudent ? (
    <div>
        <div className="flex flex-col items-center text-center">
            <Avatar className="w-24 h-24 mb-4 border-4 border-primary/50">
                <AvatarFallback className="text-4xl">{selectedStudent.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-bold font-headline">{selectedStudent.name}</h3>
            <p className="text-sm text-muted-foreground">
                Destination: {destinations.find(d => d.id === selectedStudent.destinationId)?.name || 'N/A'}
            </p>
        </div>
        <Separator className="my-4" />
        <div className="space-y-3">
            <Button
                variant={absentStudentIds.includes(selectedStudent.id) ? "destructive" : "outline"}
                className="w-full"
                onClick={() => toggleAbsence(selectedStudent.id)}
            >
                <UserX className="mr-2" /> Mark as Absent
            </Button>
            <Button
                variant={selectedStudent.isGroupLeader ? "default" : "outline"}
                className="w-full"
                onClick={() => toggleGroupLeader(selectedStudent.id)}
            >
                <Crown className="mr-2" /> {selectedStudent.isGroupLeader ? 'Unset as Leader' : 'Set as Group Leader'}
            </Button>
             <Button variant="outline" className="w-full">
                <ArrowLeftRight className="mr-2" /> Swap Seat
            </Button>
        </div>
        {selectedStudent.isGroupLeader && (
            <>
                <Separator className="my-4" />
                <VolunteerTimeCalculator student={selectedStudent} setStudents={setStudents} />
            </>
        )}
    </div>
  ) : (
    <div className="text-center text-muted-foreground py-10">
        <p>Select a student to see more details.</p>
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
      sidePanelTitle="Student Details"
    />
  );
}
