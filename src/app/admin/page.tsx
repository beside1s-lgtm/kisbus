
'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getBuses, getStudents, getRoutes, getDestinations } from '@/lib/mock-data';
import { Bus, Student, Route, Destination, DayOfWeek, RouteType } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { DashboardShell } from '@/components/bus/dashboard-shell';
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
                                            <SelectItem value="25-seater">25인승</SelectItem>
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
  selectedRouteType
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
}) => {
  const [selectedBusId, setSelectedBusId] = useState<string | null>(buses.length > 0 ? buses[0].id : null);

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
            <Select onValueChange={setSelectedBusId} defaultValue={selectedBusId || undefined}>
                <SelectTrigger className="mb-4">
                    <SelectValue placeholder="버스를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                    {buses.map(bus => <SelectItem key={bus.id} value={bus.id}>{bus.name}</SelectItem>)}
                </SelectContent>
            </Select>

            {selectedBus && (
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
                                  <SelectItem value="25-seater">25인승</SelectItem>
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
            )}
        </CardContent>
      </Card>

      <Accordion type="single" collapsible defaultValue="all-destinations">
        <AccordionItem value="all-destinations">
            <AccordionTrigger className="text-lg font-semibold">전체 목적지 목록</AccordionTrigger>
            <AccordionContent>
                <Card>
                    <CardHeader>
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2 border rounded-md min-h-[100px] bg-muted/50">
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
            </AccordionContent>
        </AccordionItem>
      </Accordion>
      
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
    selectedRouteType
}:{
    buses: Bus[],
    students: Student[],
    routes: Route[],
    setRoutes: React.Dispatch<React.SetStateAction<Route[]>>,
    destinations: Destination[],
    selectedBusId: string;
    selectedDay: DayOfWeek;
    selectedRouteType: RouteType;
}) => {
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
        if (!currentRoute) return [];
        const routeStops = new Set(currentRoute.stops);
        return students.filter(s => 
            !assignedStudentIds.has(s.id) && 
            routeStops.has(s.destinationId)
        );
    }, [students, assignedStudentIds, currentRoute]);

    const handleSeatDrop = useCallback((seatNumber: number, studentId: string) => {
        setRoutes(prevRoutes => {
            const newRoutes = [...prevRoutes];
            const routeIndex = newRoutes.findIndex(r => r.id === currentRoute?.id);
            if (routeIndex === -1) return prevRoutes;

            const newRoute = { ...newRoutes[routeIndex] };
            const newSeating = [...newRoute.seating];
            
            // 학생이 원래 있던 자리를 비웁니다.
            const sourceSeatIndex = newSeating.findIndex(s => s.studentId === studentId);
            if(sourceSeatIndex > -1){
                newSeating[sourceSeatIndex] = { ...newSeating[sourceSeatIndex], studentId: null };
            }

            // 대상 좌석에 학생을 배정합니다.
            const targetSeatIndex = newSeating.findIndex(s => s.seatNumber === seatNumber);
            if (targetSeatIndex !== -1) {
                const studentOnTargetSeat = newSeating[targetSeatIndex].studentId;
                newSeating[targetSeatIndex] = { ...newSeating[targetSeatIndex], studentId };

                // 만약 대상 좌석에 다른 학생이 있었다면, 그 학생을 원래 자리로 옮기거나 미배정 처리합니다.
                if (studentOnTargetSeat) {
                    if (sourceSeatIndex !== -1) {
                         newSeating[sourceSeatIndex] = { ...newSeating[sourceSeatIndex], studentId: studentOnTargetSeat };
                    }
                }
            }
            
            newRoute.seating = newSeating;
            newRoutes[routeIndex] = newRoute;
            return newRoutes;
        });
    }, [currentRoute, setRoutes]);

    const unassignStudent = useCallback((seatNumber: number) => {
        setRoutes(prevRoutes => {
            const newRoutes = [...prevRoutes];
            const routeIndex = newRoutes.findIndex(r => r.id === currentRoute?.id);
            if (routeIndex === -1) return prevRoutes;

            const newRoute = { ...newRoutes[routeIndex] };
            const newSeating = [...newRoute.seating];
            const seatToEmptyIndex = newSeating.findIndex(s => s.seatNumber === seatNumber);

            if (seatToEmptyIndex !== -1) {
                newSeating[seatToEmptyIndex].studentId = null;
            }

            newRoute.seating = newSeating;
            newRoutes[routeIndex] = newRoute;
            return newRoutes;
        });
    }, [currentRoute, setRoutes]);

    const randomizeSeating = useCallback(() => {
        if (!currentRoute || !selectedBus) return;
    
        const studentsToAssign = [...unassignedStudents, ...currentRoute.seating.map(s => s.studentId).filter(Boolean).map(id => students.find(s => s.id === id)!)];
        
        setRoutes(prevRoutes => {
            const newRoutes = [...prevRoutes];
            const routeIndex = newRoutes.findIndex(r => r.id === currentRoute?.id);
            if (routeIndex === -1) return prevRoutes;
            const newRoute = { ...newRoutes[routeIndex] };
            
            const shuffledStudents = [...studentsToAssign].sort(() => 0.5 - Math.random());
            
            const newSeating = newRoute.seating.map((seat, index) => {
                if (index < shuffledStudents.length) {
                    return { ...seat, studentId: shuffledStudents[index].id };
                }
                return { ...seat, studentId: null };
            });
            
            newRoute.seating = newSeating;
            newRoutes[routeIndex] = newRoute;
            return newRoutes;
        });
    }, [currentRoute, selectedBus, unassignedStudents, students, setRoutes]);
    
    const handleDownloadStudentTemplate = () => {
        const headers = "버스 번호,학생 이름,목적지,학년,반,성별";
        const example = "Bus 01,김민준,강남역,G1,C1,Male";
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
                    </CardHeader>
                    <Separator />
                    <CardContent className='pt-4 max-h-[60vh] overflow-y-auto'>
                        {unassignedStudents.length > 0 ? unassignedStudents.map(student => (
                            <DraggableStudentCard key={student.id} student={student} />
                        )) : (
                            <p className="text-sm text-muted-foreground text-center py-4">이 노선에 배정할 학생이 없습니다.</p>
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

    return (
        <div className="flex flex-col gap-6">
            <DashboardShell
                buses={buses}
                selectedBusId={selectedBusId}
                setSelectedBusId={setSelectedBusId}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                selectedRouteType={selectedRouteType}
                setSelectedRouteType={setSelectedRouteType}
                mainContent={
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
                            />
                        </TabsContent>
                    </Tabs>
                } 
            />
        </div>
    );
}

    

    