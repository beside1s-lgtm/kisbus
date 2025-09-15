

'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { DragDropContext, Droppable, Draggable, OnDragEndResponder } from '@hello-pangea/dnd';
import { 
    getBuses, getStudents, getRoutes, getDestinations, getSuggestedDestinations,
    addBus, deleteBus, updateBus,
    addStudent, updateStudent, deleteStudentsInBatch,
    addDestination, deleteDestination, approveSuggestedDestination, addDestinationsInBatch,
    addRoute, updateRouteSeating, updateRouteStops, updateAllBusRoutesSeating, clearAllSuggestedDestinations,
    updateStudentsInBatch,
    unassignStudentFromAllRoutes,
    updateSeatingForBusRoutes
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, NewBus, NewStudent, NewDestination } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { DraggableStudentCard } from '@/components/bus/draggable-student-card';
import { Shuffle, UserPlus, Upload, Trash2, PlusCircle, Download, GripVertical, X, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { MainLayout } from '@/components/layout/main-layout';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const routeTypes: RouteType[] = ['Morning', 'Afternoon', 'AfterSchool'];
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
        try {
            await deleteBus(busId);
            setBuses(prev => prev.filter(b => b.id !== busId));
            toast({ title: "성공", description: "버스가 삭제되었습니다."});
        } catch (error) {
            console.error("Error deleting bus:", error);
            toast({ title: "오류", description: "버스 삭제에 실패했습니다.", variant: 'destructive' });
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
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>정말 이 버스를 삭제하시겠습니까?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    이 작업은 되돌릴 수 없습니다. 이 버스와 관련된 모든 노선 정보가 영구적으로 삭제됩니다.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>취소</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteBus(bus.id)}>삭제</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
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
  filterComponent
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
  filterComponent: React.ReactNode;
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
        const trimmedName = newDestinationName.trim();
        if (!trimmedName) return;

        if (destinations.some(d => d.name.toLowerCase() === trimmedName.toLowerCase())) {
            toast({ title: "오류", description: "이미 존재하는 목적지입니다.", variant: 'destructive' });
            return;
        }

        try {
            const newDest = await addDestination({ name: trimmedName });
            setDestinations(prev => [...prev, newDest]);
            setNewDestinationName('');
            toast({ title: "성공", description: "목적지가 추가되었습니다." });
        } catch (error) {
            toast({ title: "오류", description: "목적지 추가 실패", variant: 'destructive' });
        }
    };
    
    const handleDeleteDestination = async (id: string) => {
        try {
            await deleteDestination(id);
            setDestinations(prev => prev.filter(d => d.id !== id));
            toast({ title: "성공", description: "목적지가 삭제되었습니다." });
        } catch (error) {
            toast({ title: "오류", description: "목적지 삭제 실패", variant: 'destructive' });
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
    const trimmedName = suggestion.name.trim();
    if (destinations.some(d => d.name.toLowerCase() === trimmedName.toLowerCase())) {
        toast({ title: "알림", description: "이미 등록된 목적지입니다. 제안 목록에서 삭제합니다." });
        try {
            await deleteDoc(doc(db, 'suggestedDestinations', suggestion.id));
            setSuggestedDestinations(prev => prev.filter(s => s.id !== suggestion.id));
        } catch (error) {
             toast({ title: "오류", description: "제안 삭제 중 오류 발생", variant: 'destructive'});
        }
        return;
    }
      
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

  const handleClearAllSuggestions = async () => {
    try {
        await clearAllSuggestedDestinations();
        setSuggestedDestinations([]);
        toast({ title: "성공", description: "모든 제안된 목적지가 삭제되었습니다." });
    } catch (error) {
        toast({ title: "오류", description: "삭제 중 오류가 발생했습니다.", variant: 'destructive' });
    }
  };


  const handleDragEnd: OnDragEndResponder = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    // Find the actual current route from the state, not from the memoized value
    const latestCurrentRoute = routes.find(r =>
        r.busId === selectedBusId &&
        r.dayOfWeek === selectedDay &&
        r.type === selectedRouteType
    );

    if (!latestCurrentRoute) return;

    const currentStopIds = latestCurrentRoute.stops || [];

    // Moving from all destinations list to the route list
    if (source.droppableId === 'all-destinations' && destination.droppableId === 'route-stops') {
        if (currentStopIds.includes(draggableId)) {
            toast({ title: "오류", description: "이미 노선에 추가된 목적지입니다.", variant: 'destructive' });
            return;
        }
        const newStopIds = Array.from(currentStopIds);
        newStopIds.splice(destination.index, 0, draggableId);

        const newRoutes = routes.map(r => r.id === latestCurrentRoute.id ? { ...r, stops: newStopIds } : r);
        setRoutes(newRoutes);
        await updateRouteStops(latestCurrentRoute.id, newStopIds);
    }
    // Reordering within the route list
    else if (source.droppableId === 'route-stops' && destination.droppableId === 'route-stops') {
        const newStopIds = Array.from(currentStopIds);
        const [reorderedItem] = newStopIds.splice(source.index, 1);
        newStopIds.splice(destination.index, 0, reorderedItem);

        const newRoutes = routes.map(r => r.id === latestCurrentRoute.id ? { ...r, stops: newStopIds } : r);
        setRoutes(newRoutes);
        await updateRouteStops(latestCurrentRoute.id, newStopIds);
    }
  };

  const removeStopFromRoute = (stopId: string) => {
    const latestCurrentRoute = routes.find(r =>
        r.busId === selectedBusId &&
        r.dayOfWeek === selectedDay &&
        r.type === selectedRouteType
    );
    if (!latestCurrentRoute) return;

    const newStopIds = latestCurrentRoute.stops.filter(id => id !== stopId);
    
    setRoutes(prevRoutes =>
        prevRoutes.map(route =>
            route.id === latestCurrentRoute.id
                ? { ...route, stops: newStopIds }
                : route
        )
    );

    updateRouteStops(latestCurrentRoute.id, newStopIds).catch(error => {
        console.error("Failed to update stops in DB:", error);
        toast({ title: "오류", description: "노선 업데이트 실패", variant: 'destructive' });
        // Revert to previous state on error
        setRoutes(routes); 
    });
};
  
  return (
    <DragDropContext onDragEnd={handleDragEnd}>
        <div className="space-y-6">
            {filterComponent}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <Card>
                    <CardHeader>
                    <CardTitle>버스 노선 설정</CardTitle>
                    <CardDescription>
                        전체 목적지 목록에서 오른쪽 노선 순서로 목적지를 드래그하여 추가하세요.
                    </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {selectedBus ? (
                            <Card>
                            <CardHeader>
                                <CardTitle>{selectedBus.name} - {selectedRouteType === 'Morning' ? '등교' : selectedRouteType === 'Afternoon' ? '하교' : '방과후'} 노선</CardTitle>
                                <CardDescription>드래그하여 노선 순서를 정하고, 'X'를 눌러 삭제합니다.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Droppable droppableId="route-stops">
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={cn("flex flex-col gap-2 p-2 border rounded-md min-h-[150px] bg-muted/50", snapshot.isDraggingOver && "bg-primary/10")}
                                        >
                                            {getStopsForCurrentRoute().map((dest, index) => (
                                                <Draggable key={dest.id} draggableId={dest.id} index={index}>
                                                    {(provided, snapshot) => (
                                                         <div
                                                            ref={provided.innerRef}
                                                            {...provided.draggableProps}
                                                            {...provided.dragHandleProps}
                                                            className={cn("p-2 flex items-center gap-2 rounded-md", snapshot.isDragging ? "bg-card shadow-lg" : "bg-card/80")}
                                                        >
                                                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                                                            <span className="flex-1 text-sm font-medium">{dest.name}</span>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeStopFromRoute(dest.id)}>
                                                                <X className="h-4 w-4 text-destructive" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </CardContent>
                            </Card>
                        ) : (
                            <div className="text-center text-muted-foreground py-10">버스를 선택하여 노선을 확인하세요.</div>
                        )}
                    </CardContent>
                </Card>
                
                <div className="space-y-6">
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
                             <CardFooter>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full">
                                            <Trash2 className="mr-2 h-4 w-4" /> 모두 삭제
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>정말 모든 제안을 삭제하시겠습니까?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            이 작업은 되돌릴 수 없습니다. 승인되지 않은 모든 목적지 제안이 영구적으로 삭제됩니다.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClearAllSuggestions}>삭제</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardFooter>
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
                            <Droppable droppableId="all-destinations" isDropDisabled={true}>
                                {(provided) => (
                                    <div
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[100px] bg-muted/50"
                                    >
                                        {destinations.map((dest, index) => (
                                             <Draggable key={dest.id} draggableId={dest.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={cn("rounded-full border px-3 py-1 text-sm font-semibold transition-colors flex items-center gap-1", snapshot.isDragging && "shadow-lg")}
                                                    >
                                                        {dest.name}
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-5 w-5 -mr-2">
                                                                    <X className="w-3 h-3 text-destructive" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>정말 이 목적지를 삭제하시겠습니까?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        이 작업은 되돌릴 수 없습니다.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDeleteDestination(dest.id)}>삭제</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    </DragDropContext>
  );
};


const StudentManagementTab = ({
    students,
    setStudents,
    buses,
    routes,
    setRoutes,
    destinations,
    selectedBusId,
    selectedDay,
    selectedRouteType,
    days,
    filterComponent,
}:{
    students: Student[],
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
    buses: Bus[],
    routes: Route[],
    setRoutes: React.Dispatch<React.SetStateAction<Route[]>>,
    destinations: Destination[],
    selectedBusId: string | null;
    selectedDay: DayOfWeek;
    selectedRouteType: RouteType;
    days: DayOfWeek[];
    filterComponent: React.ReactNode;
}) => {
    const { toast } = useToast();
    const [newStudentForm, setNewStudentForm] = useState<Partial<NewStudent>>({ gender: 'Male' });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());

    const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);

    const currentRoute = useMemo(() => {
        return routes.find(r =>
            r.busId === selectedBusId &&
            r.dayOfWeek === selectedDay &&
            r.type === selectedRouteType
        );
    }, [routes, selectedBusId, selectedDay, selectedRouteType]);
    
    const unassignedStudents = useMemo(() => {
        if (!currentRoute) return [];
        const assignedStudentIds = new Set(currentRoute.seating.map(s => s.studentId).filter(Boolean));
        
        const isAfterSchool = selectedRouteType === 'AfterSchool';
        
        const relevantStudents = students.filter(student => {
             const hasDestination = isAfterSchool
                ? student.afterSchoolDestinations && student.afterSchoolDestinations[selectedDay]
                : !!student.mainDestinationId;
            return hasDestination && !assignedStudentIds.has(student.id);
        });

        return relevantStudents;
    }, [students, currentRoute, selectedRouteType, selectedDay]);
    
     const handleToggleSelectAll = () => {
        const allUnassignedIds = unassignedStudents.map(s => s.id);
        if (selectedStudentIds.size === allUnassignedIds.length) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(allUnassignedIds));
        }
    };
    
    const handleToggleStudentSelection = (studentId: string, isChecked: boolean) => {
        const newSelection = new Set(selectedStudentIds);
        if (isChecked) {
            newSelection.add(studentId);
        } else {
            newSelection.delete(studentId);
        }
        setSelectedStudentIds(newSelection);
    };

    const handleDeleteSelectedStudents = async () => {
        if (selectedStudentIds.size === 0) {
            toast({ title: "알림", description: "삭제할 학생을 선택해주세요." });
            return;
        }

        try {
            const idsToDelete = Array.from(selectedStudentIds);
            await deleteStudentsInBatch(idsToDelete);

            setStudents(prev => prev.filter(s => !idsToDelete.includes(s.id)));
            // Also need to update routes in case they were assigned somewhere
            const newRoutes = routes.map(route => ({
                ...route,
                seating: route.seating.map(seat => 
                    seat.studentId && idsToDelete.includes(seat.studentId)
                        ? { ...seat, studentId: null }
                        : seat
                )
            }));
            setRoutes(newRoutes);
            
            setSelectedStudentIds(new Set());
            toast({ title: "성공", description: `${idsToDelete.length}명의 학생이 삭제되었습니다.` });
        } catch (error) {
            console.error("Error deleting students:", error);
            toast({ title: "오류", description: "학생 삭제 중 오류가 발생했습니다.", variant: "destructive" });
        }
    };

    const handleSeatUpdate = useCallback(async (newSeating: {seatNumber: number; studentId: string | null}[]) => {
        if (!currentRoute) return;

        const oldRoutes = [...routes];
        
        let newRoutes = routes.map(route => {
            if (route.id === currentRoute.id) {
                return { ...route, seating: newSeating };
            }
            return route;
        });
        
        setRoutes(newRoutes);

        try {
            await updateRouteSeating(currentRoute.id, newSeating);
        } catch (error) {
            setRoutes(oldRoutes);
            toast({ title: "오류", description: "좌석 배정 실패", variant: 'destructive'});
        }
    }, [currentRoute, routes, setRoutes, toast]);

    const unassignStudent = useCallback(async (studentId: string) => {
        if (!currentRoute) return;

        const oldRoutes = [...routes];
        
        const newRoutes = routes.map(route => {
            if (route.id === currentRoute.id) {
                return {
                    ...route,
                    seating: route.seating.map(seat =>
                        seat.studentId === studentId ? { ...seat, studentId: null } : seat
                    )
                };
            }
            return route;
        });

        setRoutes(newRoutes);
        
        try {
             const routeToUpdate = newRoutes.find(r => r.id === currentRoute.id);
             if (routeToUpdate) {
                await updateRouteSeating(currentRoute.id, routeToUpdate.seating);
                toast({ title: "성공", description: "학생의 좌석 배정이 해제되었습니다."});
             }
        } catch(e) {
            setRoutes(oldRoutes); // Revert on error
            toast({ title: "오류", description: "좌석 배정 해제 실패", variant: 'destructive'});
        }
    }, [routes, currentRoute, setRoutes, toast]);

    const handleResetSeating = useCallback(async () => {
        if (!selectedBus) {
            toast({ title: "오류", description: "버스를 먼저 선택해주세요.", variant: 'destructive'});
            return;
        }
        if (!currentRoute) return;

        const oldRoutes = [...routes];
        const emptySeating = generateInitialSeating(selectedBus.capacity);

        const newRoutes = routes.map(route => {
            if (route.id === currentRoute.id) {
                return { ...route, seating: emptySeating };
            }
            return route;
        });
        setRoutes(newRoutes);

        try {
            await updateRouteSeating(currentRoute.id, emptySeating);
            toast({ title: "성공", description: `${selectedBus.name}의 ${selectedDay} ${selectedRouteType} 노선 좌석 배정이 초기화되었습니다.` });
        } catch (error) {
            setRoutes(oldRoutes);
            toast({ title: "오류", description: "좌석 초기화 실패", variant: 'destructive' });
        }

    }, [selectedBus, currentRoute, routes, setRoutes, toast, selectedDay, selectedRouteType]);

    const randomizeSeating = useCallback(async () => {
        if (!selectedBus || !currentRoute) return;
    
        const oldRoutes = [...routes];

        const studentsForThisRoute = students.filter(s => {
            const destId = selectedRouteType === 'AfterSchool' ? (s.afterSchoolDestinations ? s.afterSchoolDestinations[selectedDay] : null) : s.mainDestinationId;
            return destId && currentRoute.stops.includes(destId);
        });

        const gradeToValue = (grade: string) => {
            if (grade.toLowerCase().startsWith('k')) return 0;
            const num = parseInt(grade.replace(/\D/g, ''));
            return isNaN(num) ? 99 : num;
        };
        const sortedStudents = [...studentsForThisRoute].sort((a, b) => gradeToValue(a.grade) - gradeToValue(b.grade));
    
        let males = sortedStudents.filter(s => s.gender === 'Male');
        let females = sortedStudents.filter(s => s.gender === 'Female');
    
        const newSeatingPlan = generateInitialSeating(selectedBus.capacity);
        const occupiedSeats = new Set<number>();
    
        const getSeatType = (seatNumber: number, capacity: number): 'window' | 'aisle' => {
            if (capacity === 15) {
                if ([1, 2, 4, 6, 8, 10, 13, 14].includes(seatNumber)) return 'window';
                return 'aisle';
            }
            const col = (seatNumber - 1) % 4;
            if (capacity === 45 && seatNumber > 40) {
                return seatNumber === 41 || seatNumber === 45 ? 'window' : 'aisle';
            }
            if (capacity === 29 && seatNumber > 24) {
                return seatNumber === 25 || seatNumber === 29 ? 'window' : 'aisle';
            }
            return col === 0 || col === 3 ? 'window' : 'aisle';
        };
        
        const getSeatPairs = (capacity: number): [number, number][] => {
            const pairs: [number, number][] = [];
            const numRows = Math.ceil(capacity / 4);
             if (capacity === 15) {
                return [[2,3], [4,5], [6,7], [8,9], [10,11], [13,14]];
            }
            for (let row = 0; row < numRows; row++) {
                const base = row * 4 + 1;
                if (base + 1 <= capacity && !((capacity === 45 && base + 1 > 40) || (capacity === 29 && base + 1 > 24))) pairs.push([base, base + 1]);
                if (base + 2 <= capacity && base + 3 <= capacity && !((capacity === 45 && base + 3 > 40) || (capacity === 29 && base + 3 > 24))) pairs.push([base + 2, base + 3]);
            }
            return pairs;
        };
    
        const seatPairs = getSeatPairs(selectedBus.capacity);
        const routeStopOrder = currentRoute.stops;
    
        while (males.length > 0 && females.length > 0) {
            const male = males.shift()!;
            const female = females.shift()!;
            let placed = false;
    
            for (const pair of seatPairs) {
                if (!occupiedSeats.has(pair[0]) && !occupiedSeats.has(pair[1])) {
                    const [seat1, seat2] = pair;
    
                    const maleDestId = selectedRouteType === 'AfterSchool' ? (male.afterSchoolDestinations ? male.afterSchoolDestinations[selectedDay] : null) : male.mainDestinationId;
                    const femaleDestId = selectedRouteType === 'AfterSchool' ? (female.afterSchoolDestinations ? female.afterSchoolDestinations[selectedDay] : null) : female.mainDestinationId;

                    const maleStopIndex = routeStopOrder.indexOf(maleDestId!);
                    const femaleStopIndex = routeStopOrder.indexOf(femaleDestId!);
    
                    let studentForWindow = (maleStopIndex > femaleStopIndex) ? male : female;
                    let studentForAisle = (maleStopIndex > femaleStopIndex) ? female : male;
                    
                    let windowSeat = getSeatType(seat1, selectedBus.capacity) === 'window' ? seat1 : seat2;
                    let aisleSeat = getSeatType(seat1, selectedBus.capacity) === 'window' ? seat2 : seat1;
    
                    const windowSeatIndex = newSeatingPlan.findIndex(s => s.seatNumber === windowSeat);
                    const aisleSeatIndex = newSeatingPlan.findIndex(s => s.seatNumber === aisleSeat);
    
                    if (windowSeatIndex !== -1) newSeatingPlan[windowSeatIndex].studentId = studentForWindow.id;
                    if (aisleSeatIndex !== -1) newSeatingPlan[aisleSeatIndex].studentId = studentForAisle.id;
    
                    occupiedSeats.add(seat1);
                    occupiedSeats.add(seat2);
                    placed = true;
                    break;
                }
            }
    
            if (!placed) { 
                males.unshift(male);
                females.unshift(female);
                break;
            }
        }
    
        const remainingStudents = [...males, ...females].sort((a,b) => gradeToValue(a.grade) - gradeToValue(b.grade));
        const emptySeats = newSeatingPlan.filter(s => !s.studentId).map(s => s.seatNumber);
        
        for (const student of remainingStudents) {
            if (emptySeats.length > 0) {
                const seatNumber = emptySeats.shift()!;
                const seatIndex = newSeatingPlan.findIndex(s => s.seatNumber === seatNumber);
                if (seatIndex !== -1) {
                    newSeatingPlan[seatIndex].studentId = student.id;
                }
            }
        }
    
        if (selectedDay === 'Monday') {
            const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            const routeTypesToCopy: RouteType[] = ['Morning', 'Afternoon'];
            
            const routesToUpdate = routes.filter(r => 
                r.busId === selectedBusId && 
                weekdays.includes(r.dayOfWeek) &&
                routeTypesToCopy.includes(r.type)
            );
            
            const newRoutes = routes.map(route => {
                if (routesToUpdate.some(u => u.id === route.id)) {
                    return { ...route, seating: newSeatingPlan };
                }
                return route;
            });
            setRoutes(newRoutes);
    
            try {
                const routeIdsToUpdate = routesToUpdate.map(r => r.id);
                await updateSeatingForBusRoutes(routeIdsToUpdate, newSeatingPlan);
                toast({ title: "성공", description: "랜덤 배정이 완료되었고, 월-금 등하교 노선에 복사되었습니다." });
            } catch (error) {
                setRoutes(oldRoutes);
                toast({ title: "오류", description: "랜덤 배정 및 복사 실패", variant: 'destructive' });
            }
        } else {
             // Update only current route if not Monday
            const newRoutes = routes.map(route => {
                if (route.id === currentRoute.id) {
                    return { ...route, seating: newSeatingPlan };
                }
                return route;
            });
            setRoutes(newRoutes);
        
            try {
                await updateRouteSeating(currentRoute.id, newSeatingPlan);
                toast({ title: "성공", description: "랜덤 배정이 완료되었습니다." });
            } catch (error) {
                setRoutes(oldRoutes); // Revert on failure
                toast({ title: "오류", description: "랜덤 배정 실패", variant: 'destructive' });
            }
        }
    }, [selectedBus, students, routes, currentRoute, setRoutes, toast, selectedDay, selectedRouteType]);
    
    const handleDownloadStudentTemplate = () => {
        const headers = "학생 ID,학생 이름,학년,반,성별,등하교 목적지,방과후 목적지";
        const example = "STUDENT_ID_123,김민준,G1,C1,Male,강남역,서초역";
        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + example;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "student_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadUnassignedStudents = () => {
        if (unassignedStudents.length === 0) {
            toast({ title: "알림", description: "미배정 학생이 없습니다."});
            return;
        }

        const headers = "학생 ID,학생 이름,학년,반,성별,등하교 목적지,방과후 목적지";
        const csvData = unassignedStudents.map(s => {
            const mainDestName = destinations.find(d => d.id === s.mainDestinationId)?.name || '';
            const afterSchoolDestName = destinations.find(d => d.id === (s.afterSchoolDestinations ? s.afterSchoolDestinations[selectedDay] : null))?.name || '';
            return [s.id, s.name, s.grade, s.class, s.gender, mainDestName, afterSchoolDestName].join(',');
        }).join('\n');

        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + csvData;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "unassigned_students.csv");
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
                const studentsToUpdate: { id: string; data: Partial<Student> }[] = [];
                const studentsToAdd: NewStudent[] = [];

                results.data.forEach((row: any) => {
                    const mainDestName = (row['등하교 목적지'] || '').trim();
                    const afterSchoolDestName = (row['방과후 목적지'] || '').trim();
                    
                    const mainDestination = destinations.find(d => d.name === mainDestName);
                    const afterSchoolDestination = destinations.find(d => d.name === afterSchoolDestName);

                    const studentId = (row['학생 ID'] || '').trim();
                    
                    if (studentId) { // Existing student to update
                        const studentUpdate: { id: string; data: Partial<Student> } = { id: studentId, data: {} };
                        if (mainDestination) studentUpdate.data.mainDestinationId = mainDestination.id;
                        
                        // For after school, we assume the CSV applies to all days for simplicity
                        if (afterSchoolDestination) {
                            const afterSchoolDestinations: Partial<Record<DayOfWeek, string | null>> = {};
                            days.forEach(day => {
                                afterSchoolDestinations[day] = afterSchoolDestination.id;
                            });
                            studentUpdate.data.afterSchoolDestinations = afterSchoolDestinations;
                        }

                        if(Object.keys(studentUpdate.data).length > 0) {
                           studentsToUpdate.push(studentUpdate);
                        }
                    } else { // New student to add
                        const afterSchoolDestinations: Partial<Record<DayOfWeek, string | null>> = {};
                        if(afterSchoolDestination){
                            days.forEach(day => {
                                afterSchoolDestinations[day] = afterSchoolDestination.id;
                            });
                        }
                        const newStudent: NewStudent = {
                            name: (row['학생 이름'] || '').trim(),
                            grade: (row['학년'] || '').trim(),
                            class: (row['반'] || '').trim(),
                            gender: (row['성별'] || '').trim() as 'Male' | 'Female',
                            mainDestinationId: mainDestination?.id || null,
                            afterSchoolDestinations: afterSchoolDestinations
                        };
                        if (newStudent.name && newStudent.grade && newStudent.class && newStudent.gender) {
                            studentsToAdd.push(newStudent);
                        }
                    }
                });

                if (studentsToUpdate.length === 0 && studentsToAdd.length === 0) {
                    toast({ title: "오류", description: "유효한 학생 데이터를 찾을 수 없거나 목적지가 존재하지 않습니다.", variant: "destructive" });
                    return;
                }

                try {
                    let updateCount = 0;
                    let addCount = 0;

                    if (studentsToUpdate.length > 0) {
                        await updateStudentsInBatch(studentsToUpdate.map(s => ({id: s.id, ...s.data})));
                        const updatedIds = new Set(studentsToUpdate.map(s => s.id));
                        setStudents(prev => prev.map(s => {
                            if (updatedIds.has(s.id)) {
                                const updatedStudentData = studentsToUpdate.find(u => u.id === s.id);
                                return { ...s, ...updatedStudentData?.data };
                            }
                            return s;
                        }));
                        updateCount = studentsToUpdate.length;
                    }

                    if (studentsToAdd.length > 0) {
                        const addedStudents = await Promise.all(studentsToAdd.map(s => addStudent(s)));
                        setStudents(prev => [...prev, ...addedStudents]);
                        addCount = addedStudents.length;
                    }
                    
                    toast({ title: "성공", description: `${addCount}명의 학생이 추가되고 ${updateCount}명의 학생 정보가 업데이트되었습니다.` });

                } catch (error) {
                    console.error(error);
                    toast({ title: "오류", description: "일괄 처리 중 오류 발생", variant: "destructive" });
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
        const { name, grade, class: studentClass, gender, mainDestinationId, afterSchoolDestinations } = newStudentForm;
        if (!name || !grade || !studentClass || !gender) {
            toast({ title: "오류", description: "목적지를 제외한 모든 필드를 입력해주세요.", variant: "destructive" });
            return;
        }
        try {
            const newStudentData: NewStudent = { name, grade, class: studentClass, gender, mainDestinationId: mainDestinationId || null, afterSchoolDestinations: afterSchoolDestinations || {} };
            const newStudent = await addStudent(newStudentData);
            setStudents(prev => [...prev, newStudent]);
            setNewStudentForm({ name: '', grade: '', class: '', gender: 'Male', mainDestinationId: '', afterSchoolDestinations: {} });
            toast({ title: "성공", description: "학생이 추가되었습니다." });
        } catch (error) {
            toast({ title: "오류", description: "학생 추가 실패", variant: "destructive" });
        }
    };

    const handleDestinationChange = async (studentId: string, newDestinationId: string, type: 'main' | 'afterSchool') => {
        try {
            let updateData: Partial<Student>;

            if (type === 'main') {
                 updateData = { mainDestinationId: newDestinationId };
            } else {
                 const student = students.find(s => s.id === studentId);
                 if (!student) return;
                 const newAfterSchoolDests = { ...(student.afterSchoolDestinations || {}), [selectedDay]: newDestinationId };
                 updateData = { afterSchoolDestinations: newAfterSchoolDests };
            }

            await updateStudent(studentId, updateData);

            setStudents(prev => prev.map(s => s.id === studentId ? { ...s, ...updateData } : s));
            toast({ title: "성공", description: "학생의 목적지가 업데이트되었습니다." });
        } catch (error) {
            toast({ title: "오류", description: "목적지 업데이트 실패", variant: "destructive" });
        }
    };

    const onDragEnd: OnDragEndResponder = (result) => {
        const { source, destination, draggableId: studentId } = result;

        if (!destination || !currentRoute) return;

        const newSeating = [...currentRoute.seating];

        // Case 1: Moving from unassigned list to a seat
        if (source.droppableId === 'unassigned-students' && destination.droppableId.startsWith('seat-')) {
            const seatNumber = parseInt(destination.droppableId.replace('seat-', ''));
            const targetSeatIndex = newSeating.findIndex(s => s.seatNumber === seatNumber);

            if (targetSeatIndex !== -1 && newSeating[targetSeatIndex].studentId) {
                toast({ title: "오류", description: "이미 다른 학생이 배정된 좌석입니다.", variant: "destructive" });
                return;
            }

            if (targetSeatIndex !== -1) {
                // If student was in another seat, unseat them first
                const sourceSeatIndex = newSeating.findIndex(s => s.studentId === studentId);
                if (sourceSeatIndex !== -1) newSeating[sourceSeatIndex].studentId = null;
                
                newSeating[targetSeatIndex].studentId = studentId;
            }

            handleSeatUpdate(newSeating);
        }
        // Case 2: Moving from a seat to another seat
        else if (source.droppableId.startsWith('seat-') && destination.droppableId.startsWith('seat-')) {
            const sourceSeatNumber = parseInt(source.droppableId.replace('seat-', ''));
            const destinationSeatNumber = parseInt(destination.droppableId.replace('seat-', ''));
            
            if(sourceSeatNumber === destinationSeatNumber) return;

            const sourceSeatIndex = newSeating.findIndex(s => s.seatNumber === sourceSeatNumber);
            const destinationSeatIndex = newSeating.findIndex(s => s.seatNumber === destinationSeatNumber);

            if (destinationSeatIndex !== -1 && newSeating[destinationSeatIndex].studentId) {
                const studentInDestSeat = newSeating[destinationSeatIndex].studentId;
                if (sourceSeatIndex !== -1) newSeating[sourceSeatIndex].studentId = studentInDestSeat;
                if (destinationSeatIndex !== -1) newSeating[destinationSeatIndex].studentId = studentId;
            } else { 
                if (sourceSeatIndex !== -1) newSeating[sourceSeatIndex].studentId = null;
                if (destinationSeatIndex !== -1) newSeating[destinationSeatIndex].studentId = studentId;
            }
            
            handleSeatUpdate(newSeating);
        }
         // Case 3: Moving from a seat back to the unassigned list
        else if (source.droppableId.startsWith('seat-') && destination.droppableId === 'unassigned-students') {
            unassignStudent(studentId);
        }
    };

    if (!selectedBusId) {
       return (
            <div className="space-y-6">
                {filterComponent}
                <div className="p-4 text-center text-muted-foreground">버스를 선택하여 학생을 관리하세요.</div>
            </div>
       );
    }
    
     if (!currentRoute) {
        return (
            <div className="space-y-6">
                {filterComponent}
                <div className="p-4 text-center text-muted-foreground">선택된 조건에 해당하는 노선 정보를 찾을 수 없습니다.</div>
            </div>
        );
    }

    return (
        <DragDropContext onDragEnd={onDragEnd}>
        <div className="space-y-6">
            {filterComponent}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="flex-row items-center justify-between">
                            <div>
                               <CardTitle className="font-headline">좌석표</CardTitle>
                               <CardDescription>미배정 학생을 드래그하여 배정하거나, 좌석을 클릭하여 배정을 해제하세요.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline"><RotateCcw className="mr-2" /> 좌석 초기화</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>정말 모든 좌석 배정을 초기화하시겠습니까?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                               이 작업은 되돌릴 수 없습니다. {selectedBus?.name}의 모든 좌석 배정이 해제됩니다.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>취소</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleResetSeating}>초기화</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
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
                                                <Input id="name" value={newStudentForm.name || ''} onChange={e => setNewStudentForm(p => ({...p, name: e.target.value}))} className="col-span-3" />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="grade" className="text-right">학년</Label>
                                                <Input id="grade" value={newStudentForm.grade || ''} onChange={e => setNewStudentForm(p => ({...p, grade: e.target.value}))} placeholder="예: G1" className="col-span-3" />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="class" className="text-right">반</Label>
                                                <Input id="class" value={newStudentForm.class || ''} onChange={e => setNewStudentForm(p => ({...p, class: e.target.value}))} placeholder="예: C1" className="col-span-3" />
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
                                                <Label htmlFor="destination" className="text-right">등/하교 목적지</Label>
                                                <Select value={newStudentForm.mainDestinationId || ''} onValueChange={(v) => setNewStudentForm(p => ({...p, mainDestinationId: v}))}>
                                                    <SelectTrigger className="col-span-3">
                                                        <SelectValue placeholder="목적지 선택" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                             <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="destination" className="text-right">방과후 목적지</Label>
                                                <Select value={ (newStudentForm.afterSchoolDestinations && newStudentForm.afterSchoolDestinations['Monday']) || ''} onValueChange={(v) => setNewStudentForm(p => {
                                                    const newDests: Partial<Record<DayOfWeek, string | null>> = {};
                                                    days.forEach(day => newDests[day] = v);
                                                    return {...p, afterSchoolDestinations: newDests};
                                                })}>
                                                    <SelectTrigger className="col-span-3">
                                                        <SelectValue placeholder="모든 요일 방과후 목적지 선택" />
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
                           {selectedBus && currentRoute && (
                                <BusSeatMap
                                    bus={selectedBus}
                                    seating={currentRoute.seating}
                                    students={students}
                                    destinations={destinations}
                                    onSeatClick={(seatNumber, studentId) => {
                                        if (studentId) unassignStudent(studentId);
                                    }}
                                    draggable={true}
                                    routeType={selectedRouteType}
                                    dayOfWeek={selectedDay}
                                />
                           )}
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-1">
                     <Card className="sticky top-20">
                        <CardHeader>
                            <CardTitle className="font-headline">미배정 학생 ({selectedRouteType === 'AfterSchool' ? `(${dayLabels[selectedDay]}) 방과후` : '등/하교'})</CardTitle>
                            <CardDescription>드래그하여 빈 좌석에 배정하세요.</CardDescription>
                        </CardHeader>
                        <Separator />
                         <CardContent className='pt-4 max-h-[60vh] overflow-y-auto'>
                             <div className="flex justify-end mb-2 gap-2 flex-wrap">
                                 <Button size="sm" variant="outline" onClick={handleDownloadStudentTemplate}><Download className="mr-2 h-4 w-4" /> 템플릿</Button>
                                 <Button size="sm" variant="outline" onClick={handleDownloadUnassignedStudents}><Download className="mr-2 h-4 w-4" /> 목록 다운로드</Button>
                                 <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> 일괄 등록/수정</Button>
                                 <input type="file" ref={fileInputRef} onChange={handleStudentFileUpload} accept=".csv" className="hidden" />
                                 <Button size="sm" variant="outline" onClick={handleToggleSelectAll}>
                                    {selectedStudentIds.size === unassignedStudents.length && unassignedStudents.length > 0 ? '선택 해제' : '모두 선택'}
                                 </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="destructive" disabled={selectedStudentIds.size === 0}>
                                            <Trash2 className="mr-2 h-4 w-4" /> 선택 삭제
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>정말 선택한 학생들을 삭제하시겠습니까?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                이 작업은 되돌릴 수 없습니다. {selectedStudentIds.size}명의 학생 정보가 영구적으로 삭제됩니다.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>취소</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteSelectedStudents}>삭제</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                             </div>
                             <Droppable droppableId="unassigned-students">
                                {(provided) => (
                                    <div ref={provided.innerRef} {...provided.droppableProps}>
                                        {unassignedStudents.length > 0 ? unassignedStudents.map((student, index) => (
                                            <Draggable key={student.id} draggableId={student.id} index={index}>
                                                {(provided) => (
                                                    <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                        <DraggableStudentCard 
                                                            student={student} 
                                                            destinations={destinations}
                                                            onDestinationChange={handleDestinationChange}
                                                            isChecked={selectedStudentIds.has(student.id)}
                                                            onCheckedChange={(isChecked) => handleToggleStudentSelection(student.id, isChecked)}
                                                            routeType={selectedRouteType}
                                                            dayOfWeek={selectedDay}
                                                        />
                                                    </div>
                                                )}
                                            </Draggable>
                                        )) : (
                                            <p className="text-sm text-muted-foreground text-center py-4">모든 학생이 배정되었거나, 이 노선 유형에 해당하는 학생이 없습니다.</p>
                                        )}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
        </DragDropContext>
    );
};

interface AdminPageFilterProps {
    buses: Bus[];
    selectedBusId: string | null;
    setSelectedBusId: (id: string | null) => void;
    selectedDay: DayOfWeek;
    setSelectedDay: (day: DayOfWeek) => void;
    selectedRouteType: RouteType;
    setSelectedRouteType: (type: RouteType) => void;
    days: DayOfWeek[];
    dayLabels: { [key in DayOfWeek]: string };
    loading: boolean;
}

const AdminPageFilter: React.FC<AdminPageFilterProps> = ({
    buses,
    selectedBusId,
    setSelectedBusId,
    selectedDay,
    setSelectedDay,
    selectedRouteType,
    setSelectedRouteType,
    days,
    dayLabels,
    loading
}) => {
    return (
        <Card className="mb-6">
            <CardContent className="p-4">
                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label className="text-sm font-medium">버스</Label>
                    <Select value={selectedBusId || ''} onValueChange={setSelectedBusId} disabled={loading}>
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
                    <Label className="text-sm font-medium">요일</Label>
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
                    <Label className="text-sm font-medium">경로</Label>
                    <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="Morning" disabled={loading}>등교</TabsTrigger>
                        <TabsTrigger value="Afternoon" disabled={loading}>하교</TabsTrigger>
                        <TabsTrigger value="AfterSchool" disabled={loading}>방과후</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
            </CardContent>
        </Card>
    );
};


export default function AdminPage() {
    const [buses, setBuses] = useState<Bus[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [suggestedDestinations, setSuggestedDestinations] = useState<Destination[]>([]);
    const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
    const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
    const [activeTab, setActiveTab] = useState('student-management');
    const [loading, setLoading] = useState(true);

    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayLabels: { [key in DayOfWeek]: string } = {
        Monday: '월요일',
        Tuesday: '화요일',
        Wednesday: '수요일',
        Thursday: '목요일',
        Friday: '금요일',
        Saturday: '토요일',
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

    const filterComponent = (
        <AdminPageFilter
            buses={buses}
            selectedBusId={selectedBusId}
            setSelectedBusId={setSelectedBusId}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            selectedRouteType={selectedRouteType}
            setSelectedRouteType={setSelectedRouteType}
            days={days}
            dayLabels={dayLabels}
            loading={loading}
        />
    )

    return (
        <MainLayout>
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
                            setRoutes={setRoutes}
                            destinations={destinations}
                            setDestinations={setDestinations}
                            suggestedDestinations={suggestedDestinations}
                            setSuggestedDestinations={setSuggestedDestinations}
                            selectedDay={selectedDay}
                            selectedRouteType={selectedRouteType}
                            selectedBusId={selectedBusId}
                            filterComponent={filterComponent}
                        />
                    </TabsContent>
                    <TabsContent value="student-management" className="mt-6">
                        <StudentManagementTab 
                            students={students} 
                            setStudents={setStudents}
                            buses={buses}
                            routes={routes} 
                            setRoutes={setRoutes}
                            destinations={destinations}
                            selectedBusId={selectedBusId}
                            selectedDay={selectedDay}
                            selectedRouteType={selectedRouteType}
                            days={days}
                            filterComponent={filterComponent}
                        />
                    </TabsContent>
                </Tabs>
            )}
        </MainLayout>
    );
}
