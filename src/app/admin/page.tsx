

'use client';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Papa from 'papaparse';
import { 
    getBuses, getStudents, getRoutes, getDestinations, getSuggestedDestinations, getTeachers,
    addBus, deleteBus,
    addStudent, updateStudent, deleteStudentsInBatch,
    addDestination, deleteDestination, approveSuggestedDestination, addDestinationsInBatch,
    addRoute, updateRouteSeating, updateRouteStops, clearAllSuggestedDestinations,
    updateStudentsInBatch,
    addTeachersInBatch, updateRoute, deleteAllDestinations,
    copySeatingPlan,
    copyRoutePlan,
    onRoutesUpdate,
    unassignStudentFromAllRoutes,
} from '@/lib/firebase-data';
import type { Bus, Student, Route, Destination, DayOfWeek, RouteType, NewBus, NewStudent, NewDestination, Teacher, NewTeacher } from '@/lib/types';
import { BusSeatMap } from '@/components/bus/bus-seat-map';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { StudentCard } from '@/components/bus/draggable-student-card';
import { Shuffle, UserPlus, Upload, Trash2, PlusCircle, Download, X, RotateCcw, UserCog, Pencil, Search, Copy, Check, Bell, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, UserX } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/use-auth';

const generateInitialSeating = (capacity: number): { seatNumber: number; studentId: string | null }[] => {
    return Array.from({ length: capacity }, (_, i) => ({
        seatNumber: i + 1,
        studentId: null,
    }));
};

const dayLabels: { [key in DayOfWeek]: string } = {
    Monday: '월요일',
    Tuesday: '화요일',
    Wednesday: '수요일',
    Thursday: '목요일',
    Friday: '금요일',
    Saturday: '토요일',
};

const sortBuses = (buses: Bus[]): Bus[] => {
  return buses.sort((a, b) => {
    const numA = parseInt(a.name.replace(/\D/g, ''), 10);
    const numB = parseInt(b.name.replace(/\D/g, ''), 10);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    return a.name.localeCompare(b.name);
  });
};

const sortDestinations = (destinations: Destination[]): Destination[] => {
    return destinations.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
};

