
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getBuses, getStudents, getRoutes, getDestinations } from '@/lib/mock-data';
import { Bus, Student, Route, Destination, DayOfWeek, RouteType } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DraggableStudentCard } from '@/components/bus/draggable-student-card';
import { Shuffle, UserPlus, Upload, Trash2, PlusCircle, Download, GripVertical } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MainLayout } from '@/components/layout/main-layout';

const generateInitialSeating = (capacity: number): { seatNumber: number; studentId: string | null }[] => {
    return Array.from({ length: capacity }, (_, i) => ({
        seatNumber: i + 1,
        studentId: null,
    }));
};

const BusRegistrationTab = ({ buses, setBuses }: { buses: Bus[], setBuses: React.Dispatch<React.SetStateAction<Bus[]>> }) => {
    
    const handleDownloadBusTemplate = () => {
        const headers = "번호,타입";
        const example = "Bus 10,45-seater";
        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + example;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "bus_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>버스 목록</CardTitle>
                <CardDescription>새로운 버스를 추가하거나 기존 버스를 삭제합니다.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end gap-2 mb-4">
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline"><PlusCircle className="mr-2" /> 새 버스 추가</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>새 버스 추가</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="bus-name" className="text-right">버스 번호</Label>
                                    <Input id="bus-name" placeholder="예: Bus 04" className="col-span-3" />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="bus-type" className="text-right">타입</Label>
                                     <Select>
                                        <SelectTrigger className="col-span-3">
                                            <SelectValue placeholder="타입 선택" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="15-seater">15인승</SelectItem>
                                            <SelectItem value="29-seater">29인승</SelectItem>
                                            <SelectItem value="45-seater">45인승</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button>추가</Button>
                        </DialogContent>
                    </Dialog>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button><Upload className="mr-2" /> CSV 일괄 등록</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>버스 CSV 일괄 등록</DialogTitle></DialogHeader>
                            <div className="p-4 text-center">
                                <p className="mb-2">버스 대량 등록을 위해 CSV 파일을 선택하세요.</p>
                                <p className="text-sm text-muted-foreground mb-4">CSV 파일은 반드시 UTF-8 형식이어야 합니다.</p>
                                <Button variant="link" onClick={handleDownloadBusTemplate}><Download className="mr-2" />예시 양식 다운로드</Button>
                                <Input type="file" accept=".csv" className="mt-2" />
                                <Button className="mt-4">업로드</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>버스 번호</TableHead>
                            <TableHead>타입</TableHead>
                            <TableHead className="text-right">작업</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {buses.map(bus => (
                            <TableRow key={bus.id}>
                                <TableCell>{bus.name}</TableCell>
                                <TableCell>{bus.type}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};

const BusConfigurationTab = ({
  buses,
  routes,
  setRoutes,
  destinations,
  setDestinations,
  suggestedDestinations,
  setSuggestedDestinations,
  selectedDay,
  selectedRouteType,
  selectedBusId,
  setSelectedBusId
}: {
  buses: Bus[];
  routes: Route[];
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  destinations: Destination[];
  setDestinations: React.Dispatch<React.SetStateAction<Destination[]>>;
  suggestedDestinations: Destination[],
  setSuggestedDestinations: React.Dispatch<React.SetStateAction<Destination[]>>;
  selectedDay: DayOfWeek;
  selectedRouteType: RouteType;
  selectedBusId: string | null;
  setSelectedBusId: (id: string) => void;
}) => {
  const selectedBus = useMemo(() => {
    if (!selectedBusId) return null;
    return buses.find(b => b.id === selectedBusId);
  }, [buses, selectedBusId]);
  
  const currentRoute = useMemo(() => {
    return routes.find(r =>
        r.busId === selectedBusId &&
        r.dayOfWeek === selectedDay &&
        r.type === selectedRouteType
    );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  const getStopsForCurrentRoute = () => {
    if (!currentRoute) return [];
    return currentRoute.stops.map(stopId => destinations.find(d => d.id === stopId)!).filter(Boolean);
  };
  
  const handleDownloadDestinationTemplate = () => {
    const headers = "목적지 이름";
    const example = "강남역";
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + example;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "destination_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const approveSuggestedDestination = (suggestion: Destination) => {
    setDestinations(prev => [...prev, suggestion]);
    setSuggestedDestinations(prev => prev.filter(s => s.id !== suggestion.id));
  };
  
  return (
    <div className="grid grid-cols-1 gap-6 items-start">
      <Card>
        <CardHeader>
          <CardTitle>버스 노선 설정</CardTitle>
          <CardDescription>버스를 선택하여 노선을 설정하세요.</CardDescription>
        </CardHeader>
        <CardContent>
            {selectedBus ? (
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedBus.name} - {selectedRouteType === 'Morning' ? '등교' : '하교'} 노선</CardTitle>
                    <CardDescription>버스의 정보를 수정하고 노선 순서를 정합니다.</CardDescription>
                  </CardHeader>
                  <CardContent>
                      <div className="flex items-center gap-4 p-2 border rounded-md mb-4">
                          <Input defaultValue={selectedBus.name} className="flex-1" />
                          <Select defaultValue={selectedBus.type}>
                              <SelectTrigger className="w-[150px]">
                                  <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="15-seater">15인승</SelectItem>
                                  <SelectItem value="29-seater">29인승</SelectItem>
                                  <SelectItem value="45-seater">45인승</SelectItem>
                              </SelectContent>
                          </Select>
                          <Button>저장</Button>
                      </div>

                      <Separator className="my-4" />

                      <div>
                          <h4 className="font-semibold mb-2">노선 순서 (드래그하여 순서 변경)</h4>
                          <p className="text-sm text-muted-foreground mb-2">
                              아래 목록은 이 버스의 정류장 순서를 나타냅니다. 전체 목적지 목록에서 노선에 추가할 수 있습니다.
                          </p>
                          <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[50px] bg-muted/50">
                            {getStopsForCurrentRoute().map((dest, index) => (
                               <Badge key={`${dest.id}-${index}`} variant="secondary" className="p-2 flex items-center gap-2 cursor-grab active:cursor-grabbing">
                                 <span className="text-xs font-bold text-muted-foreground">{index + 1}</span>
                                 <GripVertical className="h-4 w-4 text-muted-foreground" />
                                 {dest.name}
                               </Badge>
                            ))}
                          </div>
                      </div>
                  </CardContent>
                </Card>
            ) : (
                <div className="text-center text-muted-foreground py-10">버스를 선택하여 노선을 확인하세요.</div>
            )}
        </CardContent>
      </Card>
      
       {suggestedDestinations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>신규 목적지 신청</CardTitle>
              <CardDescription>
                학생들이 제안한 새로운 목적지입니다. 클릭하여 전체 목적지 목록에 추가하세요.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[50px] bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700">
                {suggestedDestinations.map(suggestion => (
                  <Badge 
                    key={suggestion.id}
                    variant="outline" 
                    onClick={() => approveSuggestedDestination(suggestion)}
                    className="cursor-pointer hover:bg-amber-200 dark:hover:bg-amber-800"
                  >
                    {suggestion.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      <Card>
        <CardHeader>
          <CardTitle>전체 목적지 목록</CardTitle>
          <CardDescription>
            모든 버스 노선에서 사용할 수 있는 목적지 목록입니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex justify-end gap-2 mb-4">
                <Dialog>
                    <DialogTrigger asChild><Button variant="outline"><PlusCircle className="mr-2" /> 목적지 추가</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>새 목적지 추가</DialogTitle></DialogHeader>
                        <Input placeholder="예: 강남역" />
                        <Button className="mt-2">추가</Button>
                    </DialogContent>
                </Dialog>
                <Dialog>
                    <DialogTrigger asChild><Button><Upload className="mr-2" /> CSV 일괄 등록</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>목적지 CSV 일괄 등록</DialogTitle></DialogHeader>
                        <div className="p-4 text-center">
                            <p className="mb-2">목적지 대량 등록을 위해 CSV 파일을 선택하세요.</p>
                            <p className="text-sm text-muted-foreground mb-4">CSV 파일은 반드시 UTF-8 형식이어야 합니다.</p>
                            <Button variant="link" onClick={handleDownloadDestinationTemplate}><Download className="mr-2" />예시 양식 다운로드</Button>
                            <Input type="file" accept=".csv" className="mt-2" />
                            <Button className="mt-4">업로드</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[100px] bg-muted/50">
                {destinations.map(dest => (
                    <Badge key={dest.id} variant="outline" className="flex justify-between items-center max-w-fit">
                        <span>{dest.name}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 ml-1">
                            <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                    </Badge>
                ))}
            </div>
        </CardContent>
      </Card>
    </div>
  );
};


const StudentManagementTab = ({
    buses,
    students,
    routes,
    setRoutes,
    destinations,
    selectedBusId,
    selectedDay,
    selectedRouteType,
    days
}:{
    buses: Bus[],
    students: Student[],
    routes: Route[],
    setRoutes: React.Dispatch<React.SetStateAction<Route[]>>,
    destinations: Destination[],
    selectedBusId: string;
    selectedDay: DayOfWeek;
    selectedRouteType: RouteType;
    days: DayOfWeek[];
}) => {
    const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);

    const currentRoute = useMemo(() => {
        return routes.find(r =>
            r.busId === selectedBusId &&
            r.dayOfWeek === selectedDay &&
            r.type === selectedRouteType
        );
    }, [routes, selectedBusId, selectedDay, selectedRouteType]);

    const unassignedStudents = useMemo(() => {
        const assignedStudentIdsInCurrentRoute = new Set<string>();
        if (currentRoute) {
            currentRoute.seating.forEach(seat => {
                if (seat.studentId) {
                    assignedStudentIdsInCurrentRoute.add(seat.studentId);
                }
            });
        }

        const studentAssignedInAnyRoute = new Set<string>();
         routes.forEach(r => {
             r.seating.forEach(s => {
                 if (s.studentId) studentAssignedInAnyRoute.add(s.studentId);
             });
         });

        return students.filter(
            s => !studentAssignedInAnyRoute.has(s.id) && !assignedStudentIdsInCurrentRoute.has(s.id)
        );
    }, [students, routes, currentRoute]);

    const handleSeatDrop = useCallback((seatNumber: number, studentId: string) => {
        setRoutes(prevRoutes => {
            const newRoutes = [...prevRoutes];

            // 1. Un-assign the student from any other seat they might be in on the same day's route
            const routeIdx = newRoutes.findIndex(r => r.id === currentRoute?.id);
            if (routeIdx > -1) {
                const oldSeatIdx = newRoutes[routeIdx].seating.findIndex(s => s.studentId === studentId);
                if (oldSeatIdx > -1) {
                    newRoutes[routeIdx].seating[oldSeatIdx].studentId = null;
                }
            }

            // 2. Assign the student to the new seat for all days of the week for the same bus and route type
            days.forEach(day => {
                const targetRouteIndex = newRoutes.findIndex(
                    r => r.busId === selectedBusId && r.dayOfWeek === day && r.type === selectedRouteType
                );
                if (targetRouteIndex > -1) {
                    const targetRoute = { ...newRoutes[targetRouteIndex] };
                    const targetSeating = [...targetRoute.seating];
                    
                    // Check if the student is already assigned on this day, if so, skip auto-assignment for this day
                    const studentAlreadyAssignedOnThisDay = targetSeating.some(s => s.studentId === studentId);
                    if (studentAlreadyAssignedOnThisDay && day !== selectedDay) {
                        return; 
                    }

                    // Find the target seat and check if it's occupied
                    const targetSeatIndex = targetSeating.findIndex(s => s.seatNumber === seatNumber);
                    if (targetSeatIndex > -1) {
                        const occupantId = targetSeating[targetSeatIndex].studentId;
                        
                        // If the seat is occupied by another student, remove them from all days
                        if (occupantId && occupantId !== studentId) {
                            unassignStudent(seatNumber, occupantId); 
                        }
                        
                        // Assign the new student
                        targetSeating[targetSeatIndex].studentId = studentId;
                    }
                    targetRoute.seating = targetSeating;
                    newRoutes[targetRouteIndex] = targetRoute;
                }
            });
            
            return newRoutes;
        });
    }, [currentRoute, setRoutes, days, selectedBusId, selectedRouteType, selectedDay]);

    const unassignStudent = useCallback((seatNumber: number, studentIdToUnassign?: string) => {
        setRoutes(prevRoutes => {
            let newRoutes = [...prevRoutes];
            if (!currentRoute) return newRoutes;

            const studentId = studentIdToUnassign || currentRoute.seating.find(s => s.seatNumber === seatNumber)?.studentId;
            if (!studentId) return newRoutes;

            // Un-assign the student from this seat for all days of the week
            days.forEach(day => {
                const routeIndex = newRoutes.findIndex(
                    r => r.busId === selectedBusId && r.dayOfWeek === day && r.type === selectedRouteType
                );
                if (routeIndex > -1) {
                    const newRoute = { ...newRoutes[routeIndex] };
                    const newSeating = [...newRoute.seating];
                    const seatToEmptyIndex = newSeating.findIndex(
                        s => s.seatNumber === seatNumber && s.studentId === studentId
                    );
                    if (seatToEmptyIndex !== -1) {
                        newSeating[seatToEmptyIndex].studentId = null;
                    }
                    newRoute.seating = newSeating;
                    newRoutes[routeIndex] = newRoute;
                }
            });

            return newRoutes;
        });
    }, [currentRoute, setRoutes, days, selectedBusId, selectedRouteType]);


    const randomizeSeating = useCallback(() => {
        if (!currentRoute || !selectedBus) return;

        const studentsOnThisRouteStops = students.filter(s => currentRoute.stops.includes(s.destinationId));
        
        const currentlyAssignedOnThisRoute = currentRoute.seating
            .map(s => s.studentId)
            .filter(Boolean) as string[];
        
        const studentAssignedInAnyRoute = new Set<string>();
        routes.forEach(r => {
             r.seating.forEach(s => {
                 if (s.studentId) studentAssignedInAnyRoute.add(s.studentId);
             });
         });

        const studentsAvailableForThisRoute = studentsOnThisRouteStops.filter(
             s => !studentAssignedInAnyRoute.has(s.id) || currentlyAssignedOnThisRoute.includes(s.id)
        );

        const gradeToValue = (grade: string): number => {
            if (grade.toLowerCase().startsWith('k')) return 0;
            const num = parseInt(grade.replace(/\D/g, ''));
            if (isNaN(num)) return 99; // For middle/high school, place at end
            return num;
        };

        const sortedStudents = [...studentsAvailableForThisRoute].sort((a, b) => gradeToValue(a.grade) - gradeToValue(b.grade));

        const getSeatPairs = (capacity: number): [number, number][] => {
            const pairs: [number, number][] = [];
             if (capacity === 15) {
                // First row is 1-2, rest are 2-1
                pairs.push([1, 2]); // Special pair for first row
                for (let i = 3; i < 15; i += 3) {
                    if (i + 1 <= 15) pairs.push([i, i + 1]);
                }
                return pairs;
            }

            const numRows = Math.ceil(capacity / 4);
            const hasLastRowOfFive = capacity === 45 || capacity === 29;

            for (let row = 0; row < numRows; row++) {
                const base = row * 4 + 1;
                if (base + 1 <= capacity) pairs.push([base, base + 1]);
                if (base + 2 <= capacity && base + 3 <= capacity) {
                     if(hasLastRowOfFive && row === numRows -1) {
                         // Don't create pairs for the last row of 5
                     } else {
                         pairs.push([base + 2, base + 3]);
                     }
                }
            }
            return pairs;
        };
        
        const getSeatType = (seatNumber: number, capacity: number): 'window' | 'aisle' => {
            if (capacity === 15) {
                if (seatNumber === 1 || seatNumber === 3 || seatNumber === 6 || seatNumber === 9 || seatNumber === 12) return 'window';
                if (seatNumber === 5 || seatNumber === 8 || seatNumber === 11 || seatNumber === 14) return 'window';
                return 'aisle';
            }
            if ((capacity === 45 && seatNumber > 40) || (capacity === 29 && seatNumber > 24)) { // Back row of 5
                 if(seatNumber === (capacity - 4) || seatNumber === capacity) return 'window';
                 return 'aisle';
            }
            const colInPair = (seatNumber - 1) % 4;
            return colInPair === 0 || colInPair === 3 ? 'window' : 'aisle';
        };

        const routeStopOrder = currentRoute.stops;

        let males = sortedStudents.filter(s => s.gender === 'Male');
        let females = sortedStudents.filter(s => s.gender === 'Female');

        const newSeating = generateInitialSeating(selectedBus.capacity);
        const occupiedSeats = new Set<number>();

        const seatPairs = getSeatPairs(selectedBus.capacity);

        // Try to form boy-girl pairs
        while (males.length > 0 && females.length > 0) {
            const male = males.shift()!;
            const female = females.shift()!;
            
            let placed = false;
            for (const pair of seatPairs) {
                if (!occupiedSeats.has(pair[0]) && !occupiedSeats.has(pair[1])) {
                    const [seat1, seat2] = pair;
                    
                    const maleStopIndex = routeStopOrder.indexOf(male.destinationId);
                    const femaleStopIndex = routeStopOrder.indexOf(female.destinationId);

                    let studentA, studentB, seatA, seatB;
                    // Student getting off later gets window
                    if(maleStopIndex > femaleStopIndex) { // male gets off later
                        studentA = male; studentB = female;
                    } else { // female gets off later or same
                        studentA = female; studentB = male;
                    }

                    // Assign student A to window, B to aisle
                    if (getSeatType(seat1, selectedBus.capacity) === 'window') {
                        seatA = seat1; seatB = seat2;
                    } else {
                        seatA = seat2; seatB = seat1;
                    }
                    
                    const seatAIndex = newSeating.findIndex(s => s.seatNumber === seatA);
                    const seatBIndex = newSeating.findIndex(s => s.seatNumber === seatB);
                    if (seatAIndex !== -1) newSeating[seatAIndex].studentId = studentA.id;
                    if (seatBIndex !== -1) newSeating[seatBIndex].studentId = studentB.id;

                    occupiedSeats.add(seat1);
                    occupiedSeats.add(seat2);
                    placed = true;
                    break;
                }
            }
            if(!placed) { // could not place pair, put back
                males.unshift(male);
                females.unshift(female);
                break;
            }
        }
        
        // Assign remaining students (same-sex or singles)
        const remainingStudents = [...males, ...females].sort((a,b) => gradeToValue(a.grade) - gradeToValue(b.grade));

        const emptySeats = newSeating.filter(s => !s.studentId).map(s => s.seatNumber);

        for (const student of remainingStudents) {
            if (emptySeats.length > 0) {
                const seatNumber = emptySeats.shift()!;
                const seatIndex = newSeating.findIndex(s => s.seatNumber === seatNumber);
                if (seatIndex !== -1) {
                    newSeating[seatIndex].studentId = student.id;
                }
            }
        }

        setRoutes(prevRoutes => {
            const newRoutes = [...prevRoutes];
            const routeIndex = newRoutes.findIndex(r => r.id === currentRoute.id);
            if (routeIndex === -1) return prevRoutes;
            const newRoute = { ...newRoutes[routeIndex], seating: newSeating };
            newRoutes[routeIndex] = newRoute;
            return newRoutes;
        });

    }, [currentRoute, selectedBus, students, setRoutes, routes]);
    
    const handleDownloadStudentTemplate = () => {
        const headers = "학생 이름,학년,반,성별,목적지";
        const example = "김민준,G1,C1,Male,강남역";
        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + example;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "student_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    if (!selectedBus) {
       return <div className="p-4 text-center text-muted-foreground">버스를 선택하여 학생을 관리하세요.</div>;
    }
    
     if (!currentRoute) {
        return <div className="p-4 text-center text-muted-foreground">선택된 조건에 해당하는 노선 정보를 찾을 수 없습니다.</div>;
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="font-headline">좌석표</CardTitle>
                        <div className="flex items-center gap-2">
                             <Button variant="outline" onClick={randomizeSeating}><Shuffle className="mr-2" /> 랜덤 배정</Button>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline"><UserPlus className="mr-2" /> 학생 추가</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>새 학생 추가</DialogTitle></DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="name" className="text-right">이름</Label>
                                            <Input id="name" defaultValue="새 학생" className="col-span-3" />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="grade" className="text-right">학년</Label>
                                            <Input id="grade" placeholder="예: G1" className="col-span-3" />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="class" className="text-right">반</Label>
                                            <Input id="class" placeholder="예: C1" className="col-span-3" />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="gender" className="text-right">성별</Label>
                                            <Select>
                                                <SelectTrigger className="col-span-3">
                                                    <SelectValue placeholder="성별 선택" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Male">Male</SelectItem>
                                                    <SelectItem value="Female">Female</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="destination" className="text-right">목적지</Label>
                                            <Select>
                                                <SelectTrigger className="col-span-3">
                                                    <SelectValue placeholder="목적지 선택" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Button>추가</Button>
                                </DialogContent>
                            </Dialog>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button><Upload className="mr-2" /> CSV 업로드</Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader><DialogTitle>학생 CSV 업로드</DialogTitle></DialogHeader>
                                    <div className="p-4 text-center">
                                        <p className="mb-2">학생 대량 업로드를 위해 CSV 파일을 선택하세요.</p>
                                        <p className="text-sm text-muted-foreground mb-4">CSV 파일은 반드시 UTF-8 형식이어야 합니다.</p>
                                        <Button variant="link" onClick={handleDownloadStudentTemplate}><Download className="mr-2" />예시 양식 다운로드</Button>
                                        <Input type="file" accept=".csv" className="mt-2" />
                                        <Button className="mt-4">업로드</Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <BusSeatMap
                            bus={selectedBus}
                            seating={currentRoute.seating}
                            students={students}
                            destinations={destinations}
                            onSeatDrop={handleSeatDrop}
                            onSeatClick={(seatNumber) => unassignStudent(seatNumber)}
                            draggable={true}
                        />
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-1">
                 <Card className="sticky top-20">
                    <CardHeader>
                        <CardTitle className="font-headline">미배정 학생</CardTitle>
                        <CardDescription>어떤 버스에도 배정되지 않은 학생 목록입니다.</CardDescription>
                    </CardHeader>
                    <Separator />
                    <CardContent className='pt-4 max-h-[60vh] overflow-y-auto'>
                        {unassignedStudents.length > 0 ? unassignedStudents.map(student => (
                            <DraggableStudentCard key={student.id} student={student} />
                        )) : (
                            <p className="text-sm text-muted-foreground text-center py-4">모든 학생이 배정되었습니다.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};


export default function AdminPage() {
    const [buses, setBuses] = useState<Bus[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [suggestedDestinations, setSuggestedDestinations] = useState<Destination[]>([]);
    const [selectedBusId, setSelectedBusId] = useState<string>('');
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
    const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
    const [activeTab, setActiveTab] = useState('student-management');

    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const dayLabels: { [key in DayOfWeek]: string } = {
        Monday: '월요일',
        Tuesday: '화요일',
        Wednesday: '수요일',
        Thursday: '목요일',
        Friday: '금요일',
    }

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

    // This is a mock for suggested destinations from the apply page
    // In a real app, this would come from a database.
    useEffect(() => {
        const mockSuggestions: Destination[] = [
            { id: 'sugg_dest_1', name: 'Yangjae Station' },
            { id: 'sugg_dest_2', name: 'Sadang Station' },
        ];
        if (typeof window !== "undefined") {
            const storedSuggestions = window.sessionStorage.getItem('suggestedDestinations');
            if (storedSuggestions) {
                 setSuggestedDestinations(JSON.parse(storedSuggestions));
            } else {
                 setSuggestedDestinations(mockSuggestions);
            }
        }
    }, []);
    
    useEffect(() => {
        if (typeof window !== "undefined") {
            window.sessionStorage.setItem('suggestedDestinations', JSON.stringify(suggestedDestinations));
        }
    }, [suggestedDestinations]);

    const headerContent = (
      <div className="flex items-center gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
        </div>
      </div>
    );

    return (
        <MainLayout headerContent={headerContent}>
            <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="student-management">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="bus-registration">버스 등록</TabsTrigger>
                    <TabsTrigger value="bus-configuration">버스 설정</TabsTrigger>
                    <TabsTrigger value="student-management">탑승 학생 관리</TabsTrigger>
                </TabsList>
                <TabsContent value="bus-registration" className="mt-6">
                    <BusRegistrationTab buses={buses} setBuses={setBuses} />
                </TabsContent>
                <TabsContent value="bus-configuration" className="mt-6">
                    <BusConfigurationTab
                        buses={buses}
                        routes={routes}
                        setRoutes={setRoutes}
                        destinations={destinations}
                        setDestinations={setDestinations}
                        suggestedDestinations={suggestedDestinations}
                        setSuggestedDestinations={setSuggestedDestinations}
                        selectedDay={selectedDay}
                        selectedRouteType={selectedRouteType}
                        selectedBusId={selectedBusId}
                        setSelectedBusId={setSelectedBusId}
                    />
                </TabsContent>
                <TabsContent value="student-management" className="mt-6">
                    <StudentManagementTab 
                        buses={buses} 
                        students={students} 
                        routes={routes} 
                        setRoutes={setRoutes}
                        destinations={destinations}
                        selectedBusId={selectedBusId}
                        selectedDay={selectedDay}
                        selectedRouteType={selectedRouteType}
                        days={days}
                    />
                </TabsContent>
            </Tabs>
        </MainLayout>
    );
}

    