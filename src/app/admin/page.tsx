
'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { 
    getBuses, getStudents, getRoutes, getDestinations, getSuggestedDestinations,
    addBus, deleteBus, updateBus,
    addStudent,
    addDestination, deleteDestination, approveSuggestedDestination, addDestinationsInBatch,
    addRoute, updateRouteSeating, updateRouteStops, updateAllBusRoutesSeating
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, NewBus, NewStudent, NewDestination } from '@/lib/types';
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
import { useToast } from '@/hooks/use-toast';

const generateInitialSeating = (capacity: number): { seatNumber: number; studentId: string | null }[] => {
    return Array.from({ length: capacity }, (_, i) => ({
        seatNumber: i + 1,
        studentId: null,
    }));
};

const BusRegistrationTab = ({ buses, setBuses }: { buses: Bus[], setBuses: React.Dispatch<React.SetStateAction<Bus[]>> }) => {
    const [newBusName, setNewBusName] = useState('');
    const [newBusType, setNewBusType] = useState<'15-seater' | '29-seater' | '45-seater'>('45-seater');
    const { toast } = useToast();
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const routeTypes: RouteType[] = ['Morning', 'Afternoon'];
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddBus = async (busData: NewBus) => {
        try {
            const newBus = await addBus(busData);
            
            const routePromises = days.flatMap(day => 
                routeTypes.map(type => 
                    addRoute({
                        busId: newBus.id,
                        dayOfWeek: day,
                        type: type,
                        stops: [],
                        seating: generateInitialSeating(newBus.capacity),
                    })
                )
            );
            await Promise.all(routePromises);
            
            return newBus;
        } catch (error) {
            console.error("Error adding bus:", error);
            throw error;
        }
    };
    
    const handleManualAddBus = async () => {
        if (!newBusName || !newBusType) {
            toast({ title: "오류", description: "버스 이름과 타입을 모두 입력해주세요.", variant: 'destructive' });
            return;
        }

        const capacityMap = { '15-seater': 15, '29-seater': 29, '45-seater': 45 };
        const newBusData: NewBus = { name: newBusName, type: newBusType, capacity: capacityMap[newBusType] };

        try {
            const newBus = await handleAddBus(newBusData);
            setBuses(prev => [...prev, newBus]);
            toast({ title: "성공", description: "버스가 추가되었습니다." });
        } catch (error) {
            toast({ title: "오류", description: "버스 추가에 실패했습니다.", variant: 'destructive' });
        }
    };
    
    const handleDeleteBus = async (busId: string) => {
        if (confirm("정말로 이 버스와 관련된 모든 노선 정보를 삭제하시겠습니까?")) {
             try {
                await deleteBus(busId);
                setBuses(prev => prev.filter(b => b.id !== busId));
                toast({ title: "성공", description: "버스가 삭제되었습니다."});
            } catch (error) {
                console.error("Error deleting bus:", error);
                toast({ title: "오류", description: "버스 삭제에 실패했습니다.", variant: 'destructive' });
            }
        }
    }

    const handleDownloadBusTemplate = () => {
        const headers = "번호,타입";
        const examples = [
            "Bus 10,45-seater",
            "Bus 11,29-seater",
            "Bus 12,15-seater",
            "# 타입은 15-seater, 29-seater, 45-seater 중 하나를 입력해야 합니다."
        ];
        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + examples.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "bus_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            comments: "#",
            complete: async (results) => {
                const capacityMap = { '15-seater': 15, '29-seater': 29, '45-seater': 45 };
                const validTypes = Object.keys(capacityMap);

                const newBusesData: NewBus[] = results.data.map((row: any) => {
                    const type = (row['타입'] || row['type'] || '').trim();
                    return {
                        name: (row['번호'] || row['name'] || '').trim(),
                        type: type as '15-seater' | '29-seater' | '45-seater',
                        capacity: capacityMap[type as keyof typeof capacityMap]
                    }
                }).filter(bus => bus.name && bus.type && validTypes.includes(bus.type));

                if (newBusesData.length === 0) {
                    toast({ title: "오류", description: "파일에서 유효한 버스 데이터를 찾을 수 없습니다. 헤더가 '번호', '타입'으로 되어있는지, 타입이 15-seater, 29-seater, 45-seater 중 하나인지 확인하세요.", variant: "destructive" });
                    return;
                }

                try {
                    const addedBuses = await Promise.all(newBusesData.map(busData => handleAddBus(busData)));
                    setBuses(prev => [...prev, ...addedBuses]);
                    toast({ title: "성공", description: `${addedBuses.length}개의 버스가 일괄 등록되었습니다.` });
                } catch (error) {
                    toast({ title: "오류", description: "일괄 등록 중 오류가 발생했습니다.", variant: "destructive" });
                }
            },
            error: (error) => {
                toast({ title: "파일 파싱 오류", description: error.message, variant: "destructive" });
            }
        });
        
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>버스 목록</CardTitle>
                <CardDescription>새로운 버스를 추가하거나 기존 버스를 삭제합니다.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end gap-2 mb-4">
                    <Button variant="outline" onClick={handleDownloadBusTemplate}><Download className="mr-2" /> 템플릿</Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> 일괄 등록</Button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2" /> 새 버스 추가</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader><DialogTitle>새 버스 추가</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="bus-name" className="text-right">버스 번호</Label>
                                    <Input id="bus-name" placeholder="예: Bus 04" className="col-span-3" value={newBusName} onChange={e => setNewBusName(e.target.value)} />
                                </div>
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="bus-type" className="text-right">타입</Label>
                                     <Select onValueChange={(v) => setNewBusType(v as any)} value={newBusType}>
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
                            <Button onClick={handleManualAddBus}>추가</Button>
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
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteBus(bus.id)}>
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
  destinations,
  setDestinations,
  suggestedDestinations,
  setSuggestedDestinations,
  selectedDay,
  selectedRouteType,
  selectedBusId,
  setSelectedBusId,
}: {
  buses: Bus[];
  routes: Route[];
  destinations: Destination[];
  setDestinations: React.Dispatch<React.SetStateAction<Destination[]>>;
  suggestedDestinations: Destination[],
  setSuggestedDestinations: React.Dispatch<React.SetStateAction<Destination[]>>;
  selectedDay: DayOfWeek;
  selectedRouteType: RouteType;
  selectedBusId: string | null;
  setSelectedBusId: (id: string) => void;
}) => {
  const [newDestinationName, setNewDestinationName] = useState('');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  
   const handleAddDestination = async () => {
        if (!newDestinationName.trim()) return;
        try {
            const newDest = await addDestination({ name: newDestinationName });
            setDestinations(prev => [...prev, newDest]);
            setNewDestinationName('');
            toast({ title: "성공", description: "목적지가 추가되었습니다." });
        } catch (error) {
            toast({ title: "오류", description: "목적지 추가 실패", variant: 'destructive' });
        }
    };
    
    const handleDeleteDestination = async (id: string) => {
         if (confirm("정말로 이 목적지를 삭제하시겠습니까?")) {
            try {
                await deleteDestination(id);
                setDestinations(prev => prev.filter(d => d.id !== id));
                toast({ title: "성공", description: "목적지가 삭제되었습니다." });
            } catch (error) {
                toast({ title: "오류", description: "목적지 삭제 실패", variant: 'destructive' });
            }
         }
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

  const handleDestinationFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
            const newDestinationsData: NewDestination[] = results.data.map((row: any) => ({
                name: (row['목적지 이름'] || row['name'] || '').trim()
            })).filter(dest => dest.name);

            if (newDestinationsData.length === 0) {
                toast({ title: "오류", description: "파일에서 유효한 목적지 데이터를 찾을 수 없습니다. 헤더가 '목적지 이름'으로 되어있는지 확인하세요.", variant: "destructive" });
                return;
            }

            try {
                const addedDests = await addDestinationsInBatch(newDestinationsData);
                setDestinations(prev => [...prev, ...addedDests]);
                toast({ title: "성공", description: `${addedDests.length}개의 목적지가 일괄 등록되었습니다.` });
            } catch (error) {
                toast({ title: "오류", description: "일괄 등록 중 오류가 발생했습니다.", variant: "destructive" });
            }
        },
        error: (error) => {
            toast({ title: "파일 파싱 오류", description: error.message, variant: "destructive" });
        }
    });

    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };
  
  const handleApproveSuggestion = async (suggestion: Destination) => {
    try {
        await approveSuggestedDestination(suggestion);
        setSuggestedDestinations(prev => prev.filter(s => s.id !== suggestion.id));
        const newDests = await getDestinations(); // Re-fetch all destinations
        setDestinations(newDests);
        toast({ title: "성공", description: "제안된 목적지가 승인되었습니다."});
    } catch (error) {
        toast({ title: "오류", description: "승인 처리 중 오류 발생", variant: 'destructive'});
    }
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
                    onClick={() => handleApproveSuggestion(suggestion)}
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
                 <Button variant="outline" onClick={handleDownloadDestinationTemplate}><Download className="mr-2" /> 템플릿</Button>
                 <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> 일괄 등록</Button>
                 <input type="file" ref={fileInputRef} onChange={handleDestinationFileUpload} accept=".csv" className="hidden" />
                <Dialog>
                    <DialogTrigger asChild><Button><PlusCircle className="mr-2" /> 목적지 추가</Button></DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>새 목적지 추가</DialogTitle></DialogHeader>
                        <Input placeholder="예: 강남역" value={newDestinationName} onChange={e => setNewDestinationName(e.target.value)} />
                        <Button className="mt-2" onClick={handleAddDestination}>추가</Button>
                    </DialogContent>
                </Dialog>
            </div>
            <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[100px] bg-muted/50">
                {destinations.map(dest => (
                    <Badge key={dest.id} variant="outline" className="flex justify-between items-center max-w-fit">
                        <span>{dest.name}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 ml-1" onClick={() => handleDeleteDestination(dest.id)}>
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
    setStudents,
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
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
    routes: Route[],
    setRoutes: React.Dispatch<React.SetStateAction<Route[]>>,
    destinations: Destination[],
    selectedBusId: string;
    selectedDay: DayOfWeek;
    selectedRouteType: RouteType;
    days: DayOfWeek[];
}) => {
    const { toast } = useToast();
    const [newStudentForm, setNewStudentForm] = useState({ name: '', grade: '', class: '', gender: 'Male' as 'Male' | 'Female', destinationId: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);
    const routeTypes: RouteType[] = ['Morning', 'Afternoon'];

    const currentRoute = useMemo(() => {
        return routes.find(r =>
            r.busId === selectedBusId &&
            r.dayOfWeek === selectedDay &&
            r.type === selectedRouteType
        );
    }, [routes, selectedBusId, selectedDay, selectedRouteType]);

    const unassignedStudents = useMemo(() => {
        if (!currentRoute) return students;
        
        // 현재 버스, 현재 요일, 현재 경로에 배정된 학생 ID 집합
        const assignedInCurrentRoute = new Set<string>();
        currentRoute.seating.forEach(s => {
            if (s.studentId) assignedInCurrentRoute.add(s.studentId);
        });

        // 다른 모든 노선에 배정된 학생 ID 집합
        const assignedInAnyRoute = new Set<string>();
        routes.forEach(r => {
            // 현재 보고있는 경로는 제외하고 계산
            if(r.id !== currentRoute.id) {
                r.seating.forEach(s => {
                    if (s.studentId) assignedInAnyRoute.add(s.studentId);
                });
            }
        });

        return students.filter(s => 
            !assignedInAnyRoute.has(s.id) || assignedInCurrentRoute.has(s.id)
        );
    }, [students, routes, currentRoute]);


    const handleSeatDrop = useCallback(async (seatNumber: number, studentId: string) => {
        if (!currentRoute) return;

        const oldRoutes = [...routes];
        const newRoutes = routes.map(route => {
            if (route.id === currentRoute.id) {
                const newSeating = [...route.seating];
                
                // 학생이 현재 경로의 다른 좌석에 이미 있는지 확인하고 제거
                const oldSeatIdx = newSeating.findIndex(s => s.studentId === studentId);
                if (oldSeatIdx > -1) newSeating[oldSeatIdx].studentId = null;

                const targetSeatIdx = newSeating.findIndex(s => s.seatNumber === seatNumber);
                if (targetSeatIdx > -1) newSeating[targetSeatIdx].studentId = studentId;

                return { ...route, seating: newSeating };
            }
            return route;
        });
        setRoutes(newRoutes);

        // DB Update
        try {
            const routeToUpdate = newRoutes.find(r => r.id === currentRoute.id)!;
            await updateRouteSeating(currentRoute.id, routeToUpdate.seating);
        } catch (error) {
            setRoutes(oldRoutes); // Revert on error
            toast({ title: "오류", description: "좌석 배정 실패", variant: 'destructive'});
        }
    }, [currentRoute, routes, setRoutes, toast]);

    const unassignStudent = useCallback(async (seatNumber: number) => {
        if (!currentRoute) return;

        const oldRoutes = [...routes];
        const newRoutes = routes.map(route => {
            if (route.id === currentRoute.id) {
                const newSeating = [...route.seating];
                const seatToEmptyIndex = newSeating.findIndex(s => s.seatNumber === seatNumber);
                if (seatToEmptyIndex !== -1) {
                    newSeating[seatToEmptyIndex].studentId = null;
                }
                return { ...route, seating: newSeating };
            }
            return route;
        });
        setRoutes(newRoutes);
        
        try {
             const routeToUpdate = newRoutes.find(r => r.id === currentRoute.id)!;
             await updateRouteSeating(currentRoute.id, routeToUpdate.seating);
        } catch(e) {
            setRoutes(oldRoutes);
            toast({ title: "오류", description: "좌석 배정 해제 실패", variant: 'destructive'});
        }
    }, [currentRoute, routes, setRoutes, toast]);

    const randomizeSeating = useCallback(async () => {
        if (!selectedBus) return;
        
        const oldRoutes = [...routes];

        // 1. Get all students on this bus's stops
        const routesForThisBus = routes.filter(r => r.busId === selectedBus.id);
        const uniqueStopIds = new Set<string>();
        routesForThisBus.forEach(r => r.stops.forEach(s => uniqueStopIds.add(s)));

        const studentsOnThisBusStops = students.filter(s => s.destinationId && uniqueStopIds.has(s.destinationId));
        
        // Sorting logic
        const gradeToValue = (grade: string) => {
            if (grade.toLowerCase().startsWith('k')) return 0;
            const num = parseInt(grade.replace(/\D/g, ''));
            return isNaN(num) ? 99 : num;
        };
        const sortedStudents = [...studentsOnThisBusStops].sort((a, b) => gradeToValue(a.grade) - gradeToValue(b.grade));

        // Seat pairing logic
        const getSeatPairs = (capacity: number) => {
             const pairs: [number, number][] = [];
             if (capacity === 15) {
                pairs.push([1, 2]);
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
                        // No pairs for last row of 5
                     } else {
                         pairs.push([base + 2, base + 3]);
                     }
                }
            }
            return pairs;
        };
        const getSeatType = (seatNumber: number, capacity: number) => {
             if (capacity === 15) {
                if ([1, 3, 6, 9, 12, 5, 8, 11, 14].includes(seatNumber)) return 'window';
                return 'aisle';
            }
            if ((capacity === 45 && seatNumber > 40) || (capacity === 29 && seatNumber > 24)) {
                 if(seatNumber === (capacity - 4) || seatNumber === capacity) return 'window';
                 return 'aisle';
            }
            const colInPair = (seatNumber - 1) % 4;
            return colInPair === 0 || colInPair === 3 ? 'window' : 'aisle';
        };
        
        // Main logic
        let males = sortedStudents.filter(s => s.gender === 'Male');
        let females = sortedStudents.filter(s => s.gender === 'Female');
        const newSeatingPlan = generateInitialSeating(selectedBus.capacity);
        const occupiedSeats = new Set<number>();
        const seatPairs = getSeatPairs(selectedBus.capacity);
        const referenceRoute = routesForThisBus.find(r => r.dayOfWeek === 'Monday' && r.type === 'Morning');
        const routeStopOrder = referenceRoute ? referenceRoute.stops : [];
        
        // Boy-girl pairing
        while (males.length > 0 && females.length > 0) {
            const male = males.shift()!;
            const female = females.shift()!;
            let placed = false;
            for (const pair of seatPairs) {
                if (!occupiedSeats.has(pair[0]) && !occupiedSeats.has(pair[1])) {
                    const [seat1, seat2] = pair;
                    const maleStopIndex = routeStopOrder.indexOf(male.destinationId);
                    const femaleStopIndex = routeStopOrder.indexOf(female.destinationId);

                    let studentA = (maleStopIndex > femaleStopIndex) ? male : female;
                    let studentB = (maleStopIndex > femaleStopIndex) ? female : male;

                    let seatA = getSeatType(seat1, selectedBus.capacity) === 'window' ? seat1 : seat2;
                    let seatB = getSeatType(seat1, selectedBus.capacity) === 'window' ? seat2 : seat1;

                    const seatAIndex = newSeatingPlan.findIndex(s => s.seatNumber === seatA);
                    const seatBIndex = newSeatingPlan.findIndex(s => s.seatNumber === seatB);
                    if (seatAIndex !== -1) newSeatingPlan[seatAIndex].studentId = studentA.id;
                    if (seatBIndex !== -1) newSeatingPlan[seatBIndex].studentId = studentB.id;
                    occupiedSeats.add(seat1);
                    occupiedSeats.add(seat2);
                    placed = true;
                    break;
                }
            }
            if(!placed) { males.unshift(male); females.unshift(female); break; }
        }

        // Fill remaining
        const remainingStudents = [...males, ...females].sort((a,b) => gradeToValue(a.grade) - gradeToValue(b.grade));
        const emptySeats = newSeatingPlan.filter(s => !s.studentId).map(s => s.seatNumber);
        for (const student of remainingStudents) {
            if (emptySeats.length > 0) {
                const seatNumber = emptySeats.shift()!;
                const seatIndex = newSeatingPlan.findIndex(s => s.seatNumber === seatNumber);
                if (seatIndex !== -1) newSeatingPlan[seatIndex].studentId = student.id;
            }
        }
        
        // Optimistic UI update
        const newRoutes = routes.map(route => {
            if (route.busId === selectedBus.id) {
                return { ...route, seating: newSeatingPlan };
            }
            return route;
        });
        setRoutes(newRoutes);

        // DB update
        try {
            await updateAllBusRoutesSeating(selectedBus.id, newSeatingPlan);
            toast({ title: "성공", description: "랜덤 배정이 완료되었습니다."});
        } catch (error) {
            setRoutes(oldRoutes); // Revert
            toast({ title: "오류", description: "랜덤 배정 실패", variant: 'destructive'});
        }

    }, [selectedBus, students, setRoutes, routes, toast]);
    
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

    const handleStudentFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const newStudentsData: NewStudent[] = results.data.map((row: any) => {
                    const destName = (row['목적지'] || '').trim();
                    const destination = destinations.find(d => d.name === destName);
                    return {
                        name: (row['학생 이름'] || '').trim(),
                        grade: (row['학년'] || '').trim(),
                        class: (row['반'] || '').trim(),
                        gender: (row['성별'] || '').trim() as 'Male' | 'Female',
                        destinationId: destination?.id || ''
                    };
                }).filter(s => s.name && s.grade && s.class && s.gender && s.destinationId);

                if (newStudentsData.length === 0) {
                    toast({ title: "오류", description: "유효한 학생 데이터를 찾을 수 없거나 목적지가 존재하지 않습니다.", variant: "destructive" });
                    return;
                }

                try {
                    const addedStudents = await Promise.all(newStudentsData.map(s => addStudent(s)));
                    setStudents(prev => [...prev, ...addedStudents]);
                    toast({ title: "성공", description: `${addedStudents.length}명의 학생이 등록되었습니다.` });
                } catch (error) {
                    toast({ title: "오류", description: "일괄 등록 중 오류 발생", variant: "destructive" });
                }
            },
            error: (err) => {
                toast({ title: "파일 오류", description: err.message, variant: "destructive" });
            }
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
     const handleAddStudent = async () => {
        const { name, grade, class: studentClass, gender, destinationId } = newStudentForm;
        if (!name || !grade || !studentClass || !gender || !destinationId) {
            toast({ title: "오류", description: "모든 필드를 입력해주세요.", variant: "destructive" });
            return;
        }
        try {
            const newStudentData: NewStudent = { name, grade, class: studentClass, gender, destinationId };
            const newStudent = await addStudent(newStudentData);
            setStudents(prev => [...prev, newStudent]);
            setNewStudentForm({ name: '', grade: '', class: '', gender: 'Male', destinationId: '' });
            toast({ title: "성공", description: "학생이 추가되었습니다." });
        } catch (error) {
            toast({ title: "오류", description: "학생 추가 실패", variant: "destructive" });
        }
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
                                            <Input id="name" value={newStudentForm.name} onChange={e => setNewStudentForm(p => ({...p, name: e.target.value}))} className="col-span-3" />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="grade" className="text-right">학년</Label>
                                            <Input id="grade" value={newStudentForm.grade} onChange={e => setNewStudentForm(p => ({...p, grade: e.target.value}))} placeholder="예: G1" className="col-span-3" />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="class" className="text-right">반</Label>
                                            <Input id="class" value={newStudentForm.class} onChange={e => setNewStudentForm(p => ({...p, class: e.target.value}))} placeholder="예: C1" className="col-span-3" />
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="gender" className="text-right">성별</Label>
                                            <Select value={newStudentForm.gender} onValueChange={(v) => setNewStudentForm(p => ({...p, gender: v as any}))}>
                                                <SelectTrigger className="col-span-3">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Male">Male</SelectItem>
                                                    <SelectItem value="Female">Female</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-4 items-center gap-4">
                                            <Label htmlFor="destination" className="text-right">목적지</Label>
                                            <Select value={newStudentForm.destinationId} onValueChange={(v) => setNewStudentForm(p => ({...p, destinationId: v}))}>
                                                <SelectTrigger className="col-span-3">
                                                    <SelectValue placeholder="목적지 선택" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Button onClick={handleAddStudent}>추가</Button>
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
                        <CardDescription>드래그하여 빈 좌석에 배정하세요.</CardDescription>
                    </CardHeader>
                    <Separator />
                     <CardContent className='pt-4 max-h-[60vh] overflow-y-auto'>
                         <div className="flex justify-end mb-2 gap-2">
                             <Button size="sm" variant="outline" onClick={handleDownloadStudentTemplate}><Download className="mr-2 h-4 w-4" /> 템플릿</Button>
                             <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> 일괄 등록</Button>
                             <input type="file" ref={fileInputRef} onChange={handleStudentFileUpload} accept=".csv" className="hidden" />
                         </div>
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
    const [loading, setLoading] = useState(true);

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
            setLoading(true);
            try {
                const [busesData, studentsData, routesData, destinationsData, suggestionsData] = await Promise.all([
                    getBuses(),
                    getStudents(),
                    getRoutes(),
                    getDestinations(),
                    getSuggestedDestinations(),
                ]);
                setBuses(busesData);
                setStudents(studentsData);
                setRoutes(routesData);
                setDestinations(destinationsData);
                setSuggestedDestinations(suggestionsData);
                if (busesData.length > 0 && !selectedBusId) {
                  setSelectedBusId(busesData[0].id);
                }
            } catch (error) {
                console.error("Failed to fetch initial data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const headerContent = (
      <div className="flex items-center gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm font-medium">버스</label>
            <Select value={selectedBusId} onValueChange={setSelectedBusId} disabled={loading}>
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
            <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)} disabled={loading}>
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
                <TabsTrigger value="Morning" disabled={loading}>등교</TabsTrigger>
                <TabsTrigger value="Afternoon" disabled={loading}>하교</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>
    );

    return (
        <MainLayout headerContent={headerContent}>
            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <p>데이터를 불러오는 중입니다...</p>
                </div>
            ) : (
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
                            setStudents={setStudents}
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
            )}
        </MainLayout>
    );
}