const BusRegistrationTab = ({ buses, routes, teachers, setBuses }: { buses: Bus[], routes: Route[], teachers: Teacher[], setBuses: React.Dispatch<React.SetStateAction<Bus[]>> }) => {
    const [newBusName, setNewBusName] = useState('');
    const [newBusType, setNewBusType] = useState<'15-seater' | '29-seater' | '45-seater'>('45-seater');
    const { toast } = useToast();
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const routeTypes: RouteType[] = ['Morning', 'Afternoon', 'AfterSchool'];
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [teacherViewType, setTeacherViewType] = useState<'MorningAndAfternoon' | 'AfterSchool'>('MorningAndAfternoon');

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
                        teacherIds: [],
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
            setBuses(prev => sortBuses([...prev, newBus]));
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
        const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + headers + "\n" + examples.join("\n");
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
                const { dismiss } = toast({ title: "처리 중", description: "버스를 일괄 등록하고 있습니다..." });
                try {
                    const addedBuses = await Promise.all(newBusesData.map(busData => handleAddBus(busData)));
                    setBuses(prev => sortBuses([...prev, ...addedBuses]));
                    dismiss();
                    toast({ title: "성공", description: `${addedBuses.length}개의 버스가 일괄 등록되었습니다.` });
                } catch (error) {
                    dismiss();
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
    
    const getTeachersForBus = (busId: string) => {
        const relevantRouteType = teacherViewType === 'MorningAndAfternoon' ? 'Morning' : 'AfterSchool';
        // Display Monday's teachers as representative
        const relevantRoute = routes.find(r => r.busId === busId && r.dayOfWeek === 'Monday' && r.type === relevantRouteType);
        if (!relevantRoute || !relevantRoute.teacherIds) return '미배정';

        const teacherNames = relevantRoute.teacherIds
            .map(id => teachers.find(t => t.id === id)?.name)
            .filter(Boolean);

        return teacherNames.length > 0 ? teacherNames.join(', ') : '미배정';
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>버스 목록</CardTitle>
                <CardDescription>새로운 버스를 추가하거나 기존 버스를 삭제합니다. 담당 선생님은 월요일 기준으로 표시됩니다.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4">
                    <Tabs value={teacherViewType} onValueChange={(v) => setTeacherViewType(v as any)} className="w-auto">
                      <TabsList className="grid grid-cols-2">
                        <TabsTrigger value="MorningAndAfternoon">등하교</TabsTrigger>
                        <TabsTrigger value="AfterSchool">방과후</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="flex gap-2">
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
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>버스 번호</TableHead>
                            <TableHead>타입</TableHead>
                            <TableHead>담당 선생님</TableHead>
                            <TableHead className="text-right">작업</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {buses.map(bus => (
                            <TableRow key={bus.id}>
                                <TableCell>{bus.name}</TableCell>
                                <TableCell>{bus.type}</TableCell>
                                <TableCell>{getTeachersForBus(bus.id)}</TableCell>
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

const TeacherAssignmentDialog = ({ currentRoute, allRoutes, teachers, setRoutes, onOpenChange }: { currentRoute: Route, allRoutes: Route[], teachers: Teacher[], setRoutes: React.Dispatch<React.SetStateAction<Route[]>>, onOpenChange: (open: boolean) => void }) => {
    const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
    const { toast } = useToast();

    useEffect(() => {
        if (currentRoute) {
            setSelectedTeacherIds(currentRoute.teacherIds || []);
        }
    }, [currentRoute]);
    
    const assignedToOtherRoutesIds = useMemo(() => {
        if (!currentRoute) return new Set<string>();
        // Find teacher IDs assigned to other routes of the same type (Morning/Afternoon vs AfterSchool) on the same day
        const isCommuteRoute = currentRoute.type === 'Morning' || currentRoute.type === 'Afternoon';
        const relevantRouteTypes = isCommuteRoute ? ['Morning', 'Afternoon'] : ['AfterSchool'];

        const otherRoutes = allRoutes.filter(r => 
            r.id !== currentRoute.id && 
            r.dayOfWeek === currentRoute.dayOfWeek &&
            relevantRouteTypes.includes(r.type)
        );
        const ids = new Set<string>();
        otherRoutes.forEach(r => {
            r.teacherIds?.forEach(id => ids.add(id));
        });
        return ids;
    }, [allRoutes, currentRoute]);

    const handleSave = async () => {
        if (!currentRoute) return;
        try {
            await updateRoute(currentRoute.id, { teacherIds: selectedTeacherIds });
            // Local state update will be handled by the onSnapshot listener
            toast({ title: "성공", description: "담당 선생님이 변경되었습니다." });
            onOpenChange(false);
        } catch (error) {
            toast({ title: "오류", description: "선생님 변경 중 오류가 발생했습니다.", variant: "destructive" });
        }
    };

    const handleCheckboxChange = (teacherId: string, checked: boolean) => {
        setSelectedTeacherIds(prev =>
            checked ? [...prev, teacherId] : prev.filter(id => id !== teacherId)
        );
    };

    const sortedTeachers = useMemo(() => [...teachers].sort((a, b) => a.name.localeCompare(b.name, 'ko')), [teachers]);
    
    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>담당 선생님 변경</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                {sortedTeachers.map(teacher => {
                    const isAssignedToOtherRoute = assignedToOtherRoutesIds.has(teacher.id);
                    const isAssignedToCurrentRoute = selectedTeacherIds.includes(teacher.id);
                    const isDisabled = isAssignedToOtherRoute && !isAssignedToCurrentRoute;

                    return (
                        <div key={teacher.id} className="flex items-center space-x-2">
                            <Checkbox
                                id={`teacher-${teacher.id}`}
                                checked={selectedTeacherIds.includes(teacher.id)}
                                onCheckedChange={(checked) => handleCheckboxChange(teacher.id, checked as boolean)}
                                disabled={isDisabled}
                            />
                            <Label htmlFor={`teacher-${teacher.id}`} className={cn(isDisabled && "text-muted-foreground")}>
                                {teacher.name}
                                {isDisabled && <span className="text-xs ml-2">(다른 노선에 배정됨)</span>}
                            </Label>
                        </div>
                    );
                })}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
                <Button onClick={handleSave}>저장</Button>
            </DialogFooter>
        </DialogContent>
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
  teachers,
  selectedDay,
  selectedRouteType,
  selectedBusId,
}: {
  buses: Bus[];
  routes: Route[];
  setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
  destinations: Destination[];
  setDestinations: React.Dispatch<React.SetStateAction<Destination[]>>;
  suggestedDestinations: Destination[],
  setSuggestedDestinations: React.Dispatch<React.SetStateAction<Destination[]>>;
  teachers: Teacher[];
  selectedDay: DayOfWeek;
  selectedRouteType: RouteType;
  selectedBusId: string | null;
}) => {
  const [newDestinationName, setNewDestinationName] = useState('');
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('');
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);

  // States for button-based stop management
  const [selectedRouteStopId, setSelectedRouteStopId] = useState<string | null>(null);
  const [selectedAllDestId, setSelectedAllDestId] = useState<string | null>(null);
  
  // States for route copy dialog
  const [isCopyRouteDialogOpen, setCopyRouteDialogOpen] = useState(false);
  const weekdays: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], []);
  const [daysToCopyRouteTo, setDaysToCopyRouteTo] = useState<Partial<Record<DayOfWeek, boolean>>>(
      () => weekdays.reduce((acc, day) => ({ ...acc, [day]: true }), {})
  );
  const [routeTypesToCopyRouteTo, setRouteTypesToCopyRouteTo] = useState<Partial<Record<'Morning' | 'Afternoon', boolean>>>({ Morning: true, Afternoon: true });


  const selectedBus = useMemo(() => {
    if (!selectedBusId) return null;
    return buses.find(b => b.id === selectedBusId);
  }, [buses, selectedBusId]);
  
  const currentRoute = useMemo(() => {
    if (!selectedBusId) return null;
    return routes.find(r =>
        r.busId === selectedBusId &&
        r.dayOfWeek === selectedDay &&
        r.type === selectedRouteType
    );
  }, [routes, selectedBusId, selectedDay, selectedRouteType]);

  useEffect(() => {
      // Reset selections when route changes
      setSelectedRouteStopId(null);
      setSelectedAllDestId(null);
  }, [currentRoute]);


  const filteredDestinations = useMemo(() => {
    if (!destinationSearchQuery) {
        return destinations;
    }
    return destinations.filter(dest => 
        dest.name.toLowerCase().includes(destinationSearchQuery.toLowerCase())
    );
  }, [destinations, destinationSearchQuery]);

  const getStopsForCurrentRoute = useCallback(() => {
    if (!currentRoute) return [];
    return currentRoute.stops.map(stopId => destinations.find(d => d.id === stopId)!).filter(Boolean);
  }, [currentRoute, destinations]);

    const assignedTeachers = useMemo(() => {
        if (!currentRoute || !currentRoute.teacherIds) return [];
        return currentRoute.teacherIds.map(id => teachers.find(t => t.id === id)).filter(Boolean) as Teacher[];
    }, [currentRoute, teachers]);
  
   const handleAddDestination = async () => {
        const trimmedName = newDestinationName.trim();
        if (!trimmedName) return;

        if (destinations.some(d => d.name.toLowerCase() === trimmedName.toLowerCase())) {
            toast({ title: "알림", description: "이미 존재하는 목적지입니다.", variant: 'default' });
            return;
        }

        try {
            const newDest = await addDestination({ name: trimmedName });
            setDestinations(prev => sortDestinations([...prev, newDest]));
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
    
    const handleClearAllDestinations = async () => {
        const { dismiss } = toast({ title: "처리 중", description: "모든 목적지를 삭제하고 있습니다..." });
        try {
            await deleteAllDestinations();
            setDestinations([]);
            // Local state update will be handled by the onSnapshot listener
            dismiss();
            toast({ title: "성공", description: "모든 목적지가 삭제되었습니다." });
        } catch (error) {
            dismiss();
            toast({ title: "오류", description: "목적지 삭제 중 오류가 발생했습니다.", variant: "destructive" });
        }
    };
  
  const handleDownloadDestinationTemplate = () => {
    const headers = "목적지 이름";
    const example = "강남역";
    const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + headers + "\n" + example;
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
            const existingNames = new Set(destinations.map(d => d.name.toLowerCase()));
            const newDestinationsData: NewDestination[] = results.data.map((row: any) => ({
                name: (row['목적지 이름'] || row['name'] || '').trim()
            })).filter(dest => dest.name && !existingNames.has(dest.name.toLowerCase()));

            if (newDestinationsData.length === 0) {
                toast({ title: "알림", description: "새로 추가할 목적지가 없거나 모두 중복된 이름입니다.", variant: "default" });
                return;
            }
            const { dismiss } = toast({ title: "처리 중", description: "목적지를 일괄 등록하고 있습니다..." });
            try {
                const addedDests = await addDestinationsInBatch(newDestinationsData);
                setDestinations(prev => sortDestinations([...prev, ...addedDests]));
                dismiss();
                toast({ title: "성공", description: `${addedDests.length}개의 목적지가 일괄 등록되었습니다.` });
            } catch (error) {
                dismiss();
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
        setDestinations(sortDestinations(newDests));
        toast({ title: "성공", description: "제안된 목적지가 승인되었습니다."});
    } catch (error) {
        toast({ title: "오류", description: "승인 처리 중 오류 발생", variant: 'destructive'});
    }
  };

  const handleClearAllSuggestions = async () => {
    const { dismiss } = toast({ title: "처리 중", description: "모든 제안을 삭제하고 있습니다..." });
    try {
        await clearAllSuggestedDestinations();
        setSuggestedDestinations([]);
        dismiss();
        toast({ title: "성공", description: "모든 제안된 목적지가 삭제되었습니다." });
    } catch (error) {
        dismiss();
        toast({ title: "오류", description: "삭제 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

    const handleSelectRouteStop = (stopId: string) => {
        setSelectedRouteStopId(prev => prev === stopId ? null : stopId);
        setSelectedAllDestId(null);
    };

    const handleSelectAllDest = (destId: string) => {
        setSelectedAllDestId(prev => prev === destId ? null : destId);
        setSelectedRouteStopId(null);
    };

  const handleMoveStop = useCallback(async (direction: 'up' | 'down') => {
      if (!currentRoute || !selectedRouteStopId) return;

      const currentStopIds = currentRoute.stops || [];
      const index = currentStopIds.indexOf(selectedRouteStopId);

      if (index === -1) return;

      const newStopIds = [...currentStopIds];
      if (direction === 'up' && index > 0) {
          [newStopIds[index - 1], newStopIds[index]] = [newStopIds[index], newStopIds[index - 1]];
      } else if (direction === 'down' && index < newStopIds.length - 1) {
          [newStopIds[index], newStopIds[index + 1]] = [newStopIds[index + 1], newStopIds[index]];
      } else {
          return; // Cannot move further
      }
      await updateRouteStops(currentRoute.id, newStopIds);
  }, [currentRoute, selectedRouteStopId]);

    const handleAddStopToRoute = useCallback(async () => {
        if (!currentRoute || !selectedAllDestId) return;
        const currentStopIds = currentRoute.stops || [];
        if (currentStopIds.includes(selectedAllDestId)) {
            toast({ title: "오류", description: "이미 노선에 추가된 목적지입니다.", variant: 'destructive' });
            return;
        }
        const newStopIds = [...currentStopIds, selectedAllDestId];
        await updateRouteStops(currentRoute.id, newStopIds);
        setSelectedAllDestId(null);
    }, [currentRoute, selectedAllDestId, toast]);

    const handleRemoveStopFromRoute = useCallback(async () => {
        if (!currentRoute || !selectedRouteStopId) return;
        const currentStopIds = currentRoute.stops || [];
        const newStopIds = currentStopIds.filter(id => id !== selectedRouteStopId);
        await updateRouteStops(currentRoute.id, newStopIds);
        setSelectedRouteStopId(null);
    }, [currentRoute, selectedRouteStopId]);


  const assignRandomTeachers = useCallback(async () => {
    if (!selectedBus || !currentRoute) {
        toast({ title: "오류", description: "노선을 선택해주세요.", variant: 'destructive' });
        return;
    }
    if (teachers.length === 0) {
        toast({ title: "오류", description: "등록된 선생님이 없습니다. 선생님을 먼저 등록해주세요.", variant: 'destructive' });
        return;
    }

    let numToAssign = 1;
    if (selectedBus.type === '45-seater') {
        numToAssign = 2;
    }

    const isCommuteRoute = currentRoute.type === 'Morning' || currentRoute.type === 'Afternoon';
    const relevantRouteTypes = isCommuteRoute ? ['Morning', 'Afternoon'] : ['AfterSchool'];

    const availableTeachers = teachers.filter(teacher => {
        // Check if teacher is assigned to another route on the same day and same route type group (commute vs afterschool)
        const isAssignedToOtherRoute = routes.some(route => 
            route.id !== currentRoute.id && 
            route.dayOfWeek === currentRoute.dayOfWeek &&
            relevantRouteTypes.includes(route.type) &&
            route.teacherIds?.includes(teacher.id)
        );
        return !isAssignedToOtherRoute;
    });

    if (availableTeachers.length < numToAssign) {
        toast({ title: "알림", description: `배정 가능한 선생님이 부족합니다. (${availableTeachers.length}명 가능)`, variant: "default" });
        numToAssign = availableTeachers.length;
    }

    const shuffledTeachers = [...availableTeachers].sort(() => 0.5 - Math.random());
    const assignedTeacherIds = shuffledTeachers.slice(0, numToAssign).map(t => t.id);

    try {
        await updateRoute(currentRoute.id, { teacherIds: assignedTeacherIds });
        // Local state update will be handled by the onSnapshot listener
        toast({ title: "성공", description: "담당 선생님이 배정되었습니다." });
    } catch (error) {
        console.error("Error assigning teachers:", error);
        toast({ title: "오류", description: "선생님 배정 중 오류가 발생했습니다.", variant: 'destructive' });
    }
  }, [selectedBus, currentRoute, teachers, routes, toast]);
  
  const handleResetTeachers = useCallback(async () => {
    if (!currentRoute) return;

    const isCommuteRoute = currentRoute.type === 'Morning' || currentRoute.type === 'Afternoon';
    const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    let routesToUpdate: Route[] = [];

    if (isCommuteRoute) {
        routesToUpdate = routes.filter(r => 
            r.busId === currentRoute.busId &&
            weekdays.includes(r.dayOfWeek) &&
            (r.type === 'Morning' || r.type === 'Afternoon')
        );
    } else { // AfterSchool
        routesToUpdate = routes.filter(r =>
            r.busId === currentRoute.busId &&
            r.type === 'AfterSchool'
        );
    }

    if (routesToUpdate.length === 0) {
        toast({ title: "알림", description: "초기화할 노선이 없습니다." });
        return;
    }

    try {
        const batch = writeBatch(db);
        routesToUpdate.forEach(route => {
            const routeRef = doc(db, 'routes', route.id);
            batch.update(routeRef, { teacherIds: [] });
        });
        await batch.commit();

        // Local state update will be handled by the onSnapshot listener
        toast({ title: "성공", description: "관련된 모든 노선의 담당 선생님 배정이 초기화되었습니다." });
    } catch (error) {
        console.error("Error resetting teachers:", error);
        toast({ title: "오류", description: "초기화 중 오류가 발생했습니다.", variant: "destructive" });
    }
  }, [currentRoute, routes, toast]);
  
  const handleCopyToAllWeekdays = useCallback(async () => {
    if (!currentRoute) {
        toast({title: "오류", description: "현재 노선 정보를 찾을 수 없습니다.", variant: 'destructive'});
        return;
    }

    const teacherIdsToCopy = currentRoute.teacherIds || [];
    const targetBusId = currentRoute.busId;
    const weekdays: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const routesToUpdate = routes.filter(r => 
        r.busId === targetBusId && 
        weekdays.includes(r.dayOfWeek) && 
        (r.type === 'Morning' || r.type === 'Afternoon')
    );

    try {
        const batch = writeBatch(db);
        routesToUpdate.forEach(route => {
            const routeRef = doc(db, 'routes', route.id);
            batch.update(routeRef, { teacherIds: teacherIdsToCopy });
        });
        await batch.commit();

        // Local state update will be handled by the onSnapshot listener
        toast({title: "성공", description: `평일 등/하교 노선에 담당 선생님 정보가 복사되었습니다.`});
    } catch (error) {
        console.error("Error copying teachers:", error);
        toast({title: "오류", description: "복사 중 오류가 발생했습니다.", variant: 'destructive'});
    }
  }, [currentRoute, routes, toast]);
  
  const handleCopyRoute = useCallback(async () => {
      if (!currentRoute) {
          toast({ title: "오류", description: "복사할 원본 노선을 찾을 수 없습니다.", variant: "destructive" });
          return;
      }

      const selectedDays = weekdays.filter(day => daysToCopyRouteTo[day]);
      const selectedRouteTypes = (['Morning', 'Afternoon'] as const).filter(type => routeTypesToCopyRouteTo[type]);

      if (selectedDays.length === 0 || selectedRouteTypes.length === 0) {
          toast({ title: "알림", description: "복사할 요일과 경로 유형(등교/하교)을 하나 이상 선택해주세요." });
          return;
      }

      const targetRoutes = routes.filter(r =>
          r.busId === currentRoute.busId &&
          selectedDays.includes(r.dayOfWeek) &&
          selectedRouteTypes.includes(r.type as 'Morning' | 'Afternoon') &&
          r.id !== currentRoute.id // Don't copy to self
      );

      if (targetRoutes.length === 0) {
          toast({ title: "알림", description: "복사할 대상 노선이 없습니다." });
          return;
      }
      
      try {
          await copyRoutePlan(currentRoute.stops, targetRoutes);
          
          // Local state update will be handled by the onSnapshot listener
          
          toast({ title: "성공", description: "현재 노선 구성을 선택된 요일의 노선에 복사했습니다." });
          setCopyRouteDialogOpen(false);
      } catch (error) {
          console.error("Error copying route plan:", error);
          toast({ title: "오류", description: "노선 구성 복사 중 오류가 발생했습니다.", variant: "destructive" });
      }
  }, [currentRoute, routes, toast, daysToCopyRouteTo, routeTypesToCopyRouteTo, weekdays]);

  const handleToggleAllCopyToDays = (checked: boolean) => {
      const newDays = weekdays.reduce((acc, day) => ({ ...acc, [day]: checked }), {});
      setDaysToCopyRouteTo(newDays);
  };


  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
            <Card>
                <CardHeader>
                <CardTitle>전체 목적지 목록</CardTitle>
                <CardDescription>
                    버튼을 이용해 노선을 관리하세요.
                </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end gap-2 mb-4">
                        <Button variant="outline" onClick={handleDownloadDestinationTemplate}><Download className="mr-2" /> 템플릿</Button>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> 일괄 등록</Button>
                        <input type="file" ref={fileInputRef} onChange={handleDestinationFileUpload} accept=".csv" className="hidden" />
                    </div>
                     <div className="flex justify-end gap-2 mb-4">
                        <Dialog>
                            <DialogTrigger asChild><Button className="w-full"><PlusCircle className="mr-2" /> 목적지 추가</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>새 목적지 추가</DialogTitle></DialogHeader>
                                <Input placeholder="예: 강남역" value={newDestinationName} onChange={e => setNewDestinationName(e.target.value)} />
                                <Button className="mt-2" onClick={handleAddDestination}>추가</Button>
                            </DialogContent>
                        </Dialog>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full"><Trash2 className="mr-2 h-4 w-4" /> 전체 삭제</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>정말 모든 목적지를 삭제하시겠습니까?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        이 작업은 되돌릴 수 없습니다. 모든 목적지와 모든 노선의 경유지 정보가 영구적으로 삭제됩니다.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearAllDestinations}>삭제</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search"
                            placeholder="목적지 검색..."
                            className="pl-8 w-full"
                            value={destinationSearchQuery}
                            onChange={(e) => setDestinationSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-col gap-2 p-2 border rounded-md min-h-[300px] max-h-[40vh] overflow-y-auto bg-muted/50">
                        {filteredDestinations.map((dest) => (
                            <div
                                key={dest.id}
                                onClick={() => handleSelectAllDest(dest.id)}
                                className={cn(
                                    "p-2 flex items-center gap-2 rounded-md cursor-pointer hover:bg-primary/10",
                                    selectedAllDestId === dest.id && "bg-primary/20 ring-2 ring-primary"
                                )}
                            >
                                <span className="flex-1 text-sm font-medium">{dest.name}</span>
                                <AlertDialog onOpenChange={(open) => open && setSelectedAllDestId(null)}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                            <X className="w-3 h-3 text-destructive" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>정말 이 목적지를 삭제하시겠습니까?</AlertDialogTitle>
                                            <AlertDialogDescription>이 작업은 되돌릴 수 없습니다.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>취소</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteDestination(dest.id)}>삭제</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col items-center justify-center gap-4">
                <Button 
                    size="icon"
                    className="h-12 w-12"
                    onClick={handleAddStopToRoute}
                    disabled={!currentRoute || !selectedAllDestId}
                    aria-label="Add stop to route"
                >
                    <ArrowRight className="h-6 w-6" />
                </Button>
                 <Button 
                    variant="destructive"
                    size="icon"
                    className="h-12 w-12"
                    onClick={handleRemoveStopFromRoute}
                    disabled={!currentRoute || !selectedRouteStopId}
                    aria-label="Remove stop from route"
                >
                    <ArrowLeft className="h-6 w-6" />
                </Button>
            </div>

            <Card>
                 <CardHeader className="flex-row justify-between items-center">
                    <div>
                        <CardTitle>버스 노선 설정</CardTitle>
                        <CardDescription>
                            목적지를 선택하고 버튼을 이용해 노선을 구성하세요.
                        </CardDescription>
                    </div>
                     <Dialog open={isCopyRouteDialogOpen} onOpenChange={setCopyRouteDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" disabled={!currentRoute || (selectedRouteType !== 'Morning' && selectedRouteType !== 'Afternoon')}>
                                <Copy className="mr-2" /> 노선 복사
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>노선 구성 복사</DialogTitle>
                                <CardDescription>현재 노선의 정류장 구성을 다른 평일 등/하교 노선에 복사합니다.</CardDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label>복사할 요일 선택</Label>
                                    <div className="flex items-center space-x-2 mt-2">
                                        <Checkbox
                                            id="copy-route-all-days"
                                            checked={weekdays.every(day => daysToCopyRouteTo[day])}
                                            onCheckedChange={(checked) => handleToggleAllCopyToDays(checked as boolean)}
                                        />
                                        <Label htmlFor="copy-route-all-days">모두 선택</Label>
                                    </div>
                                    <div className="grid grid-cols-5 gap-2 mt-2">
                                        {weekdays.map(day => (
                                            <div key={`route-day-${day}`} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`copy-route-day-${day}`}
                                                    checked={!!daysToCopyRouteTo[day]}
                                                    onCheckedChange={(checked) => setDaysToCopyRouteTo(prev => ({ ...prev, [day]: checked }))}
                                                />
                                                <Label htmlFor={`copy-route-day-${day}`}>{dayLabels[day].charAt(0)}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <Label>복사할 경로 유형</Label>
                                    <div className="flex items-center space-x-4 mt-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="copy-route-type-morning"
                                                checked={!!routeTypesToCopyRouteTo.Morning}
                                                onCheckedChange={(checked) => setRouteTypesToCopyRouteTo(prev => ({ ...prev, Morning: checked as boolean }))}
                                            />
                                            <Label htmlFor="copy-route-type-morning">등교</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="copy-route-type-afternoon"
                                                checked={!!routeTypesToCopyRouteTo.Afternoon}
                                                onCheckedChange={(checked) => setRouteTypesToCopyRouteTo(prev => ({ ...prev, Afternoon: checked as boolean }))}
                                            />
                                            <Label htmlFor="copy-route-type-afternoon">하교</Label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCopyRoute} className="w-full">복사</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </CardHeader>
                <CardContent>
                    {selectedBus && currentRoute ? (
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <CardTitle>{selectedBus.name} - {dayLabels[selectedDay]} {selectedRouteType === 'Morning' ? '등교' : selectedRouteType === 'Afternoon' ? '하교' : '방과후'} 노선</CardTitle>
                                        <CardDescription>정류장을 클릭하여 선택하고 순서를 변경하세요.</CardDescription>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="outline" size="icon" onClick={() => handleMoveStop('up')} disabled={!selectedRouteStopId}><ArrowUp className="h-4 w-4"/></Button>
                                        <Button variant="outline" size="icon" onClick={() => handleMoveStop('down')} disabled={!selectedRouteStopId}><ArrowDown className="h-4 w-4"/></Button>
                                    </div>
                                </div>
                            </CardHeader>
                        <CardContent>
                            <div className="flex flex-col gap-2 p-2 border rounded-md min-h-[300px] max-h-[40vh] overflow-y-auto bg-muted/50">
                                {getStopsForCurrentRoute().map((dest) => (
                                     <div
                                        key={dest.id}
                                        onClick={() => handleSelectRouteStop(dest.id)}
                                        className={cn(
                                            "p-2 flex items-center gap-2 rounded-md cursor-pointer hover:bg-primary/10",
                                            "bg-card/80",
                                            selectedRouteStopId === dest.id && "bg-primary/20 ring-2 ring-primary"
                                        )}
                                    >
                                        <span className="flex-1 text-sm font-medium">{dest.name}</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                        </Card>
                    ) : (
                        <div className="text-center text-muted-foreground py-10">버스를 선택하여 노선을 확인하세요.</div>
                    )}
                </CardContent>
            </Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                {selectedBus && currentRoute && (
                    <Card>
                        <CardHeader>
                            <CardTitle>담당 선생님 배정</CardTitle>
                            <CardDescription>현재 선택된 노선({selectedBus.name} - {dayLabels[selectedDay]} {selectedRouteType})의 담당 선생님을 배정합니다.</CardDescription>
                        </CardHeader>
                            <CardContent>
                            {assignedTeachers.length > 0 ? (
                                <div className="text-sm text-muted-foreground">
                                    <strong>담당 선생님:</strong> {assignedTeachers.map(t => t.name).join(', ')}
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">배정된 선생님이 없습니다.</div>
                            )}
                            {(selectedRouteType === 'Morning' || selectedRouteType === 'Afternoon') && (
                                    <Button variant="link" onClick={handleCopyToAllWeekdays} className="p-0 h-auto mt-2 text-sm">
                                    <Copy className="mr-2"/> 현재 배정을 모든 평일 등/하교 노선에 복사
                                </Button>
                            )}
                        </CardContent>
                        <CardFooter className="grid grid-cols-3 gap-2">
                            <Button onClick={assignRandomTeachers}><UserCog className="mr-2"/>재배정</Button>
                            <Dialog open={isTeacherDialogOpen} onOpenChange={setIsTeacherDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline"><Pencil className="mr-2"/>수동 변경</Button>
                                </DialogTrigger>
                                {currentRoute && <TeacherAssignmentDialog currentRoute={currentRoute} allRoutes={routes} teachers={teachers} setRoutes={setRoutes} onOpenChange={setIsTeacherDialogOpen} />}
                            </Dialog>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={!assignedTeachers || assignedTeachers.length === 0}><RotateCcw className="mr-2"/>초기화</Button>
                                </AlertDialogTrigger>
                                    <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>정말 담당 선생님 배정을 초기화하시겠습니까?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            이 작업은 되돌릴 수 없습니다. 현재 버스의 연관된 모든 노선(등/하교 또는 방과후)의 담당 선생님 배정이 초기화됩니다.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleResetTeachers}>해제</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    </Card>
                )}
        </div>
    </div>
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
    setSelectedBusId,
    setSelectedDay,
    setSelectedRouteType,
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
    setSelectedBusId: (id: string | null) => void;
    setSelectedDay: (day: DayOfWeek) => void;
    setSelectedRouteType: (type: RouteType) => void;
}) => {
    const { toast } = useToast();
    const [newStudentForm, setNewStudentForm] = useState<Partial<NewStudent>>({ gender: 'Male' });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
    const [isCopySeatingDialogOpen, setCopySeatingDialogOpen] = useState(false);
    const weekdays: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], []);
    const [daysToCopyTo, setDaysToCopyTo] = useState<Partial<Record<DayOfWeek, boolean>>>(() => 
        weekdays.reduce((acc, day) => ({ ...acc, [day]: true }), {})
    );
    const [routeTypesToCopyTo, setRouteTypesToCopyTo] = useState<Partial<Record<'Morning' | 'Afternoon', boolean>>>({ Morning: true, Afternoon: true });
    
    const [unassignedSearchQuery, setUnassignedSearchQuery] = useState('');
    const [filteredUnassignedStudents, setFilteredUnassignedStudents] = useState<Student[]>([]);
    
    // Seat assignment state
    const [selectedSeat, setSelectedSeat] = useState<{ seatNumber: number; studentId: string | null } | null>(null);
    const [unassignableStudents, setUnassignableStudents] = useState<Student[]>([]);

    // Student search state
    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState<Student[]>([]);
    const [selectedGlobalStudent, setSelectedGlobalStudent] = useState<Student | null>(null);
    
    const assignedRoutesForSelectedStudent = useMemo(() => {
        if (!selectedGlobalStudent) return [];
        return routes.filter(route => 
            route.seating.some(seat => seat.studentId === selectedGlobalStudent.id)
        );
    }, [selectedGlobalStudent, routes]);



    const selectedBus = useMemo(() => buses.find(b => b.id === selectedBusId), [buses, selectedBusId]);

    const currentRoute = useMemo(() => {
        return routes.find(r =>
            r.busId === selectedBusId &&
            r.dayOfWeek === selectedDay &&
            r.type === selectedRouteType
        );
    }, [routes, selectedBusId, selectedDay, selectedRouteType]);

     useEffect(() => {
        const allValidStopIds = new Set<string>();
        routes.forEach(r => r.stops.forEach(stopId => allValidStopIds.add(stopId)));

        const unassignable = students.filter(student => {
            const hasMorningError = student.morningDestinationId && !allValidStopIds.has(student.morningDestinationId);
            const hasAfternoonError = student.afternoonDestinationId && !allValidStopIds.has(student.afternoonDestinationId);
            
            let hasAfterSchoolError = false;
            if (student.afterSchoolDestinations) {
                for (const day in student.afterSchoolDestinations) {
                    const destId = student.afterSchoolDestinations[day as DayOfWeek];
                    if (destId && !allValidStopIds.has(destId)) {
                        hasAfterSchoolError = true;
                        break;
                    }
                }
            }
            return hasMorningError || hasAfternoonError || hasAfterSchoolError;
        });

        setUnassignableStudents(unassignable);

    }, [students, routes]);
    
    useEffect(() => {
        if (!currentRoute) {
            setFilteredUnassignedStudents([]);
            return;
        }

        const assignedStudentIdsOnCurrentRoute = new Set(
            currentRoute.seating.map(s => s.studentId).filter(Boolean)
        );

        let afternoonAssignedStudentIds = new Set<string>();
        if (selectedRouteType === 'AfterSchool') {
            const afternoonRoutesForDay = routes.filter(r => r.dayOfWeek === selectedDay && r.type === 'Afternoon');
            afternoonRoutesForDay.forEach(r => {
                r.seating.forEach(seat => {
                    if (seat.studentId) {
                        afternoonAssignedStudentIds.add(seat.studentId);
                    }
                });
            });
        }
        
        const unassigned = students.filter(student => {
            if (assignedStudentIdsOnCurrentRoute.has(student.id)) return false;
            if (unassignableStudents.some(u => u.id === student.id)) return false;
            
            if (selectedRouteType === 'AfterSchool' && afternoonAssignedStudentIds.has(student.id)) {
                return false;
            }
            
            let destId: string | null = null;
            if (selectedRouteType === 'Morning') {
                destId = student.morningDestinationId;
            } else if (selectedRouteType === 'Afternoon') {
                destId = student.afternoonDestinationId;
            } else if (selectedRouteType === 'AfterSchool') {
                 destId = student.afterSchoolDestinations?.[selectedDay] ?? null;
            }
            
            if (selectedRouteType === 'AfterSchool' && !destId) {
                destId = student.afternoonDestinationId;
            }
            
            if (!destId || !currentRoute.stops.includes(destId)) {
                return false;
            }

            if (!unassignedSearchQuery) return true;

            const lowerCaseQuery = unassignedSearchQuery.toLowerCase();
            const nameMatch = student.name.toLowerCase().includes(lowerCaseQuery);
            const destinationName = destinations.find(d => d.id === destId)?.name.toLowerCase() || '';
            const destMatch = destinationName.includes(lowerCaseQuery);

            return nameMatch || destMatch;
        });

        const sortedUnassigned = unassigned.sort((a,b) => a.name.localeCompare(b.name, 'ko'));
        setFilteredUnassignedStudents(sortedUnassigned);

    }, [students, routes, currentRoute, selectedRouteType, selectedDay, unassignedSearchQuery, destinations, unassignableStudents]);
    
    useEffect(() => {
        // Reset seat selection when route changes
        setSelectedSeat(null);
    }, [currentRoute]);
    
    const handleToggleSelectAll = useCallback(() => {
        if (!filteredUnassignedStudents) return;
        const allUnassignedIds = filteredUnassignedStudents.map(s => s.id);
        if (selectedStudentIds.size === allUnassignedIds.length && allUnassignedIds.length > 0) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(allUnassignedIds));
        }
    }, [filteredUnassignedStudents, selectedStudentIds.size]);

    
    const handleToggleStudentSelection = useCallback((studentId: string, isChecked: boolean) => {
        const newSelection = new Set(selectedStudentIds);
        if (isChecked) {
            newSelection.add(studentId);
        } else {
            newSelection.delete(studentId);
        }
        setSelectedStudentIds(newSelection);
    }, [selectedStudentIds]);

    const handleDeleteSelectedStudents = useCallback(async () => {
        if (selectedStudentIds.size === 0) {
            toast({ title: "알림", description: "삭제할 학생을 선택해주세요." });
            return;
        }

        const { dismiss } = toast({ title: "처리 중", description: "선택한 학생들을 삭제하고 있습니다..." });
        try {
            const idsToDelete = Array.from(selectedStudentIds);
            await deleteStudentsInBatch(idsToDelete);

            setStudents(prev => prev.filter(s => !idsToDelete.includes(s.id)));
            // Local state update for routes will be handled by the onSnapshot listener
            
            setSelectedStudentIds(new Set());
            dismiss();
            toast({ title: "성공", description: `${idsToDelete.length}명의 학생이 삭제되었습니다.` });
        } catch (error) {
            dismiss();
            console.error("Error deleting students:", error);
            toast({ title: "오류", description: "학생 삭제 중 오류가 발생했습니다.", variant: "destructive" });
        }
    }, [selectedStudentIds, setStudents, toast]);

    const handleSeatUpdate = useCallback(async (newSeating: {seatNumber: number; studentId: string | null}[]) => {
        if (!currentRoute) return;
        
        try {
            // Local state update will be handled by the onSnapshot listener
            await updateRouteSeating(currentRoute.id, newSeating);
        } catch (error) {
             toast({ title: "오류", description: "좌석 배정 실패", variant: 'destructive'});
        }
    }, [currentRoute, toast]);
    
    const handleUnassignStudentFromRoute = useCallback(async (routeId: string, studentId: string) => {
        const routeToUpdate = routes.find(r => r.id === routeId);
        if (!routeToUpdate) return;
    
        const newSeating = routeToUpdate.seating.map(seat =>
            seat.studentId === studentId ? { ...seat, studentId: null } : seat
        );
    
        try {
            await updateRouteSeating(routeId, newSeating);
            toast({ title: "성공", description: "학생의 좌석 배정이 해제되었습니다." });
        } catch (error) {
            toast({ title: "오류", description: "배정 해제 중 오류가 발생했습니다.", variant: "destructive" });
        }
    }, [routes, toast]);


    const handleStudentCardClick = useCallback(async (studentId: string) => {
        if (!currentRoute) return;

        // If an empty seat is selected, assign the student to it
        if (selectedSeat && !selectedSeat.studentId) {
            const isAlreadySeated = currentRoute.seating.some(s => s.studentId === studentId);
            if (isAlreadySeated) {
                toast({ title: "알림", description: "이미 다른 좌석에 배정된 학생입니다."});
                return;
            }

            const newSeating = [...currentRoute.seating];
            const targetSeatIndex = newSeating.findIndex(s => s.seatNumber === selectedSeat.seatNumber);

            if (targetSeatIndex !== -1) {
                newSeating[targetSeatIndex].studentId = studentId;
                await handleSeatUpdate(newSeating);
                setSelectedSeat(null); // Reset selection after assignment
                toast({ title: "성공", description: "학생이 좌석에 배정되었습니다."});
            }
        } else {
             toast({ title: "알림", description: "먼저 빈 좌석을 선택해주세요."});
        }
    }, [selectedSeat, currentRoute, toast, handleSeatUpdate]);

    const handleSeatClick = useCallback(async (seatNumber: number, studentId: string | null) => {
        if (!currentRoute) return;
    
        const newSeating = [...currentRoute.seating];
    
        if (selectedSeat) { // A seat is already selected (for swap or assignment)
            if (selectedSeat.studentId) { // An occupied seat was selected first
                const sourceSeatIndex = newSeating.findIndex(s => s.seatNumber === selectedSeat.seatNumber);
                const targetSeatIndex = newSeating.findIndex(s => s.seatNumber === seatNumber);

                if (sourceSeatIndex === -1 || targetSeatIndex === -1) return;
    
                if (selectedSeat.seatNumber === seatNumber) { // Clicked the same seat again to unassign
                    newSeating[sourceSeatIndex].studentId = null;
                    toast({ title: "성공", description: "학생의 좌석 배정이 해제되었습니다." });
                } else { // Swapping students or moving to an empty seat
                    const sourceStudentId = newSeating[sourceSeatIndex].studentId;
                    const targetStudentId = newSeating[targetSeatIndex].studentId;
                    newSeating[sourceSeatIndex].studentId = targetStudentId;
                    newSeating[targetSeatIndex].studentId = sourceStudentId;
                    toast({ title: "성공", description: "학생 좌석이 교체되었습니다." });
                }
                
                await handleSeatUpdate(newSeating);
                setSelectedSeat(null);
    
            } else { // An empty seat was selected first, now handle assignment
                // This case is handled by handleStudentCardClick, so we just reset the selection if another empty seat is clicked.
                if (!studentId) {
                    setSelectedSeat({ seatNumber, studentId });
                }
            }
        } else { // No seat is selected, this is the first click
            setSelectedSeat({ seatNumber, studentId });
        }
    }, [currentRoute, selectedSeat, handleSeatUpdate, toast]);
    
    const handleSeatContextMenu = (e: React.MouseEvent) => {
        if (selectedSeat) {
            e.preventDefault();
            setSelectedSeat(null);
            toast({ title: "취소", description: "좌석 선택이 취소되었습니다." });
        }
    };


    const handleResetSeating = useCallback(async () => {
        if (!selectedBus) {
            toast({ title: "오류", description: "버스를 먼저 선택해주세요.", variant: 'destructive'});
            return;
        }
        if (!currentRoute) return;

        const emptySeating = generateInitialSeating(selectedBus.capacity);
        await handleSeatUpdate(emptySeating);
        toast({ title: "성공", description: `${selectedBus.name}의 ${dayLabels[selectedDay]} ${selectedRouteType} 노선 좌석 배정이 초기화되었습니다.` });
    }, [selectedBus, currentRoute, handleSeatUpdate, toast, selectedDay, selectedRouteType]);

    const handleCopySeating = useCallback(async () => {
        if (!currentRoute || !currentRoute.seating) {
            toast({ title: "오류", description: "복사할 원본 노선을 찾을 수 없습니다.", variant: "destructive" });
            return;
        }
    
        const selectedDays = weekdays.filter(day => daysToCopyTo[day]);
        const selectedTypes = (['Morning', 'Afternoon'] as const).filter(type => routeTypesToCopyTo[type]);
    
        if (selectedDays.length === 0 || selectedTypes.length === 0) {
            toast({ title: "알림", description: "복사할 요일과 경로 유형(등교/하교)을 하나 이상 선택해주세요." });
            return;
        }
        
        const targetRoutes = routes.filter(r =>
            r.busId === currentRoute.busId &&
            selectedDays.includes(r.dayOfWeek) &&
            selectedTypes.includes(r.type as 'Morning' | 'Afternoon') &&
            r.id !== currentRoute.id // Don't copy to self
        );
    
        if (targetRoutes.length === 0) {
            toast({ title: "알림", description: "복사할 대상 노선이 없습니다." });
            return;
        }
    
        try {
            await copySeatingPlan(currentRoute.seating, targetRoutes);
            
            // Local state update will be handled by the onSnapshot listener
            
            toast({ title: "성공", description: `현재 좌석 배치를 선택된 요일의 노선에 복사했습니다.` });
            setCopySeatingDialogOpen(false);
        } catch (error) {
            console.error("Error copying seating plan:", error);
            toast({ title: "오류", description: "좌석 배치 복사 중 오류가 발생했습니다.", variant: "destructive" });
        }
    }, [currentRoute, routes, toast, daysToCopyTo, weekdays, routeTypesToCopyTo]);

    const handleToggleAllCopyToDays = useCallback((checked: boolean) => {
        const newDaysToCopyTo = weekdays.reduce((acc, day) => ({ ...acc, [day]: checked }), {});
        setDaysToCopyTo(newDaysToCopyTo);
    }, [weekdays]);

    const randomizeSeating = useCallback(async () => {
        if (!selectedBus || !currentRoute) return;
    
        const studentsForThisRoute = students.filter(s => {
            let destId: string | null = null;
            if (selectedRouteType === 'Morning') {
                destId = s.morningDestinationId;
            } else if (selectedRouteType === 'Afternoon') {
                destId = s.afternoonDestinationId;
            } else if (selectedRouteType === 'AfterSchool') {
                destId = s.afterSchoolDestinations?.[selectedDay] || null;
                 if (!destId) destId = s.afternoonDestinationId;
            }
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
            if (capacity === 15) { // 12-seat layout
                 const col = (seatNumber -1) % 4;
                 return col === 0 || col === 3 ? 'window' : 'aisle';
            }
            if (capacity === 29) {
                 const col = (seatNumber - 1) % 4;
                 if (seatNumber > 24) return seatNumber === 25 || seatNumber === 29 ? 'window' : 'aisle';
                 return col === 0 || col === 3 ? 'window' : 'aisle';
            }
            if (capacity === 45) {
                 const col = (seatNumber - 1) % 4;
                 if (seatNumber > 40) return seatNumber === 41 || seatNumber === 45 ? 'window' : 'aisle';
                 return col === 0 || col === 3 ? 'window' : 'aisle';
            }
            return 'aisle';
        };
        
        const getSeatPairs = (capacity: number): [number, number][] => {
            const pairs: [number, number][] = [];
             if (capacity === 15) { // 12-seat layout
                for (let row = 0; row < 4; row++) {
                    const base = row * 4 + 1;
                    pairs.push([base, base + 1]);
                }
                return pairs;
            }
            const numRows = Math.ceil(capacity / 4);
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
    
                    let maleDestId: string | null = null;
                    if (selectedRouteType === 'Morning') maleDestId = male.morningDestinationId;
                    else if (selectedRouteType === 'Afternoon') maleDestId = male.afternoonDestinationId;
                    else if (selectedRouteType === 'AfterSchool') maleDestId = male.afterSchoolDestinations?.[selectedDay] || null;

                    let femaleDestId: string | null = null;
                    if (selectedRouteType === 'Morning') femaleDestId = female.morningDestinationId;
                    else if (selectedRouteType === 'Afternoon') femaleDestId = female.afternoonDestinationId;
                    else if (selectedRouteType === 'AfterSchool') femaleDestId = female.afterSchoolDestinations?.[selectedDay] || null;

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
    
        await handleSeatUpdate(newSeatingPlan);
        toast({ title: "성공", description: "랜덤 배정이 완료되었습니다." });

        if (selectedRouteType === 'Morning' || selectedRouteType === 'Afternoon') {
            setCopySeatingDialogOpen(true);
        }

    }, [selectedBus, students, currentRoute, handleSeatUpdate, toast, selectedDay, selectedRouteType, setCopySeatingDialogOpen]);
    
    const handleDownloadStudentTemplate = () => {
        const headers = "학생 이름,학년,반,성별,등교 목적지,하교 목적지,방과후 목적지(월요일),방과후 목적지(화요일),방과후 목적지(수요일),방과후 목적지(목요일),방과후 목적지(금요일),방과후 목적지(토요일)";
        const example = "김민준,G1,C1,Male,강남역,서초역,양재역,양재역,양재역,양재역,양재역,";
        const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + headers + "\n" + example;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "student_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadUnassignedStudents = useCallback(() => {
        if (filteredUnassignedStudents.length === 0) {
            toast({ title: "알림", description: "미배정 학생이 없습니다."});
            return;
        }

        const headers = ["학생 이름","학년","반","성별","목적지"].join(',');
        const csvData = filteredUnassignedStudents.map(s => {
            let destName = '';
             if (selectedRouteType === 'Morning') {
                destName = destinations.find(d => d.id === s.morningDestinationId)?.name || s.suggestedMorningDestination || '';
            } else if (selectedRouteType === 'Afternoon') {
                destName = destinations.find(d => d.id === s.afternoonDestinationId)?.name || s.suggestedAfternoonDestination || '';
            } else if (selectedRouteType === 'AfterSchool') {
                destName = destinations.find(d => d.id === (s.afterSchoolDestinations ? s.afterSchoolDestinations[selectedDay] : null))?.name || (s.suggestedAfterSchoolDestinations ? s.suggestedAfterSchoolDestinations[selectedDay] : '') || '';
            }
            return [s.name, s.grade, s.class, s.gender, destName].join(',');
        }).join('\n');

        const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + headers + "\n" + csvData;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `unassigned_students_${selectedRouteType}_${selectedDay}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [filteredUnassignedStudents, selectedRouteType, selectedDay, destinations, toast]);

    const handleStudentFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const studentsToProcess: NewStudent[] = [];
                const allDestinations = [...destinations];
    
                const findDestId = (name: string) => allDestinations.find(d => d.name === name)?.id || null;
    
                results.data.forEach((row: any) => {
                    const name = (row['학생 이름'] || '').trim();
                    const grade = (row['학년'] || '').trim();
                    const studentClass = (row['반'] || '').trim();
                    
                    if (!name || !grade || !studentClass) return;
    
                    const morningDestName = (row['등교 목적지'] || '').trim();
                    const afternoonDestName = (row['하교 목적지'] || '').trim();
    
                    const afterSchoolDests: Partial<Record<DayOfWeek, string | null>> = {};
                    let hasAfterSchool = false;
                    days.forEach(day => {
                        const dayLabel = dayLabels[day];
                        const destName = (row[`방과후 목적지(${dayLabel})`] || row[`방과후 목적지 (${dayLabel})`] || '').trim();
                        if (destName) {
                            afterSchoolDests[day] = findDestId(destName);
                            hasAfterSchool = true;
                        }
                    });
                    
                    const studentData: NewStudent = {
                        name: name,
                        grade: grade,
                        class: studentClass,
                        gender: (row['성별'] || 'Male').trim() as 'Male' | 'Female',
                        morningDestinationId: morningDestName ? findDestId(morningDestName) : null,
                        afternoonDestinationId: afternoonDestName ? findDestId(afternoonDestName) : null,
                        afterSchoolDestinations: hasAfterSchool ? afterSchoolDests : {},
                        applicationStatus: 'pending'
                    };
                    studentsToProcess.push(studentData);
                });
    
                if (studentsToProcess.length === 0) {
                    toast({ title: "오류", description: "유효한 학생 데이터를 찾을 수 없거나 목적지가 존재하지 않습니다.", variant: "destructive" });
                    return;
                }
                const { dismiss } = toast({ title: "처리 중", description: "학생 정보를 일괄 처리하고 있습니다..." });
                try {
                    const processedStudents = await Promise.all(studentsToProcess.map(s => addStudent(s)));

                    const newStudentList = [...students];
                    processedStudents.forEach(processedStudent => {
                        const index = newStudentList.findIndex(s => s.id === processedStudent.id);
                        if (index !== -1) {
                            newStudentList[index] = processedStudent; // Update existing
                        } else {
                            newStudentList.push(processedStudent); // Add new
                        }
                    });

                    setStudents(newStudentList);
                    dismiss();
                    toast({ title: "성공", description: `${processedStudents.length}명의 학생 정보가 추가/업데이트되었습니다.` });
    
                } catch (error) {
                    console.error(error);
                    dismiss();
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
        const { name, grade, class: studentClass, gender, morningDestinationId, afternoonDestinationId, afterSchoolDestinations } = newStudentForm;
        if (!name || !grade || !studentClass || !gender) {
            toast({ title: "오류", description: "목적지를 제외한 모든 필드를 입력해주세요.", variant: "destructive" });
            return;
        }
        try {
            const newStudentData: NewStudent = { 
                name, 
                grade, 
                class: studentClass, 
                gender, 
                morningDestinationId: morningDestinationId || null, 
                afternoonDestinationId: afternoonDestinationId || null,
                afterSchoolDestinations: afterSchoolDestinations || {},
                applicationStatus: 'pending'
            };
            const newStudent = await addStudent(newStudentData);

            setStudents(prev => {
                const studentExists = prev.some(s => s.id === newStudent.id);
                if (studentExists) {
                    return prev.map(s => s.id === newStudent.id ? newStudent : s);
                }
                return [...prev, newStudent].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            });
            
            let hasDestinationForThisRoute = false;
            if (selectedRouteType === 'Morning') {
                hasDestinationForThisRoute = !!newStudent.morningDestinationId;
            } else if (selectedRouteType === 'Afternoon') {
                hasDestinationForThisRoute = !!newStudent.afternoonDestinationId;
            } else if (selectedRouteType === 'AfterSchool') {
                hasDestinationForThisRoute = newStudent.afterSchoolDestinations ? !!newStudent.afterSchoolDestinations[selectedDay] : false;
            }

            if (hasDestinationForThisRoute) {
                setFilteredUnassignedStudents(prev => [...prev, newStudent].sort((a,b) => a.name.localeCompare(b.name, 'ko')));
            }

            setNewStudentForm({ name: '', grade: '', class: '', gender: 'Male', morningDestinationId: null, afternoonDestinationId: null, afterSchoolDestinations: {} });
            toast({ title: "성공", description: "학생 정보가 추가/업데이트되었습니다." });
        } catch (error) {
            toast({ title: "오류", description: "학생 추가/업데이트 실패", variant: "destructive" });
        }
    };

    const handleDestinationChange = useCallback(async (studentId: string, newDestinationId: string | null, type: 'morning' | 'afternoon' | 'afterSchool', day?: DayOfWeek) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        let updateData: Partial<Student> = { applicationStatus: 'pending' };
        if (type === 'morning') {
             updateData.morningDestinationId = newDestinationId;
        } else if (type === 'afternoon') {
             updateData.afternoonDestinationId = newDestinationId;
        } else if (type === 'afterSchool' && day) {
             const newAfterSchoolDests = { ...(student.afterSchoolDestinations || {}), [day]: newDestinationId };
             updateData.afterSchoolDestinations = newAfterSchoolDests;
        }
        
        try {
            await updateStudent(studentId, updateData);
            
            const updatedStudent = { ...student, ...updateData };
            setStudents(prevStudents => prevStudents.map(s => s.id === studentId ? updatedStudent : s));
            if (selectedGlobalStudent?.id === studentId) {
                setSelectedGlobalStudent(updatedStudent);
            }
            
            await unassignStudentFromAllRoutes(studentId); // This will trigger onSnapshot for routes
            
            toast({ title: "성공", description: "학생의 목적지가 업데이트되었습니다. 모든 노선에서 좌석 배정이 해제되었습니다." });
        } catch (error) {
            toast({ title: "오류", description: "목적지 업데이트 실패", variant: "destructive" });
            const freshStudents = await getStudents();
            setStudents(freshStudents);
        }
    }, [students, setStudents, selectedGlobalStudent, toast]);
    
    const handleUnassignAllFromStudent = useCallback(async () => {
        if (!selectedGlobalStudent) return;
        try {
            await unassignStudentFromAllRoutes(selectedGlobalStudent.id);
            toast({ title: "성공", description: `${selectedGlobalStudent.name} 학생이 모든 노선에서 배정 해제되었습니다.`});
        } catch (error) {
             toast({ title: "오류", description: "전체 배정 해제 중 오류 발생", variant: 'destructive'});
        }
    }, [selectedGlobalStudent, toast]);

    const getUnassignableReason = (student: Student) => {
        const allValidStopIds = new Set<string>();
        routes.forEach(r => r.stops.forEach(stopId => allValidStopIds.add(stopId)));
        
        const errors: string[] = [];
        if (student.morningDestinationId && !allValidStopIds.has(student.morningDestinationId)) {
            errors.push('등교');
        }
        if (student.afternoonDestinationId && !allValidStopIds.has(student.afternoonDestinationId)) {
            errors.push('하교');
        }
        if (student.afterSchoolDestinations) {
            const errorDays = Object.keys(student.afterSchoolDestinations).filter(day => {
                const destId = student.afterSchoolDestinations[day as DayOfWeek];
                return destId && !allValidStopIds.has(destId);
            });
            if (errorDays.length > 0) {
                 errors.push(`방과후 (${errorDays.map(d => dayLabels[d as DayOfWeek].charAt(0)).join(',')})`);
            }
        }
        return errors.join(', ');
    }

     // --- Global Student Search ---
    useEffect(() => {
        if (!globalSearchQuery) {
            setGlobalSearchResults([]);
            return;
        }
        const lowerCaseQuery = globalSearchQuery.toLowerCase();
        const results = students.filter(s => s.name.toLowerCase().includes(lowerCaseQuery));
        setGlobalSearchResults(results);
    }, [globalSearchQuery, students]);

    const handleGlobalStudentClick = (student: Student) => {
        setSelectedGlobalStudent(student);
        setGlobalSearchQuery('');
        setGlobalSearchResults([]);
    };


    if (!selectedBusId) {
       return (
            <div className="space-y-6">
                <div className="p-4 text-center text-muted-foreground">버스를 선택하여 학생을 관리하세요.</div>
            </div>
       );
    }
    
     if (!currentRoute) {
        return (
            <div className="space-y-6">
                <div className="p-4 text-center text-muted-foreground">선택된 조건에 해당하는 노선 정보를 찾을 수 없습니다.</div>
            </div>
        );
    }

    return (
        <div className="space-y-6" onContextMenu={handleSeatContextMenu}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader className="flex-row items-center justify-between">
                            <div>
                               <CardTitle className="font-headline">좌석표</CardTitle>
                               <CardDescription>
                                {selectedSeat?.studentId ? "교체할 다른 좌석을 선택하거나, 같은 좌석을 다시 클릭하여 배정 해제하세요." : "좌석을 클릭하여 학생을 배정하거나 교체하세요. 우클릭으로 선택을 취소할 수 있습니다."}
                               </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                {(selectedRouteType === 'Morning' || selectedRouteType === 'Afternoon') && (
                                    <Dialog open={isCopySeatingDialogOpen} onOpenChange={setCopySeatingDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline"><Copy className="mr-2" /> 좌석 복사</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>좌석 배치 복사</DialogTitle>
                                                <CardDescription>현재 좌석 배치를 선택한 요일의 등교 또는 하교 노선에 복사합니다.</CardDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div>
                                                    <Label>복사할 요일 선택</Label>
                                                    <div className="flex items-center space-x-2 mt-2">
                                                        <Checkbox
                                                            id="copy-all-days"
                                                            checked={weekdays.every(day => daysToCopyTo[day])}
                                                            onCheckedChange={(checked) => handleToggleAllCopyToDays(checked as boolean)}
                                                        />
                                                        <Label htmlFor="copy-all-days">모두 선택</Label>
                                                    </div>
                                                    <div className="grid grid-cols-5 gap-2 mt-2">
                                                        {weekdays.map(day => (
                                                            <div key={day} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`copy-day-${day}`}
                                                                    checked={!!daysToCopyTo[day]}
                                                                    onCheckedChange={(checked) => setDaysToCopyTo(prev => ({ ...prev, [day]: checked }))}
                                                                />
                                                                <Label htmlFor={`copy-day-${day}`}>{dayLabels[day].charAt(0)}</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label>복사할 경로 유형</Label>
                                                    <div className="flex items-center space-x-4 mt-2">
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id="copy-type-morning"
                                                                checked={!!routeTypesToCopyTo.Morning}
                                                                onCheckedChange={(checked) => setRouteTypesToCopyTo(prev => ({ ...prev, Morning: checked as boolean }))}
                                                            />
                                                            <Label htmlFor="copy-type-morning">등교</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id="copy-type-afternoon"
                                                                checked={!!routeTypesToCopyTo.Afternoon}
                                                                onCheckedChange={(checked) => setRouteTypesToCopyTo(prev => ({ ...prev, Afternoon: checked as boolean }))}
                                                            />
                                                            <Label htmlFor="copy-type-afternoon">하교</Label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleCopySeating} className="w-full">복사</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
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
                                                <Label htmlFor="destination" className="text-right">등교 목적지</Label>
                                                <Select value={newStudentForm.morningDestinationId || ''} onValueChange={(v) => setNewStudentForm(p => ({...p, morningDestinationId: v}))}>
                                                    <SelectTrigger className="col-span-3">
                                                        <SelectValue placeholder="목적지 선택" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="destination" className="text-right">하교 목적지</Label>
                                                <Select value={newStudentForm.afternoonDestinationId || ''} onValueChange={(v) => setNewStudentForm(p => ({...p, afternoonDestinationId: v}))}>
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
                                    onSeatClick={handleSeatClick}
                                    highlightedSeatNumber={selectedSeat?.seatNumber}
                                    highlightedStudentId={selectedGlobalStudent?.id}
                                    routeType={selectedRouteType}
                                    dayOfWeek={selectedDay}
                                />
                           )}
                        </CardContent>
                    </Card>
                     {unassignableStudents.length > 0 && (
                        <Alert variant="destructive" className="bg-orange-100 dark:bg-orange-900/30 border-orange-400 dark:border-orange-700 text-orange-800 dark:text-orange-200">
                             <Bell className="h-4 w-4 !text-orange-600 dark:!text-orange-400" />
                            <AlertTitle className="text-orange-900 dark:text-orange-100">목적지 오류로 배정 불가</AlertTitle>
                            <AlertDescription className="space-y-2">
                                <p>아래 학생들은 설정된 목적지가 현재 어떤 버스 노선에도 포함되어 있지 않아 배정할 수 없습니다. 목적지를 수정해주세요.</p>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {unassignableStudents.map(student => (
                                        <div key={student.id} className="p-2 border border-orange-300 dark:border-orange-600 rounded-md bg-white dark:bg-orange-900/50">
                                            <div className="font-semibold">{student.name} ({student.grade} {student.class})</div>
                                            <div className="text-xs">오류 목적지: {getUnassignableReason(student)}</div>
                                            
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {student.morningDestinationId && <Select value={student.morningDestinationId} onValueChange={(v) => handleDestinationChange(student.id, v, 'morning')}>
                                                    <SelectTrigger><SelectValue placeholder="등교 목적지" /></SelectTrigger>
                                                    <SelectContent>{destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                                </Select>}
                                                {student.afternoonDestinationId && <Select value={student.afternoonDestinationId} onValueChange={(v) => handleDestinationChange(student.id, v, 'afternoon')}>
                                                    <SelectTrigger><SelectValue placeholder="하교 목적지" /></SelectTrigger>
                                                    <SelectContent>{destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                                </Select>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
                <div className="lg:col-span-1 space-y-4 sticky top-20 h-fit">
                     <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">미배정 학생 ({selectedRouteType === 'Morning' ? '등교' : selectedRouteType === 'Afternoon' ? '하교' : `(${dayLabels[selectedDay]}) 방과후`})</CardTitle>
                            <CardDescription>
                                {selectedSeat && !selectedSeat.studentId ? "학생을 클릭하여 선택된 빈 좌석에 배정하세요." : "먼저 빈 좌석을 선택한 후 학생을 클릭하여 배정하세요."}
                            </CardDescription>
                        </CardHeader>
                        <Separator />
                         <CardContent className='pt-4 max-h-[40vh] overflow-y-auto'>
                            <div className="relative mb-4">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="학생 이름 또는 목적지 검색..."
                                    className="pl-8 w-full"
                                    value={unassignedSearchQuery}
                                    onChange={(e) => setUnassignedSearchQuery(e.target.value)}
                                />
                            </div>
                             <div className="flex justify-end mb-2 gap-2 flex-wrap">
                                 <Button size="sm" variant="outline" onClick={handleDownloadStudentTemplate}><Download className="mr-2 h-4 w-4" /> 템플릿</Button>
                                 <Button size="sm" variant="outline" onClick={handleDownloadUnassignedStudents}><Download className="mr-2 h-4 w-4" /> 목록 다운로드</Button>
                                 <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> 일괄 등록/수정</Button>
                                 <input type="file" ref={fileInputRef} onChange={handleStudentFileUpload} accept=".csv" className="hidden" />
                                 <Button size="sm" variant="outline" onClick={handleToggleSelectAll}>
                                    {selectedStudentIds.size === filteredUnassignedStudents.length && filteredUnassignedStudents.length > 0 ? '선택 해제' : '모두 선택'}
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
                            <div className="min-h-[200px]">
                                {filteredUnassignedStudents.map((student) => (
                                    <StudentCard 
                                        key={student.id}
                                        student={student} 
                                        destinations={destinations}
                                        isChecked={selectedStudentIds.has(student.id)}
                                        onCheckedChange={(isChecked) => handleToggleStudentSelection(student.id, isChecked)}
                                        onClick={() => handleStudentCardClick(student.id)}
                                        routeType={selectedRouteType}
                                        dayOfWeek={selectedDay}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">전체 학생 검색</CardTitle>
                            <CardDescription>
                                학생을 검색하여 정보를 수정하거나 배정된 좌석을 확인하세요.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative mb-4">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="학생 이름 검색..."
                                    className="pl-8 w-full"
                                    value={globalSearchQuery}
                                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                                />
                                {globalSearchResults.length > 0 && (
                                    <Card className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto">
                                        <CardContent className="p-2">
                                            {globalSearchResults.map(student => (
                                                <div key={student.id} 
                                                    className="p-2 text-sm hover:bg-accent rounded-md cursor-pointer"
                                                    onClick={() => handleGlobalStudentClick(student)}>
                                                    {student.name} ({student.grade} {student.class})
                                                </div>
                                            ))}
                                        </CardContent>
                                    </Card>
                                )}
                            </div>
                            {selectedGlobalStudent && (
                                <div className="space-y-4 p-4 border rounded-md">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-semibold">{selectedGlobalStudent.name} ({selectedGlobalStudent.grade} {selectedGlobalStudent.class})</h4>
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                     <Button variant="link" size="sm" className="p-0 h-auto text-destructive">
                                                        <UserX className="mr-1"/>모두 배정 해제
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>모든 노선에서 배정 해제하시겠습니까?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {selectedGlobalStudent.name} 학생이 배정된 모든 노선의 좌석에서 해제됩니다. 이 작업은 되돌릴 수 없습니다.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>취소</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleUnassignAllFromStudent}>배정 해제</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setSelectedGlobalStudent(null)}>닫기</Button>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>등교 목적지</Label>
                                        <Select 
                                            value={selectedGlobalStudent.morningDestinationId || ''} 
                                            onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'morning')}
                                        >
                                            <SelectTrigger><SelectValue placeholder="목적지 선택" /></SelectTrigger>
                                            <SelectContent>{destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>하교 목적지</Label>
                                        <Select 
                                            value={selectedGlobalStudent.afternoonDestinationId || ''} 
                                            onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'afternoon')}
                                        >
                                            <SelectTrigger><SelectValue placeholder="목적지 선택" /></SelectTrigger>
                                            <SelectContent>{destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </div>
                                     <div>
                                        <Label>배정된 노선</Label>
                                        <div className="space-y-2 mt-1 border rounded-md p-2 max-h-40 overflow-y-auto">
                                            {assignedRoutesForSelectedStudent.length > 0 ? (
                                                assignedRoutesForSelectedStudent.map(route => {
                                                    const busName = buses.find(b => b.id === route.busId)?.name || '알 수 없는 버스';
                                                    const routeTypeName = route.type === 'Morning' ? '등교' : route.type === 'Afternoon' ? '하교' : '방과후';
                                                    return (
                                                        <div key={route.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                                            <p className="text-sm">{busName} - {dayLabels[route.dayOfWeek]} {routeTypeName}</p>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleUnassignStudentFromRoute(route.id, selectedGlobalStudent.id)}>
                                                                <UserX className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )
                                                })
                                            ) : (
                                                <p className="text-sm text-muted-foreground p-2">배정된 노선이 없습니다.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

const TeacherManagementTab = ({ teachers, setTeachers }: { teachers: Teacher[], setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>> }) => {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDownloadTeacherTemplate = () => {
        const headers = "선생님 이름";
        const example = "김선생";
        const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + headers + "\n" + example;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "teacher_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleTeacherFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const newTeachersData: NewTeacher[] = results.data.map((row: any) => ({
                    name: (row['선생님 이름'] || row['name'] || '').trim()
                })).filter(teacher => teacher.name);

                if (newTeachersData.length === 0) {
                    toast({ title: "오류", description: "파일에서 유효한 선생님 데이터를 찾을 수 없습니다. 헤더가 '선생님 이름'으로 되어있는지 확인하세요.", variant: "destructive" });
                    return;
                }

                const { dismiss } = toast({ title: "처리 중", description: "선생님 명단을 일괄 등록하고 있습니다..." });
                try {
                    const addedTeachers = await addTeachersInBatch(newTeachersData);
                    setTeachers(prev => [...prev, ...addedTeachers].sort((a,b) => a.name.localeCompare(b.name, 'ko')));
                    dismiss();
                    toast({ title: "성공", description: `${addedTeachers.length}명의 선생님이 일괄 등록되었습니다.` });
                } catch (error) {
                    dismiss();
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
                <CardTitle>선생님 목록</CardTitle>
                <CardDescription>CSV 파일로 선생님 명단을 일괄 등록합니다.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end gap-2 mb-4">
                    <Button variant="outline" onClick={handleDownloadTeacherTemplate}><Download className="mr-2" /> 템플릿</Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> 일괄 등록</Button>
                    <input type="file" ref={fileInputRef} onChange={handleTeacherFileUpload} accept=".csv" className="hidden" />
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>선생님 이름</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {teachers.map(teacher => (
                            <TableRow key={teacher.id}>
                                <TableCell>{teacher.name}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};


const AdminPageFilter: React.FC<{
    buses: Bus[];
    routes: Route[];
    destinations: Destination[];
    selectedBusId: string | null;
    setSelectedBusId: (id: string | null) => void;
    selectedDay: DayOfWeek;
    setSelectedDay: (day: DayOfWeek) => void;
    selectedRouteType: RouteType;
    setSelectedRouteType: (type: RouteType) => void;
    days: DayOfWeek[];
    dayLabels: { [key in DayOfWeek]: string };
}> = ({
    buses,
    routes,
    destinations,
    selectedBusId,
    setSelectedBusId,
    selectedDay,
    setSelectedDay,
    selectedRouteType,
    setSelectedRouteType,
    days,
    dayLabels,
}) => {
    const getBusLabel = (bus: Bus) => {
        const morningRoute = routes.find(r => r.busId === bus.id && r.dayOfWeek === 'Monday' && r.type === 'Morning');
        if (morningRoute && morningRoute.stops.length > 0) {
            const stopNames = morningRoute.stops.slice(0, 2).map(stopId => destinations.find(d => d.id === stopId)?.name).filter(Boolean);
            if (stopNames.length > 0) {
                return `${bus.name} - ${stopNames.join(', ')}...`;
            }
        }
        return bus.name;
    };
    return (
        <Card className="mb-6">
            <CardContent className="p-4">
                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label className="text-sm font-medium">버스</Label>
                    <Select value={selectedBusId || ''} onValueChange={setSelectedBusId}>
                      <SelectTrigger>
                        <SelectValue placeholder="버스를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {buses.map((bus) => (
                          <SelectItem key={bus.id} value={bus.id}>
                            {getBusLabel(bus)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">요일</Label>
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
                    <Label className="text-sm font-medium">경로</Label>
                    <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="Morning">등교</TabsTrigger>
                        <TabsTrigger value="Afternoon">하교</TabsTrigger>
                        <TabsTrigger value="AfterSchool">방과후</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
            </CardContent>
        </Card>
    );
};

const AdminPageContent: React.FC<{
    buses: Bus[];
    students: Student[];
    routes: Route[];
    destinations: Destination[];
    suggestedDestinations: Destination[];
    teachers: Teacher[];
    pendingStudents: Student[];
    setBuses: React.Dispatch<React.SetStateAction<Bus[]>>;
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
    setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
    setDestinations: React.Dispatch<React.SetStateAction<Destination[]>>;
    setSuggestedDestinations: React.Dispatch<React.SetStateAction<Destination[]>>;
    setTeachers: React.Dispatch<React.SetStateAction<Teacher[]>>;
    setPendingStudents: React.Dispatch<React.SetStateAction<Student[]>>;
}> = ({
    buses,
    students,
    routes,
    destinations,
    suggestedDestinations,
    teachers,
    pendingStudents,
    setBuses,
    setStudents,
    setRoutes,
    setDestinations,
    setSuggestedDestinations,
    setTeachers,
    setPendingStudents,
}) => {
    const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
    const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Monday');
    const [selectedRouteType, setSelectedRouteType] = useState<RouteType>('Morning');
    const [activeTab, setActiveTab] = useState('student-management');
    const { toast } = useToast();
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    useEffect(() => {
        if (buses.length > 0 && !selectedBusId) {
            setSelectedBusId(buses[0].id);
        }
    }, [buses, selectedBusId]);

    const handleAcknowledgeAll = async () => {
        const pendingStudentIds = pendingStudents.map(s => s.id);
        if (pendingStudentIds.length === 0) return;

        try {
            await updateStudentsInBatch(pendingStudentIds.map(id => ({ id, applicationStatus: 'reviewed' })));
            setStudents(prev => prev.map(s => pendingStudentIds.includes(s.id) ? { ...s, applicationStatus: 'reviewed' } : s));
            setPendingStudents([]);
            toast({ title: "성공", description: "모든 신청을 확인 완료로 변경했습니다." });
        } catch (error) {
            toast({ title: "오류", description: "처리 중 오류가 발생했습니다.", variant: "destructive" });
        }
    };
    
    return (
        <>
            {pendingStudents.length > 0 && (
                <Alert className="mb-6">
                    <Bell className="h-4 w-4" />
                    <AlertTitle>신규/변경 신청 도착</AlertTitle>
                    <AlertDescription className="flex justify-between items-center">
                        {pendingStudents.length}건의 신규 또는 변경된 탑승 신청이 있습니다.
                         <Button onClick={handleAcknowledgeAll}>
                            <Check className="mr-2" /> 모두 확인 완료로 변경
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="student-management">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="bus-registration">버스 등록</TabsTrigger>
                    <TabsTrigger value="teacher-management">선생님 관리</TabsTrigger>
                    <TabsTrigger value="bus-configuration">버스 설정</TabsTrigger>
                    <TabsTrigger value="student-management">탑승 학생 관리</TabsTrigger>
                </TabsList>
                <TabsContent value="bus-registration" className="mt-6">
                    <BusRegistrationTab buses={buses} routes={routes} teachers={teachers} setBuses={setBuses} />
                </TabsContent>
                 <TabsContent value="teacher-management" className="mt-6">
                    <TeacherManagementTab teachers={teachers} setTeachers={setTeachers} />
                </TabsContent>
                <TabsContent value="bus-configuration" className="mt-6">
                     <AdminPageFilter
                        buses={buses}
                        routes={routes}
                        destinations={destinations}
                        selectedBusId={selectedBusId}
                        setSelectedBusId={setSelectedBusId}
                        selectedDay={selectedDay}
                        setSelectedDay={setSelectedDay}
                        selectedRouteType={selectedRouteType}
                        setSelectedRouteType={setSelectedRouteType}
                        days={days}
                        dayLabels={dayLabels}
                    />
                    <BusConfigurationTab
                        buses={buses}
                        routes={routes}
                        setRoutes={setRoutes}
                        destinations={destinations}
                        setDestinations={setDestinations}
                        suggestedDestinations={suggestedDestinations}
                        setSuggestedDestinations={setSuggestedDestinations}
                        teachers={teachers}
                        selectedDay={selectedDay}
                        selectedRouteType={selectedRouteType}
                        selectedBusId={selectedBusId}
                    />
                </TabsContent>
                <TabsContent value="student-management" className="mt-6">
                    <AdminPageFilter
                        buses={buses}
                        routes={routes}
                        destinations={destinations}
                        selectedBusId={selectedBusId}
                        setSelectedBusId={setSelectedBusId}
                        selectedDay={selectedDay}
                        setSelectedDay={setSelectedDay}
                        selectedRouteType={selectedRouteType}
                        setSelectedRouteType={setSelectedRouteType}
                        days={days}
                        dayLabels={dayLabels}
                    />
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
                        setSelectedBusId={setSelectedBusId}
                        setSelectedDay={setSelectedDay}
                        setSelectedRouteType={setSelectedRouteType}
                    />
                </TabsContent>
            </Tabs>
        </>
    );
};


export default function AdminPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [buses, setBuses] = useState<Bus[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [routes, setRoutes] = useState<Route[]>([]);
    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [suggestedDestinations, setSuggestedDestinations] = useState<Destination[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [pendingStudents, setPendingStudents] = useState<Student[]>([]);
    const { toast } = useToast();
    
    useEffect(() => {
        if (!authLoading && !user) {
          router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user) { // Only fetch data if user is authenticated
            const fetchAndSubscribe = async () => {
                setDataLoading(true);
                try {
                    const [busesData, studentsData, destinationsData, suggestionsData, teachersData] = await Promise.all([
                        getBuses(),
                        getStudents(),
                        getDestinations(),
                        getSuggestedDestinations(),
                        getTeachers(),
                    ]);

                    const sortedBuses = sortBuses(busesData);
                    setBuses(sortedBuses);
                    setStudents(studentsData);
                    setDestinations(sortDestinations(destinationsData));
                    setSuggestedDestinations(suggestionsData);
                    setTeachers(teachersData.sort((a, b) => a.name.localeCompare(b.name, 'ko')));
                    setPendingStudents(studentsData.filter(s => s.applicationStatus === 'pending'));

                    const unsubscribeRoutes = onRoutesUpdate((routesData) => {
                        setRoutes(routesData);
                        setDataLoading(false); // Set loading to false only after first batch of routes is loaded
                    });

                    return () => {
                        unsubscribeRoutes();
                    };
                } catch (error) {
                    console.error("Failed to fetch initial data:", error);
                    toast({ title: "오류", description: "초기 데이터 로딩 중 오류가 발생했습니다.", variant: "destructive" });
                    setDataLoading(false);
                }
            };

            const unsubscribePromise = fetchAndSubscribe();

            return () => {
                 unsubscribePromise.then(unsubscribe => unsubscribe && unsubscribe());
            };
        }
    }, [user, toast]);

    if (authLoading || dataLoading || !user) {
        return (
            <MainLayout>
                <div className="flex justify-center items-center h-64">
                    <p>데이터를 불러오는 중입니다...</p>
                </div>
            </MainLayout>
        );
    }


    return (
        <MainLayout>
            <AdminPageContent
                buses={buses}
                students={students}
                routes={routes}
                destinations={destinations}
                suggestedDestinations={suggestedDestinations}
                teachers={teachers}
                pendingStudents={pendingStudents}
                setBuses={setBuses}
                setStudents={setStudents}
                setRoutes={setRoutes}
                setDestinations={setDestinations}
                setSuggestedDestinations={setSuggestedDestinations}
                setTeachers={setTeachers}
                setPendingStudents={setPendingStudents}
            />
        </MainLayout>
    );
}









