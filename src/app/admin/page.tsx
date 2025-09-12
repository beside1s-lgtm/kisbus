'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getBuses, getStudents, getRoutes, getDestinations } from '@/lib/mock-data';
import { Bus, Student, Route, Destination, DayOfWeek, RouteType } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { DashboardShell } from '@/components/bus/dashboard-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DraggableStudentCard } from '@/components/bus/draggable-student-card';
import { Shuffle, UserPlus, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminPage() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);

  const [selectedBusId, setSelectedBusId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
  const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');

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

  const assignedStudentIds = useMemo(() => {
    if (!currentRoute) return new Set();
    return new Set(currentRoute.seating.map(s => s.studentId).filter(Boolean));
  }, [currentRoute]);

  const unassignedStudents = useMemo(() => {
    return students.filter(s => !assignedStudentIds.has(s.id));
  }, [students, assignedStudentIds]);

  const handleSeatDrop = useCallback((seatNumber: number, studentId: string) => {
    setRoutes(prevRoutes => {
      const newRoutes = [...prevRoutes];
      const routeIndex = newRoutes.findIndex(r => r.id === currentRoute?.id);
      if (routeIndex === -1) return prevRoutes;

      const newRoute = { ...newRoutes[routeIndex] };
      const newSeating = [...newRoute.seating];
      
      const targetSeatIndex = newSeating.findIndex(s => s.seatNumber === seatNumber);
      const sourceSeatIndex = newSeating.findIndex(s => s.studentId === studentId);

      if (targetSeatIndex !== -1) {
        const studentOnTargetSeat = newSeating[targetSeatIndex].studentId;
        
        // Assign student to target seat
        newSeating[targetSeatIndex] = { ...newSeating[targetSeatIndex], studentId };

        // If another student was on the target seat, move them to the source seat or unassign
        if (sourceSeatIndex !== -1) {
          newSeating[sourceSeatIndex] = { ...newSeating[sourceSeatIndex], studentId: studentOnTargetSeat };
        } else if (studentOnTargetSeat) {
          // If dragged from unassigned list and target is occupied, we can choose to swap or prevent
          // For now, let's just swap. Find an empty seat or unassign the swapped student.
          // This part can be complex. Simple assignment is better for now.
        }
      }
      
      newRoute.seating = newSeating;
      newRoutes[routeIndex] = newRoute;
      return newRoutes;
    });
  }, [currentRoute]);
  
  const unassignStudent = useCallback((seatNumber: number) => {
     setRoutes(prevRoutes => {
      const newRoutes = [...prevRoutes];
      const routeIndex = newRoutes.findIndex(r => r.id === currentRoute?.id);
      if (routeIndex === -1) return prevRoutes;
      
      const newRoute = { ...newRoutes[routeIndex] };
      const newSeating = [...newRoute.seating];
      const seatToEmptyIndex = newSeating.findIndex(s => s.seatNumber === seatNumber);

      if(seatToEmptyIndex !== -1) {
        newSeating[seatToEmptyIndex].studentId = null;
      }
      
      newRoute.seating = newSeating;
      newRoutes[routeIndex] = newRoute;
      return newRoutes;
     });
  }, [currentRoute]);

  const randomizeSeating = useCallback(() => {
    if (!currentRoute || !selectedBus) return;

    const studentsToAssign = [...unassignedStudents];
    
    setRoutes(prevRoutes => {
        const newRoutes = [...prevRoutes];
        const routeIndex = newRoutes.findIndex(r => r.id === currentRoute?.id);
        if (routeIndex === -1) return prevRoutes;
        const newRoute = { ...newRoutes[routeIndex] };
        
        const emptySeats = newRoute.seating.filter(s => s.studentId === null);
        
        // Shuffle students
        for (let i = studentsToAssign.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [studentsToAssign[i], studentsToAssign[j]] = [studentsToAssign[j], studentsToAssign[i]];
        }
        
        const newSeating = newRoute.seating.map(seat => {
            if (seat.studentId === null && studentsToAssign.length > 0) {
                const studentToAssign = studentsToAssign.pop();
                return { ...seat, studentId: studentToAssign!.id };
            }
            return seat;
        });
        
        newRoute.seating = newSeating;
        newRoutes[routeIndex] = newRoute;
        return newRoutes;
    });
  }, [currentRoute, selectedBus, unassignedStudents]);


  if (!selectedBus || !currentRoute) {
    return <div className="p-4">Loading or select a bus...</div>;
  }

  const mainContent = (
    <Card>
        <CardHeader>
            <CardTitle className="font-headline">Seating Map</CardTitle>
        </CardHeader>
        <CardContent>
            <BusSeatMap 
                bus={selectedBus}
                seating={currentRoute.seating}
                students={students}
                onSeatDrop={handleSeatDrop}
                onSeatClick={(seatNumber) => unassignStudent(seatNumber)}
                draggable={true}
            />
        </CardContent>
    </Card>
  );

  const sidePanel = (
    <>
      {unassignedStudents.map(student => (
        <DraggableStudentCard key={student.id} student={student} />
      ))}
    </>
  );
  
  const topActions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={randomizeSeating}><Shuffle className="mr-2" /> Randomize</Button>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline"><UserPlus className="mr-2" /> Add Student</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Add New Student</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">Name</Label>
              <Input id="name" defaultValue="New Student" className="col-span-3" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog>
        <DialogTrigger asChild>
          <Button><Upload className="mr-2" /> Upload CSV</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Student CSV</DialogTitle></DialogHeader>
           <div className="p-4 text-center">
                <p className="mb-4">Select a CSV file to bulk upload students.</p>
                <Input type="file" accept=".csv" />
                <Button className="mt-4">Upload</Button>
            </div>
        </DialogContent>
      </Dialog>
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
      topActions={topActions}
      sidePanelTitle="Unassigned Students"
    />
  );
}
