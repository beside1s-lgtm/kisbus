

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
import { Shuffle, UserPlus, Upload, Trash2, PlusCircle, Download, X, RotateCcw, UserCog, Pencil, Search, Copy, Check, Bell, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, UserX, Armchair } from 'lucide-react';
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
import { useTranslation } from '@/hooks/use-translation';

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
    const { t } = useTranslation();
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
            toast({ title: t('error'), description: t('admin.bus_registration.add.validation_error'), variant: 'destructive' });
            return;
        }

        const capacityMap = { '15-seater': 15, '29-seater': 29, '45-seater': 45 };
        const newBusData: NewBus = { name: newBusName, type: newBusType, capacity: capacityMap[newBusType] };

        try {
            const newBus = await handleAddBus(newBusData);
            setBuses(prev => sortBuses([...prev, newBus]));
            toast({ title: t('success'), description: t('admin.bus_registration.add.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.bus_registration.add.error'), variant: 'destructive' });
        }
    };
    
    const handleDeleteBus = async (busId: string) => {
        try {
            await deleteBus(busId);
            setBuses(prev => prev.filter(b => b.id !== busId));
            toast({ title: t('success'), description: t('admin.bus_registration.delete.success')});
        } catch (error) {
            console.error("Error deleting bus:", error);
            toast({ title: t('error'), description: t('admin.bus_registration.delete.error'), variant: 'destructive' });
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
                    toast({ title: t('error'), description: t('admin.bus_registration.batch.validation_error'), variant: "destructive" });
                    return;
                }
                const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_registration.batch.processing') });
                try {
                    const addedBuses = await Promise.all(newBusesData.map(busData => handleAddBus(busData)));
                    setBuses(prev => sortBuses([...prev, ...addedBuses]));
                    dismiss();
                    toast({ title: t('success'), description: t('admin.bus_registration.batch.success', { count: addedBuses.length }) });
                } catch (error) {
                    dismiss();
                    toast({ title: t('error'), description: t('admin.bus_registration.batch.error'), variant: "destructive" });
                }
            },
            error: (error) => {
                toast({ title: t('admin.file_parse_error'), description: error.message, variant: "destructive" });
            }
        });
        
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
    const getTeachersForBus = (busId: string) => {
        const relevantRouteType = teacherViewType === 'MorningAndAfternoon' ? 'Morning' : 'AfterSchool';
        const relevantRoute = routes.find(r => r.busId === busId && r.dayOfWeek === 'Monday' && r.type === relevantRouteType);
        if (!relevantRoute || !relevantRoute.teacherIds) return t('unassigned');

        const teacherNames = relevantRoute.teacherIds
            .map(id => teachers.find(t => t.id === id)?.name)
            .filter(Boolean);

        return teacherNames.length > 0 ? teacherNames.join(', ') : t('unassigned');
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin.bus_registration.title')}</CardTitle>
                <CardDescription>{t('admin.bus_registration.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-center mb-4">
                    <Tabs value={teacherViewType} onValueChange={(v) => setTeacherViewType(v as any)} className="w-auto">
                      <TabsList className="grid grid-cols-2">
                        <TabsTrigger value="MorningAndAfternoon">{t('route_type.commute')}</TabsTrigger>
                        <TabsTrigger value="AfterSchool">{t('route_type.AfterSchool')}</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleDownloadBusTemplate}><Download className="mr-2" /> {t('template')}</Button>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> {t('batch_upload')}</Button>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button><PlusCircle className="mr-2" /> {t('admin.bus_registration.add_new_bus')}</Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>{t('admin.bus_registration.add_new_bus')}</DialogTitle></DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="bus-name" className="text-right">{t('admin.bus_registration.bus_number')}</Label>
                                        <Input id="bus-name" placeholder={t('admin.bus_registration.bus_number_placeholder')} className="col-span-3" value={newBusName} onChange={e => setNewBusName(e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="bus-type" className="text-right">{t('type')}</Label>
                                        <Select onValueChange={(v) => setNewBusType(v as any)} value={newBusType}>
                                            <SelectTrigger className="col-span-3">
                                                <SelectValue placeholder={t('admin.bus_registration.select_type')} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="15-seater">{t('bus_type.15')}</SelectItem>
                                                <SelectItem value="29-seater">{t('bus_type.29')}</SelectItem>
                                                <SelectItem value="45-seater">{t('bus_type.45')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <Button onClick={handleManualAddBus}>{t('add')}</Button>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('admin.bus_registration.bus_number')}</TableHead>
                            <TableHead>{t('type')}</TableHead>
                            <TableHead>{t('admin.teacher_assignment.title')}</TableHead>
                            <TableHead className="text-right">{t('actions')}</TableHead>
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
                                                <AlertDialogTitle>{t('admin.bus_registration.delete.confirm_title')}</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {t('admin.bus_registration.delete.confirm_description')}
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteBus(bus.id)}>{t('delete')}</AlertDialogAction>
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
    const { t } = useTranslation();

    useEffect(() => {
        if (currentRoute) {
            setSelectedTeacherIds(currentRoute.teacherIds || []);
        }
    }, [currentRoute]);
    
    const assignedToOtherRoutesIds = useMemo(() => {
        if (!currentRoute) return new Set<string>();
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
            toast({ title: t('success'), description: t('admin.teacher_assignment.change.success') });
            onOpenChange(false);
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_assignment.change.error'), variant: "destructive" });
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
                <DialogTitle>{t('admin.teacher_assignment.change.title')}</DialogTitle>
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
                                {isDisabled && <span className="text-xs ml-2">{t('admin.teacher_assignment.change.assigned_other')}</span>}
                            </Label>
                        </div>
                    );
                })}
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>{t('cancel')}</Button>
                <Button onClick={handleSave}>{t('save')}</Button>
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
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);

  const [selectedRouteStopId, setSelectedRouteStopId] = useState<string | null>(null);
  const [selectedAllDestId, setSelectedAllDestId] = useState<string | null>(null);
  
  const [isCopyRouteDialogOpen, setCopyRouteDialogOpen] = useState(false);
  const allDays: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);
  const [daysToCopyRouteTo, setDaysToCopyRouteTo] = useState<Partial<Record<DayOfWeek, boolean>>>(
      () => allDays.reduce((acc, day) => ({ ...acc, [day]: true }), {})
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
            toast({ title: t('notice'), description: t('admin.bus_config.dest.add.already_exists'), variant: 'default' });
            return;
        }

        try {
            const newDest = await addDestination({ name: trimmedName });
            setDestinations(prev => sortDestinations([...prev, newDest]));
            setNewDestinationName('');
            toast({ title: t('success'), description: t('admin.bus_config.dest.add.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.bus_config.dest.add.error'), variant: 'destructive' });
        }
    };
    
    const handleDeleteDestination = async (id: string) => {
        try {
            await deleteDestination(id);
            setDestinations(prev => prev.filter(d => d.id !== id));
            toast({ title: t('success'), description: t('admin.bus_config.dest.delete.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.bus_config.dest.delete.error'), variant: 'destructive' });
        }
    };
    
    const handleClearAllDestinations = async () => {
        const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_config.dest.delete_all.processing') });
        try {
            await deleteAllDestinations();
            setDestinations([]);
            dismiss();
            toast({ title: t('success'), description: t('admin.bus_config.dest.delete_all.success') });
        } catch (error) {
            dismiss();
            toast({ title: t('error'), description: t('admin.bus_config.dest.delete_all.error'), variant: "destructive" });
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
  
  const handleDownloadDestinationList = useCallback(() => {
        if (destinations.length === 0) {
            toast({ title: t('notice'), description: t('admin.bus_config.dest.download.no_data') });
            return;
        }
        const headers = "목적지 이름";
        const csvData = destinations.map(d => d.name).join('\n');
        const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + headers + "\n" + csvData;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `destination_list.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [destinations, toast, t]);

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
                toast({ title: t('notice'), description: t('admin.bus_config.dest.batch.no_new'), variant: "default" });
                return;
            }
            const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_config.dest.batch.processing') });
            try {
                const addedDests = await addDestinationsInBatch(newDestinationsData);
                setDestinations(prev => sortDestinations([...prev, ...addedDests]));
                dismiss();
                toast({ title: t('success'), description: t('admin.bus_config.dest.batch.success', {count: addedDests.length}) });
            } catch (error) {
                dismiss();
                toast({ title: t('error'), description: t('admin.bus_config.dest.batch.error'), variant: "destructive" });
            }
        },
        error: (error) => {
            toast({ title: t('admin.file_parse_error'), description: error.message, variant: "destructive" });
        }
    });

    if (fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };
  
  const handleApproveSuggestion = async (suggestion: Destination) => {
    const trimmedName = suggestion.name.trim();
    if (destinations.some(d => d.name.toLowerCase() === trimmedName.toLowerCase())) {
        toast({ title: t('notice'), description: t('admin.bus_config.suggestions.already_exists') });
        try {
            await deleteDoc(doc(db, 'suggestedDestinations', suggestion.id));
            setSuggestedDestinations(prev => prev.filter(s => s.id !== suggestion.id));
        } catch (error) {
             toast({ title: t('error'), description: t('admin.bus_config.suggestions.delete_error'), variant: 'destructive'});
        }
        return;
    }
      
    try {
        await approveSuggestedDestination(suggestion);
        setSuggestedDestinations(prev => prev.filter(s => s.id !== suggestion.id));
        const newDests = await getDestinations(); // Re-fetch all destinations
        setDestinations(sortDestinations(newDests));
        toast({ title: t('success'), description: t('admin.bus_config.suggestions.approve_success')});
    } catch (error) {
        toast({ title: t('error'), description: t('admin.bus_config.suggestions.approve_error'), variant: 'destructive'});
    }
  };

  const handleClearAllSuggestions = async () => {
    const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_config.suggestions.delete_all.processing') });
    try {
        await clearAllSuggestedDestinations();
        setSuggestedDestinations([]);
        dismiss();
        toast({ title: t('success'), description: t('admin.bus_config.suggestions.delete_all.success') });
    } catch (error) {
        dismiss();
        toast({ title: t('error'), description: t('admin.bus_config.suggestions.delete_all.error'), variant: "destructive" });
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
          return;
      }
      await updateRouteStops(currentRoute.id, newStopIds);
  }, [currentRoute, selectedRouteStopId]);

    const handleAddStopToRoute = useCallback(async () => {
        if (!currentRoute || !selectedAllDestId) return;
        const currentStopIds = currentRoute.stops || [];
        if (currentStopIds.includes(selectedAllDestId)) {
            toast({ title: t('error'), description: t('admin.bus_config.route.add_stop_error'), variant: 'destructive' });
            return;
        }
        const newStopIds = [...currentStopIds, selectedAllDestId];
        await updateRouteStops(currentRoute.id, newStopIds);
        setSelectedAllDestId(null);
    }, [currentRoute, selectedAllDestId, toast, t]);

    const handleRemoveStopFromRoute = useCallback(async () => {
        if (!currentRoute || !selectedRouteStopId) return;
        const currentStopIds = currentRoute.stops || [];
        const newStopIds = currentStopIds.filter(id => id !== selectedRouteStopId);
        await updateRouteStops(currentRoute.id, newStopIds);
        setSelectedRouteStopId(null);
    }, [currentRoute, selectedRouteStopId]);


  const assignRandomTeachers = useCallback(async () => {
    if (!selectedBus || !currentRoute) {
        toast({ title: t('error'), description: t('admin.teacher_assignment.assign.no_route_error'), variant: "destructive" });
        return;
    }
    if (teachers.length === 0) {
        toast({ title: t('error'), description: t('admin.teacher_assignment.assign.no_teacher_error'), variant: "destructive" });
        return;
    }

    let numToAssign = 1;
    if (selectedBus.type === '45-seater') {
        numToAssign = 2;
    }

    const isCommuteRoute = currentRoute.type === 'Morning' || currentRoute.type === 'Afternoon';
    const relevantRouteTypes = isCommuteRoute ? ['Morning', 'Afternoon'] : ['AfterSchool'];

    const availableTeachers = teachers.filter(teacher => {
        const isAssignedToOtherRoute = routes.some(route => 
            route.id !== currentRoute.id && 
            route.dayOfWeek === currentRoute.dayOfWeek &&
            relevantRouteTypes.includes(route.type) &&
            route.teacherIds?.includes(teacher.id)
        );
        return !isAssignedToOtherRoute;
    });

    if (availableTeachers.length < numToAssign) {
        toast({ title: t('notice'), description: t('admin.teacher_assignment.assign.not_enough_teachers', { count: availableTeachers.length }), variant: "default" });
        numToAssign = availableTeachers.length;
    }

    const shuffledTeachers = [...availableTeachers].sort(() => 0.5 - Math.random());
    const assignedTeacherIds = shuffledTeachers.slice(0, numToAssign).map(t => t.id);

    try {
        await updateRoute(currentRoute.id, { teacherIds: assignedTeacherIds });
        toast({ title: t('success'), description: t('admin.teacher_assignment.assign.success') });
    } catch (error) {
        console.error("Error assigning teachers:", error);
        toast({ title: t('error'), description: t('admin.teacher_assignment.assign.error'), variant: 'destructive' });
    }
  }, [selectedBus, currentRoute, teachers, routes, toast, t]);
  
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
        toast({ title: t('notice'), description: t('admin.teacher_assignment.reset.no_routes') });
        return;
    }

    try {
        const batch = writeBatch(db);
        routesToUpdate.forEach(route => {
            const routeRef = doc(db, 'routes', route.id);
            batch.update(routeRef, { teacherIds: [] });
        });
        await batch.commit();

        toast({ title: t('success'), description: t('admin.teacher_assignment.reset.success') });
    } catch (error) {
        console.error("Error resetting teachers:", error);
        toast({ title: t('error'), description: t('admin.teacher_assignment.reset.error'), variant: "destructive" });
    }
  }, [currentRoute, routes, toast, t]);
  
  const handleCopyToAllWeekdays = useCallback(async () => {
    if (!currentRoute) {
        toast({title: t('error'), description: t('admin.teacher_assignment.copy.no_route_error'), variant: 'destructive'});
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

        toast({title: t('success'), description: t('admin.teacher_assignment.copy.success')});
    } catch (error) {
        console.error("Error copying teachers:", error);
        toast({title: t('error'), description: t('admin.teacher_assignment.copy.error'), variant: 'destructive'});
    }
  }, [currentRoute, routes, toast, t]);
  
 const handleCopyRoute = useCallback(async () => {
      if (!currentRoute) {
          toast({ title: t('error'), description: t('admin.bus_config.route.copy.no_source_error'), variant: "destructive" });
          return;
      }

      const selectedDays = allDays.filter(day => daysToCopyRouteTo[day]);
      
      let targetRoutes: Route[] = [];

      if (currentRoute.type === 'Morning' || currentRoute.type === 'Afternoon') {
        const selectedRouteTypes = (['Morning', 'Afternoon'] as const).filter(type => routeTypesToCopyRouteTo[type]);
        if (selectedDays.length === 0 || selectedRouteTypes.length === 0) {
            toast({ title: t('notice'), description: t('admin.bus_config.route.copy.no_selection_commute') });
            return;
        }
        targetRoutes = routes.filter(r =>
            r.busId === currentRoute.busId &&
            selectedDays.includes(r.dayOfWeek) &&
            selectedRouteTypes.includes(r.type as 'Morning' | 'Afternoon') &&
            r.id !== currentRoute.id
        );
      } else { // AfterSchool
        if (selectedDays.length === 0) {
            toast({ title: t('notice'), description: t('admin.bus_config.route.copy.no_selection_after_school') });
            return;
        }
        targetRoutes = routes.filter(r =>
            r.busId === currentRoute.busId &&
            selectedDays.includes(r.dayOfWeek) &&
            r.type === 'AfterSchool' &&
            r.id !== currentRoute.id
        );
      }

      if (targetRoutes.length === 0) {
          toast({ title: t('notice'), description: t('admin.bus_config.route.copy.no_target_routes') });
          return;
      }
      
      try {
          await copyRoutePlan(currentRoute.stops, targetRoutes);
          toast({ title: t('success'), description: t('admin.bus_config.route.copy.success') });
          setCopyRouteDialogOpen(false);
      } catch (error) {
          console.error("Error copying route plan:", error);
          toast({ title: t('error'), description: t('admin.bus_config.route.copy.error'), variant: "destructive" });
      }
  }, [currentRoute, routes, toast, t, daysToCopyRouteTo, routeTypesToCopyRouteTo, allDays]);

  const handleToggleAllCopyToDays = (checked: boolean) => {
      const newDays = allDays.reduce((acc, day) => ({ ...acc, [day]: checked }), {});
      setDaysToCopyRouteTo(newDays);
  };


  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-start">
            <Card>
                <CardHeader>
                <CardTitle>{t('admin.bus_config.dest.title')}</CardTitle>
                <CardDescription>
                    {t('admin.bus_config.dest.description')}
                </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-end gap-2 mb-4 flex-wrap">
                        <Button variant="outline" onClick={handleDownloadDestinationTemplate}><Download className="mr-2" /> {t('template')}</Button>
                        <Button variant="outline" onClick={handleDownloadDestinationList}><Download className="mr-2" /> {t('admin.bus_config.dest.download.button')}</Button>
                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> {t('batch_upload')}</Button>
                        <input type="file" ref={fileInputRef} onChange={handleDestinationFileUpload} accept=".csv" className="hidden" />
                    </div>
                     <div className="flex justify-end gap-2 mb-4">
                        <Dialog>
                            <DialogTrigger asChild><Button className="w-full"><PlusCircle className="mr-2" /> {t('admin.bus_config.dest.add.button')}</Button></DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>{t('admin.bus_config.dest.add.title')}</DialogTitle></DialogHeader>
                                <Input placeholder={t('admin.bus_config.dest.add.placeholder')} value={newDestinationName} onChange={e => setNewDestinationName(e.target.value)} />
                                <Button className="mt-2" onClick={handleAddDestination}>{t('add')}</Button>
                            </DialogContent>
                        </Dialog>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" className="w-full"><Trash2 className="mr-2 h-4 w-4" /> {t('delete_all')}</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>{t('admin.bus_config.dest.delete_all.confirm_title')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('admin.bus_config.dest.delete_all.confirm_description')}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearAllDestinations}>{t('delete')}</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                    <div className="relative mb-4">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            type="search"
                            placeholder={t('admin.bus_config.dest.search_placeholder')}
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
                                            <AlertDialogTitle>{t('admin.bus_config.dest.delete.confirm_title')}</AlertDialogTitle>
                                            <AlertDialogDescription>{t('confirm_irreversible')}</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteDestination(dest.id)}>{t('delete')}</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <div className="flex flex-col items-center justify-center gap-4 self-stretch">
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
                        <CardTitle>{t('admin.bus_config.route.title')}</CardTitle>
                        <CardDescription>
                            {t('admin.bus_config.route.description')}
                        </CardDescription>
                    </div>
                     <Dialog open={isCopyRouteDialogOpen} onOpenChange={setCopyRouteDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" disabled={!currentRoute}>
                                <Copy className="mr-2" /> {t('admin.bus_config.route.copy.button')}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                             <DialogHeader>
                                <DialogTitle>{t('admin.bus_config.route.copy.title')}</DialogTitle>
                                <CardDescription>
                                    {selectedRouteType === 'AfterSchool'
                                        ? t('admin.bus_config.route.copy.description_after_school')
                                        : t('admin.bus_config.route.copy.description_commute')
                                    }
                                </CardDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div>
                                    <Label>{t('admin.bus_config.route.copy.select_days')}</Label>
                                    <div className="flex items-center space-x-2 mt-2">
                                        <Checkbox
                                            id="copy-route-all-days"
                                            checked={allDays.every(day => daysToCopyRouteTo[day])}
                                            onCheckedChange={(checked) => handleToggleAllCopyToDays(checked as boolean)}
                                        />
                                        <Label htmlFor="copy-route-all-days">{t('select_all')}</Label>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 mt-2">
                                        {allDays.map(day => (
                                            <div key={`route-day-${day}`} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`copy-route-day-${day}`}
                                                    checked={!!daysToCopyRouteTo[day]}
                                                    onCheckedChange={(checked) => setDaysToCopyRouteTo(prev => ({ ...prev, [day]: checked }))}
                                                />
                                                <Label htmlFor={`copy-route-day-${day}`}>{t(`day.${day.toLowerCase()}`)}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {(selectedRouteType === 'Morning' || selectedRouteType === 'Afternoon') && (
                                <div>
                                    <Label>{t('admin.bus_config.route.copy.select_route_types')}</Label>
                                    <div className="flex items-center space-x-4 mt-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="copy-route-type-morning"
                                                checked={!!routeTypesToCopyRouteTo.Morning}
                                                onCheckedChange={(checked) => setRouteTypesToCopyRouteTo(prev => ({ ...prev, Morning: checked as boolean }))}
                                            />
                                            <Label htmlFor="copy-route-type-morning">{t('route_type.morning')}</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="copy-route-type-afternoon"
                                                checked={!!routeTypesToCopyRouteTo.Afternoon}
                                                onCheckedChange={(checked) => setRouteTypesToCopyRouteTo(prev => ({ ...prev, Afternoon: checked as boolean }))}
                                            />
                                            <Label htmlFor="copy-route-type-afternoon">{t('route_type.afternoon')}</Label>
                                        </div>
                                    </div>
                                </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button onClick={handleCopyRoute} className="w-full">{t('copy')}</Button>
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
                                        <CardTitle>{selectedBus.name} - {t(`day.${selectedDay.toLowerCase()}`)} {t(`route_type.${selectedRouteType.toLowerCase()}`)}</CardTitle>
                                        <CardDescription>{t('admin.bus_config.route.stops_description')}</CardDescription>
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
                        <div className="text-center text-muted-foreground py-10">{t('admin.bus_config.route.select_bus_prompt')}</div>
                    )}
                </CardContent>
            </Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {suggestedDestinations.length > 0 && (
                    <Card>
                        <CardHeader>
                        <CardTitle>{t('admin.bus_config.suggestions.title')}</CardTitle>
                        <CardDescription>
                            {t('admin.bus_config.suggestions.description')}
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
                                        <Trash2 className="mr-2 h-4 w-4" /> {t('delete_all')}
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>{t('admin.bus_config.suggestions.delete_all.confirm_title')}</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        {t('admin.bus_config.suggestions.delete_all.confirm_description')}
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleClearAllSuggestions}>{t('delete')}</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </CardFooter>
                    </Card>
                )}

                {selectedBus && currentRoute && (
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('admin.teacher_assignment.title')}</CardTitle>
                            <CardDescription>{t('admin.teacher_assignment.description', { busName: selectedBus.name, day: t(`day.${selectedDay.toLowerCase()}`), routeType: t(`route_type.${selectedRouteType.toLowerCase()}`) })}</CardDescription>
                        </CardHeader>
                            <CardContent>
                            {assignedTeachers.length > 0 ? (
                                <div className="text-sm text-muted-foreground">
                                    <strong>{t('admin.teacher_assignment.assigned_teachers')}:</strong> {assignedTeachers.map(t => t.name).join(', ')}
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">{t('admin.teacher_assignment.no_teachers_assigned')}</div>
                            )}
                            {(selectedRouteType === 'Morning' || selectedRouteType === 'Afternoon') && (
                                    <Button variant="link" onClick={handleCopyToAllWeekdays} className="p-0 h-auto mt-2 text-sm">
                                    <Copy className="mr-2"/> {t('admin.teacher_assignment.copy.button')}
                                </Button>
                            )}
                        </CardContent>
                        <CardFooter className="grid grid-cols-3 gap-2">
                            <Button onClick={assignRandomTeachers}><UserCog className="mr-2"/>{t('admin.teacher_assignment.reassign')}</Button>
                            <Dialog open={isTeacherDialogOpen} onOpenChange={setIsTeacherDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="outline"><Pencil className="mr-2"/>{t('admin.teacher_assignment.manual_change')}</Button>
                                </DialogTrigger>
                                {currentRoute && <TeacherAssignmentDialog currentRoute={currentRoute} allRoutes={routes} teachers={teachers} setRoutes={setRoutes} onOpenChange={setIsTeacherDialogOpen} />}
                            </Dialog>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={!assignedTeachers || assignedTeachers.length === 0}><RotateCcw className="mr-2"/>{t('reset')}</Button>
                                </AlertDialogTrigger>
                                    <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>{t('admin.teacher_assignment.reset.confirm_title')}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            {t('admin.teacher_assignment.reset.confirm_description')}
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleResetTeachers}>{t('unassign')}</AlertDialogAction>
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
}: {
    students: Student[];
    setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
    buses: Bus[];
    routes: Route[];
    setRoutes: React.Dispatch<React.SetStateAction<Route[]>>;
    destinations: Destination[];
    selectedBusId: string | null;
    selectedDay: DayOfWeek;
    selectedRouteType: RouteType;
    days: DayOfWeek[];
    setSelectedBusId: (id: string | null) => void;
    setSelectedDay: (day: DayOfWeek) => void;
    setSelectedRouteType: (type: RouteType) => void;
}) => {
    const { toast } = useToast();
    const { t } = useTranslation();
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
    
    const [selectedSeat, setSelectedSeat] = useState<{ seatNumber: number; studentId: string | null } | null>(null);
    const [unassignableStudents, setUnassignableStudents] = useState<Student[]>([]);

    const [globalSearchQuery, setGlobalSearchQuery] = useState('');
    const [globalSearchResults, setGlobalSearchResults] = useState<Student[]>([]);
    const [selectedGlobalStudent, setSelectedGlobalStudent] = useState<Student | null>(null);
    
    const dayOrder: DayOfWeek[] = useMemo(() => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], []);

    const assignedRoutesForSelectedStudent = useMemo(() => {
        if (!selectedGlobalStudent) return [];
        return routes
            .filter(route => route.seating.some(seat => seat.studentId === selectedGlobalStudent.id))
            .sort((a, b) => {
                const busA = buses.find(bus => bus.id === a.busId);
                const busB = buses.find(bus => bus.id === b.busId);
                const numA = busA ? parseInt(busA.name.replace(/\D/g, ''), 10) : Infinity;
                const numB = busB ? parseInt(busB.name.replace(/\D/g, ''), 10) : Infinity;

                if (numA !== numB) {
                    return (!isNaN(numA) ? numA : Infinity) - (!isNaN(numB) ? numB : Infinity);
                }
                
                const dayIndexA = dayOrder.indexOf(a.dayOfWeek);
                const dayIndexB = dayOrder.indexOf(b.dayOfWeek);

                if (dayIndexA !== dayIndexB) {
                    return dayIndexA - dayIndexB;
                }

                return 0;
            });
    }, [selectedGlobalStudent, routes, buses, dayOrder]);



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
    
    const unassignProcessingRef = useRef(false);
    useEffect(() => {
        if (!routes.length || !students.length || unassignProcessingRef.current) {
            return;
        }

        const processUnassignment = async () => {
            unassignProcessingRef.current = true;
            
            const batch = writeBatch(db);
            let updatesMade = false;

            for (const day of days) {
                const afterSchoolStudentIds = new Set<string>();
                routes
                    .filter(r => r.dayOfWeek === day && r.type === 'AfterSchool')
                    .forEach(r => {
                        r.seating.forEach(seat => {
                            if (seat.studentId) {
                                afterSchoolStudentIds.add(seat.studentId);
                            }
                        });
                    });

                if (afterSchoolStudentIds.size > 0) {
                    const afternoonRoutes = routes.filter(r => r.dayOfWeek === day && r.type === 'Afternoon');
                    
                    for (const route of afternoonRoutes) {
                        let seatingChanged = false;
                        const newSeating = route.seating.map(seat => {
                            if (seat.studentId && afterSchoolStudentIds.has(seat.studentId)) {
                                seatingChanged = true;
                                return { ...seat, studentId: null };
                            }
                            return seat;
                        });

                        if (seatingChanged) {
                            const routeRef = doc(db, 'routes', route.id);
                            batch.update(routeRef, { seating: newSeating });
                            updatesMade = true;
                        }
                    }
                }
            }

            if (updatesMade) {
                try {
                    await batch.commit();
                } catch (error) {
                    console.error("Error unassigning students from afternoon routes:", error);
                    toast({title: t('error'), description: t('admin.student_management.auto_unassign_error'), variant: "destructive"});
                }
            }
            
            unassignProcessingRef.current = false;
        };

        processUnassignment();
        
    }, [routes, students, days, toast, t]);


    useEffect(() => {
        if (!currentRoute) {
            setFilteredUnassignedStudents([]);
            return;
        }

        if (selectedDay === 'Friday' && selectedRouteType === 'AfterSchool') {
            setFilteredUnassignedStudents([]);
            return;
        }

        const allAssignedStudentIdsThisType = new Set<string>();
        routes.forEach(route => {
            if (route.dayOfWeek === selectedDay && route.type === selectedRouteType) {
                route.seating.forEach(seat => {
                    if (seat.studentId) {
                        allAssignedStudentIdsThisType.add(seat.studentId);
                    }
                });
            }
        });
        
        const afterSchoolStudentIds = new Set<string>();
        if (selectedRouteType === 'Afternoon') {
             routes.forEach(route => {
                if (route.dayOfWeek === selectedDay && route.type === 'AfterSchool') {
                    route.seating.forEach(seat => {
                        if (seat.studentId) {
                            afterSchoolStudentIds.add(seat.studentId);
                        }
                    });
                }
            });
        }

        const unassigned = students.filter(student => {
            if (unassignableStudents.some(u => u.id === student.id)) return false;
            if (allAssignedStudentIdsThisType.has(student.id)) return false;
            
            if (selectedRouteType === 'Afternoon' && afterSchoolStudentIds.has(student.id)) {
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
            
            if (!destId) return false;

            if (!unassignedSearchQuery) return true;

            const lowerCaseQuery = unassignedSearchQuery.toLowerCase();
            const nameMatch = student.name.toLowerCase().includes(lowerCaseQuery);
            const destinationName = destinations.find(d => d.id === destId)?.name.toLowerCase() || '';
            const destMatch = destinationName.includes(lowerCaseQuery);

            return nameMatch || destMatch;
        });

        const sortedUnassigned = unassigned.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        setFilteredUnassignedStudents(sortedUnassigned);

    }, [students, routes, currentRoute, selectedRouteType, selectedDay, unassignedSearchQuery, destinations, unassignableStudents]);
    
    useEffect(() => {
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
            toast({ title: t('notice'), description: t('admin.student_management.unassigned.delete_validation') });
            return;
        }

        const { dismiss } = toast({ title: t('processing'), description: t('admin.student_management.unassigned.delete_processing') });
        try {
            const idsToDelete = Array.from(selectedStudentIds);
            await deleteStudentsInBatch(idsToDelete);

            setStudents(prev => prev.filter(s => !idsToDelete.includes(s.id)));
            
            setSelectedStudentIds(new Set());
            dismiss();
            toast({ title: t('success'), description: t('admin.student_management.unassigned.delete_success', { count: idsToDelete.length }) });
        } catch (error) {
            dismiss();
            console.error("Error deleting students:", error);
            toast({ title: t('error'), description: t('admin.student_management.unassigned.delete_error'), variant: "destructive" });
        }
    }, [selectedStudentIds, setStudents, toast, t]);

    const handleSeatUpdate = useCallback(async (newSeating: {seatNumber: number; studentId: string | null}[]) => {
        if (!currentRoute) return;
        
        try {
            await updateRouteSeating(currentRoute.id, newSeating);
        } catch (error) {
             toast({ title: t('error'), description: t('admin.student_management.seat.update_error'), variant: 'destructive'});
        }
    }, [currentRoute, toast, t]);
    
    const handleUnassignStudentFromRoute = useCallback(async (routeId: string, studentId: string) => {
        const routeToUpdate = routes.find(r => r.id === routeId);
        if (!routeToUpdate) return;
    
        const newSeating = routeToUpdate.seating.map(seat =>
            seat.studentId === studentId ? { ...seat, studentId: null } : seat
        );
    
        try {
            await updateRouteSeating(routeId, newSeating);
            toast({ title: t('success'), description: t('admin.student_management.search.unassign_success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.student_management.search.unassign_error'), variant: "destructive" });
        }
    }, [routes, toast, t]);


    const handleStudentCardClick = useCallback(async (studentId: string) => {
        if (!currentRoute) return;

        if (selectedSeat && !selectedSeat.studentId) {
            const isAlreadySeated = currentRoute.seating.some(s => s.studentId === studentId);
            if (isAlreadySeated) {
                toast({ title: t('notice'), description: t('admin.student_management.seat.already_seated_error')});
                return;
            }

            const newSeating = [...currentRoute.seating];
            const targetSeatIndex = newSeating.findIndex(s => s.seatNumber === selectedSeat.seatNumber);

            if (targetSeatIndex !== -1) {
                newSeating[targetSeatIndex].studentId = studentId;
                await handleSeatUpdate(newSeating);
                setSelectedSeat(null);
                toast({ title: t('success'), description: t('admin.student_management.seat.assign_success')});
            }
        } else {
             toast({ title: t('notice'), description: t('admin.student_management.seat.select_empty_seat_prompt')});
        }
    }, [selectedSeat, currentRoute, toast, handleSeatUpdate, t]);

    const handleUnassignedStudentClick = useCallback((student: Student) => {
        setSelectedGlobalStudent(student);
    }, []);

    const handleSeatClick = useCallback(async (seatNumber: number, studentId: string | null) => {
        if (!currentRoute) return;
    
        const newSeating = [...currentRoute.seating];
    
        if (selectedSeat) {
            if (selectedSeat.studentId) {
                const sourceSeatIndex = newSeating.findIndex(s => s.seatNumber === selectedSeat.seatNumber);
                const targetSeatIndex = newSeating.findIndex(s => s.seatNumber === seatNumber);

                if (sourceSeatIndex === -1 || targetSeatIndex === -1) return;
    
                if (selectedSeat.seatNumber === seatNumber) {
                    newSeating[sourceSeatIndex].studentId = null;
                    toast({ title: t('success'), description: t('admin.student_management.seat.unassign_success') });
                } else {
                    const sourceStudentId = newSeating[sourceSeatIndex].studentId;
                    const targetStudentId = newSeating[targetSeatIndex].studentId;
                    newSeating[sourceSeatIndex].studentId = targetStudentId;
                    newSeating[targetSeatIndex].studentId = sourceStudentId;
                    toast({ title: t('success'), description: t('admin.student_management.seat.swap_success') });
                }
                
                await handleSeatUpdate(newSeating);
                setSelectedSeat(null);
    
            } else {
                if (!studentId) {
                    setSelectedSeat({ seatNumber, studentId });
                }
            }
        } else {
            setSelectedSeat({ seatNumber, studentId });
        }
    }, [currentRoute, selectedSeat, handleSeatUpdate, toast, t]);
    
    const handleSeatContextMenu = (e: React.MouseEvent) => {
        if (selectedSeat) {
            e.preventDefault();
            setSelectedSeat(null);
            toast({ title: t('cancelled'), description: t('admin.student_management.seat.selection_cancelled') });
        }
    };


    const handleResetSeating = useCallback(async () => {
        if (!selectedBus) {
            toast({ title: t('error'), description: t('admin.student_management.seat.select_bus_first'), variant: 'destructive'});
            return;
        }
        if (!currentRoute) return;

        const emptySeating = generateInitialSeating(selectedBus.capacity);
        await handleSeatUpdate(emptySeating);
        toast({ title: t('success'), description: t('admin.student_management.seat.reset_success', {busName: selectedBus.name, day: t(`day.${selectedDay.toLowerCase()}`), routeType: t(`route_type.${selectedRouteType.toLowerCase()}`)}) });
    }, [selectedBus, currentRoute, handleSeatUpdate, toast, t, selectedDay, selectedRouteType]);

    const handleCopySeating = useCallback(async () => {
        if (!currentRoute || !currentRoute.seating) {
            toast({ title: t('error'), description: t('admin.student_management.seat.copy.no_source_error'), variant: "destructive" });
            return;
        }
    
        const selectedDays = weekdays.filter(day => daysToCopyTo[day]);
        const selectedTypes = (['Morning', 'Afternoon'] as const).filter(type => routeTypesToCopyTo[type]);
    
        if (selectedDays.length === 0 || selectedTypes.length === 0) {
            toast({ title: t('notice'), description: t('admin.student_management.seat.copy.no_selection_error') });
            return;
        }
        
        const targetRoutes = routes.filter(r =>
            r.busId === currentRoute.busId &&
            selectedDays.includes(r.dayOfWeek) &&
            selectedTypes.includes(r.type as 'Morning' | 'Afternoon') &&
            r.id !== currentRoute.id
        );
    
        if (targetRoutes.length === 0) {
            toast({ title: t('notice'), description: t('admin.student_management.seat.copy.no_target_error') });
            return;
        }
    
        try {
            await copySeatingPlan(currentRoute.seating, targetRoutes);
            toast({ title: t('success'), description: t('admin.student_management.seat.copy.success') });
            setCopySeatingDialogOpen(false);
        } catch (error) {
            console.error("Error copying seating plan:", error);
            toast({ title: t('error'), description: t('admin.student_management.seat.copy.error'), variant: "destructive" });
        }
    }, [currentRoute, routes, toast, t, daysToCopyTo, weekdays, routeTypesToCopyTo]);

    const handleToggleAllCopyToDays = useCallback((checked: boolean) => {
        const newDaysToCopyTo = weekdays.reduce((acc, day) => ({ ...acc, [day]: checked }), {});
        setDaysToCopyTo(newDaysToCopyTo);
    }, [weekdays]);

    const randomizeSeating = useCallback(async () => {
        if (!selectedBus || !currentRoute) return;

        const studentsForThisRoute = students.filter(s => {
            let destId: string | null | undefined = null;
            if (selectedRouteType === 'Morning') {
                destId = s.morningDestinationId;
            } else if (selectedRouteType === 'Afternoon') {
                destId = s.afternoonDestinationId;
            } else if (selectedRouteType === 'AfterSchool') {
                destId = s.afterSchoolDestinations?.[selectedDay];
            }
            return destId && currentRoute.stops.includes(destId);
        });

        const gradeToValue = (grade: string) => {
            if (grade.toLowerCase().startsWith('k')) return 0;
            const num = parseInt(grade.replace(/\D/g, ''));
            return isNaN(num) ? 99 : num;
        };

        const newSeatingPlan = generateInitialSeating(selectedBus.capacity);
        const occupiedSeats = new Set<number>();
        
        const getSeatPairs = (capacity: number): [number, number][] => {
            const pairs: [number, number][] = [];
            if (capacity === 15) {
                for (let row = 0; row < 4; row++) {
                    const base = row * 4 + 1;
                    if (base === 13) continue;
                    pairs.push([base, base + 1]);
                }
                 pairs.push([10,11]);
                 pairs.push([12,13]);
                 return pairs.filter(p => p[0] !== 3 && p[1] !== 3 && p[0] !== 6 && p[1] !== 6 && p[0] !== 9 && p[1] !== 9);
            }
            const numRows = Math.ceil(capacity / 4);
            for (let row = 0; row < numRows; row++) {
                const base = row * 4 + 1;
                if (base + 1 <= capacity && !((capacity === 45 && base > 40) || (capacity === 29 && base > 24))) pairs.push([base, base + 1]);
                if (base + 2 <= capacity && base + 3 <= capacity && !((capacity === 45 && base + 2 > 40) || (capacity === 29 && base + 2 > 24))) pairs.push([base + 2, base + 3]);
            }
            return pairs;
        };

        const seatPairs = getSeatPairs(selectedBus.capacity);

        let males = studentsForThisRoute.filter(s => s.gender === 'Male').sort((a, b) => gradeToValue(a.grade) - gradeToValue(b.grade));
        let females = studentsForThisRoute.filter(s => s.gender === 'Female').sort((a, b) => gradeToValue(a.grade) - gradeToValue(b.grade));

        const assignPairs = (studentList: Student[], pairList: [number, number][]) => {
            while (studentList.length >= 2 && pairList.length > 0) {
                const student1 = studentList.shift()!;
                const student2 = studentList.shift()!;
                const pair = pairList.shift()!;
                
                const seat1Index = newSeatingPlan.findIndex(s => s.seatNumber === pair[0]);
                const seat2Index = newSeatingPlan.findIndex(s => s.seatNumber === pair[1]);

                if (seat1Index !== -1) newSeatingPlan[seat1Index].studentId = student1.id;
                if (seat2Index !== -1) newSeatingPlan[seat2Index].studentId = student2.id;
                
                occupiedSeats.add(pair[0]);
                occupiedSeats.add(pair[1]);
            }
        };

        const availablePairs = seatPairs.filter(p => !occupiedSeats.has(p[0]) && !occupiedSeats.has(p[1]));
        
        assignPairs(males, availablePairs);
        assignPairs(females, availablePairs);

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
        toast({ title: t('success'), description: t('admin.student_management.seat.random_assign_success') });

        if (selectedRouteType === 'Morning' || selectedRouteType === 'Afternoon') {
            setCopySeatingDialogOpen(true);
        }
    }, [selectedBus, students, currentRoute, handleSeatUpdate, toast, t, selectedDay, selectedRouteType, setCopySeatingDialogOpen]);
    
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
            toast({ title: t('notice'), description: t('admin.student_management.unassigned.no_students_to_download')});
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
    }, [filteredUnassignedStudents, selectedRouteType, selectedDay, destinations, toast, t]);

    const handleStudentFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const studentsToProcess: NewStudent[] = [];
    
                const destinationMap = new Map<string, string>();
                destinations.forEach(d => {
                    destinationMap.set(d.name.trim().toLowerCase(), d.id);
                });
    
                const findDestId = (name: string) => destinationMap.get(name.trim().toLowerCase()) || null;
    
                results.data.forEach((row: any) => {
                    const name = (row['학생 이름'] || '').trim();
                    const grade = (row['학년'] || '').trim();
                    const studentClass = (row['반'] || '').trim();
                    
                    if (!name || !grade || !studentClass) return;
    
                    const morningDestName = (row['등교 목적지'] || '').trim();
                    const afternoonDestName = (row['하교 목적지'] || '').trim();
    
                    const afterSchoolDests: Partial<Record<DayOfWeek, string | null>> = {};
                    days.forEach(day => {
                        const dayLabel = dayLabels[day];
                        const destName = (row[`방과후 목적지(${dayLabel})`] || row[`방과후 목적지 (${dayLabel})`] || '').trim();
                        if (destName) {
                            afterSchoolDests[day] = findDestId(destName);
                        } else {
                            afterSchoolDests[day] = null;
                        }
                    });
                    
                    const studentData: NewStudent = {
                        name: name,
                        grade: grade,
                        class: studentClass,
                        gender: (row['성별'] || 'Male').trim() as 'Male' | 'Female',
                        morningDestinationId: morningDestName ? findDestId(morningDestName) : null,
                        afternoonDestinationId: afternoonDestName ? findDestId(afternoonDestName) : null,
                        afterSchoolDestinations: afterSchoolDests,
                        applicationStatus: 'pending'
                    };
                    studentsToProcess.push(studentData);
                });
    
                if (studentsToProcess.length === 0) {
                    toast({ title: t('error'), description: t('admin.student_management.batch_upload.validation_error'), variant: "destructive" });
                    return;
                }
                const { dismiss } = toast({ title: t('processing'), description: t('admin.student_management.batch_upload.processing') });
                try {
                    const processedStudents = await Promise.all(studentsToProcess.map(s => addStudent(s)));

                    const newStudentList = [...students];
                    processedStudents.forEach(processedStudent => {
                        const index = newStudentList.findIndex(s => s.id === processedStudent.id);
                        if (index !== -1) {
                            newStudentList[index] = processedStudent;
                        } else {
                            newStudentList.push(processedStudent);
                        }
                    });

                    setStudents(newStudentList.sort((a, b) => a.name.localeCompare(b.name, 'ko')));
                    dismiss();
                    toast({ title: t('success'), description: t('admin.student_management.batch_upload.success', {count: processedStudents.length}) });
    
                } catch (error) {
                    console.error(error);
                    dismiss();
                    toast({ title: t('error'), description: t('admin.student_management.batch_upload.error'), variant: "destructive" });
                }
            },
            error: (err) => {
                toast({ title: t('admin.file_parse_error'), description: err.message, variant: "destructive" });
            }
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };
    
     const handleAddStudent = async () => {
        const { name, grade, class: studentClass, gender, morningDestinationId, afternoonDestinationId, afterSchoolDestinations } = newStudentForm;
        if (!name || !grade || !studentClass || !gender) {
            toast({ title: t('error'), description: t('admin.student_management.add_student.validation_error'), variant: "destructive" });
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
            toast({ title: t('success'), description: t('admin.student_management.add_student.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.student_management.add_student.error'), variant: "destructive" });
        }
    };

    const handleDestinationChange = useCallback(async (studentId: string, newDestinationId: string | null, type: 'morning' | 'afternoon' | 'afterSchool', day?: DayOfWeek) => {
        const student = students.find(s => s.id === studentId);
        if (!student) return;

        let updateData: Partial<Student> = { applicationStatus: 'pending' };
        
        const finalDestinationId = newDestinationId === '_NONE_' ? null : newDestinationId;

        if (type === 'morning') {
             updateData.morningDestinationId = finalDestinationId;
        } else if (type === 'afternoon') {
             updateData.afternoonDestinationId = finalDestinationId;
        } else if (type === 'afterSchool' && day) {
             const newAfterSchoolDests = { ...(student.afterSchoolDestinations || {}), [day]: finalDestinationId };
             updateData.afterSchoolDestinations = newAfterSchoolDests;
        }
        
        try {
            await updateStudent(studentId, updateData);
            
            const updatedStudent = { ...student, ...updateData };
            setStudents(prevStudents => prevStudents.map(s => s.id === studentId ? updatedStudent : s));
            if (selectedGlobalStudent?.id === studentId) {
                setSelectedGlobalStudent(updatedStudent);
            }
            
            await unassignStudentFromAllRoutes(studentId);
            
            toast({ title: t('success'), description: t('admin.student_management.search.dest_update_success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.student_management.search.dest_update_error'), variant: "destructive" });
            const freshStudents = await getStudents();
            setStudents(freshStudents);
        }
    }, [students, setStudents, selectedGlobalStudent, toast, t]);
    
    const handleGenderChange = useCallback(async (studentId: string, newGender: 'Male' | 'Female') => {
        const student = students.find(s => s.id === studentId);
        if (!student || student.gender === newGender) return;
    
        try {
            await updateStudent(studentId, { gender: newGender });
            
            const updatedStudent = { ...student, gender: newGender };
            setStudents(prevStudents => prevStudents.map(s => s.id === studentId ? updatedStudent : s));
            if (selectedGlobalStudent?.id === studentId) {
                setSelectedGlobalStudent(updatedStudent);
            }
            
            toast({ title: t('success'), description: t('admin.student_management.search.gender_update_success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.student_management.search.gender_update_error'), variant: "destructive" });
        }
    }, [students, setStudents, selectedGlobalStudent, toast, t]);

    const handleUnassignAllFromStudent = useCallback(async () => {
        if (!selectedGlobalStudent) return;
        try {
            await unassignStudentFromAllRoutes(selectedGlobalStudent.id);
            toast({ title: t('success'), description: t('admin.student_management.search.unassign_all_success', { studentName: selectedGlobalStudent.name })});
        } catch (error) {
             toast({ title: t('error'), description: t('admin.student_management.search.unassign_all_error'), variant: 'destructive'});
        }
    }, [selectedGlobalStudent, toast, t]);

    const getUnassignableReason = (student: Student) => {
        const allValidStopIds = new Set<string>();
        routes.forEach(r => r.stops.forEach(stopId => allValidStopIds.add(stopId)));
        
        const errors: string[] = [];
        if (student.morningDestinationId && !allValidStopIds.has(student.morningDestinationId)) {
            errors.push(t('route_type.morning'));
        }
        if (student.afternoonDestinationId && !allValidStopIds.has(student.afternoonDestinationId)) {
            errors.push(t('route_type.afternoon'));
        }
        if (student.afterSchoolDestinations) {
            const errorDays = Object.keys(student.afterSchoolDestinations).filter(day => {
                const destId = student.afterSchoolDestinations[day as DayOfWeek];
                return destId && !allValidStopIds.has(destId);
            });
            if (errorDays.length > 0) {
                 errors.push(`${t('route_type.afterschool')} (${errorDays.map(d => t(`day_short.${d.toLowerCase()}`)).join(',')})`);
            }
        }
        return errors.join(', ');
    }

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
                <div className="p-4 text-center text-muted-foreground">{t('admin.student_management.select_bus_prompt')}</div>
            </div>
       );
    }
    
     if (!currentRoute) {
        return (
            <div className="space-y-6">
                <div className="p-4 text-center text-muted-foreground">{t('admin.student_management.no_route_info')}</div>
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
                               <CardTitle className="font-headline">{t('admin.student_management.seat.title')}</CardTitle>
                               <CardDescription className="hidden md:block">
                                {selectedSeat?.studentId ? t('admin.student_management.seat.description_selected') : t('admin.student_management.seat.description_initial')}
                               </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                {(selectedRouteType === 'Morning' || selectedRouteType === 'Afternoon') && (
                                    <Dialog open={isCopySeatingDialogOpen} onOpenChange={setCopySeatingDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline"><Copy className="mr-2" /> {t('admin.student_management.seat.copy.button')}</Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>{t('admin.student_management.seat.copy.title')}</DialogTitle>
                                                <CardDescription>{t('admin.student_management.seat.copy.description')}</CardDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                <div>
                                                    <Label>{t('admin.student_management.seat.copy.select_days')}</Label>
                                                    <div className="flex items-center space-x-2 mt-2">
                                                        <Checkbox
                                                            id="copy-all-days"
                                                            checked={weekdays.every(day => daysToCopyTo[day])}
                                                            onCheckedChange={(checked) => handleToggleAllCopyToDays(checked as boolean)}
                                                        />
                                                        <Label htmlFor="copy-all-days">{t('select_all')}</Label>
                                                    </div>
                                                    <div className="grid grid-cols-5 gap-2 mt-2">
                                                        {weekdays.map(day => (
                                                            <div key={day} className="flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`copy-day-${day}`}
                                                                    checked={!!daysToCopyTo[day]}
                                                                    onCheckedChange={(checked) => setDaysToCopyTo(prev => ({ ...prev, [day]: checked }))}
                                                                />
                                                                <Label htmlFor={`copy-day-${day}`}>{t(`day_short.${day.toLowerCase()}`)}</Label>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div>
                                                    <Label>{t('admin.student_management.seat.copy.select_route_types')}</Label>
                                                    <div className="flex items-center space-x-4 mt-2">
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id="copy-type-morning"
                                                                checked={!!routeTypesToCopyTo.Morning}
                                                                onCheckedChange={(checked) => setRouteTypesToCopyTo(prev => ({ ...prev, Morning: checked as boolean }))}
                                                            />
                                                            <Label htmlFor="copy-type-morning">{t('route_type.morning')}</Label>
                                                        </div>
                                                        <div className="flex items-center space-x-2">
                                                            <Checkbox
                                                                id="copy-type-afternoon"
                                                                checked={!!routeTypesToCopyTo.Afternoon}
                                                                onCheckedChange={(checked) => setRouteTypesToCopyTo(prev => ({ ...prev, Afternoon: checked as boolean }))}
                                                            />
                                                            <Label htmlFor="copy-type-afternoon">{t('route_type.afternoon')}</Label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleCopySeating} className="w-full">{t('copy')}</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                )}
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline"><RotateCcw className="mr-2" /> {t('admin.student_management.seat.reset.button')}</Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t('admin.student_management.seat.reset.confirm_title')}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                               {t('admin.student_management.seat.reset.confirm_description', { busName: selectedBus?.name })}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleResetSeating}>{t('reset')}</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                                <Button variant="outline" onClick={randomizeSeating}><Shuffle className="mr-2" /> {t('admin.student_management.seat.random_assign_button')}</Button>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline"><UserPlus className="mr-2" /> {t('admin.student_management.add_student.button')}</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader><DialogTitle>{t('admin.student_management.add_student.title')}</DialogTitle></DialogHeader>
                                        <div className="grid gap-4 py-4">
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="name" className="text-right">{t('student.name')}</Label>
                                                <Input id="name" value={newStudentForm.name || ''} onChange={e => setNewStudentForm(p => ({...p, name: e.target.value}))} className="col-span-3" />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="grade" className="text-right">{t('student.grade')}</Label>
                                                <Input id="grade" value={newStudentForm.grade || ''} onChange={e => setNewStudentForm(p => ({...p, grade: e.target.value}))} placeholder={t('student.grade_placeholder')} className="col-span-3" />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="class" className="text-right">{t('student.class')}</Label>
                                                <Input id="class" value={newStudentForm.class || ''} onChange={e => setNewStudentForm(p => ({...p, class: e.target.value}))} placeholder={t('student.class_placeholder')} className="col-span-3" />
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="gender" className="text-right">{t('student.gender')}</Label>
                                                <Select value={newStudentForm.gender} onValueChange={(v) => setNewStudentForm(p => ({...p, gender: v as any}))}>
                                                    <SelectTrigger className="col-span-3">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Male">{t('student.male')}</SelectItem>
                                                        <SelectItem value="Female">{t('student.female')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="destination" className="text-right">{t('student.morning_destination')}</Label>
                                                <Select value={newStudentForm.morningDestinationId || ''} onValueChange={(v) => setNewStudentForm(p => ({...p, morningDestinationId: v}))}>
                                                    <SelectTrigger className="col-span-3">
                                                        <SelectValue placeholder={t('select_destination')} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="destination" className="text-right">{t('student.afternoon_destination')}</Label>
                                                <Select value={newStudentForm.afternoonDestinationId || ''} onValueChange={(v) => setNewStudentForm(p => ({...p, afternoonDestinationId: v}))}>
                                                    <SelectTrigger className="col-span-3">
                                                        <SelectValue placeholder={t('select_destination')} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                             <div className="grid grid-cols-4 items-center gap-4">
                                                <Label htmlFor="destination" className="text-right">{t('student.after_school_destination')}</Label>
                                                <Select value={ (newStudentForm.afterSchoolDestinations && newStudentForm.afterSchoolDestinations['Monday']) || ''} onValueChange={(v) => setNewStudentForm(p => {
                                                    const newDests: Partial<Record<DayOfWeek, string | null>> = {};
                                                    days.forEach(day => newDests[day] = v);
                                                    return {...p, afterSchoolDestinations: newDests};
                                                })}>
                                                    <SelectTrigger className="col-span-3">
                                                        <SelectValue placeholder={t('admin.student_management.add_student.all_days_placeholder')} />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <Button onClick={handleAddStudent}>{t('add')}</Button>
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
                            <AlertTitle className="text-orange-900 dark:text-orange-100">{t('admin.student_management.unassignable.title')}</AlertTitle>
                            <AlertDescription className="space-y-2">
                                <p>{t('admin.student_management.unassignable.description')}</p>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {unassignableStudents.map(student => (
                                        <div key={student.id} className="p-2 border border-orange-300 dark:border-orange-600 rounded-md bg-white dark:bg-orange-900/50">
                                            <div className="font-semibold">{student.name} ({student.grade} {student.class})</div>
                                            <div className="text-xs">{t('admin.student_management.unassignable.error_reason')}: {getUnassignableReason(student)}</div>
                                            
                                            <div className="grid grid-cols-2 gap-2 mt-2">
                                                {student.morningDestinationId && <Select value={student.morningDestinationId} onValueChange={(v) => handleDestinationChange(student.id, v, 'morning')}>
                                                    <SelectTrigger><SelectValue placeholder={t('student.morning_destination')} /></SelectTrigger>
                                                    <SelectContent>{destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                                                </Select>}
                                                {student.afternoonDestinationId && <Select value={student.afternoonDestinationId} onValueChange={(v) => handleDestinationChange(student.id, v, 'afternoon')}>
                                                    <SelectTrigger><SelectValue placeholder={t('student.afternoon_destination')} /></SelectTrigger>
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
                <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-20 h-fit">
                     <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">{t('admin.student_management.unassigned.title', { routeType: t(`route_type.${selectedRouteType.toLowerCase()}`), day: t(`day.${selectedDay.toLowerCase()}`) })}</CardTitle>
                            <CardDescription>
                                {t('admin.student_management.unassigned.description')}
                            </CardDescription>
                        </CardHeader>
                        <Separator />
                         <CardContent className='pt-4 max-h-[40vh] overflow-y-auto'>
                            <div className="relative mb-4">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder={t('admin.student_management.unassigned.search_placeholder')}
                                    className="pl-8 w-full"
                                    value={unassignedSearchQuery}
                                    onChange={(e) => setUnassignedSearchQuery(e.target.value)}
                                />
                            </div>
                             <div className="flex justify-end mb-2 gap-2 flex-wrap">
                                 <Button size="sm" variant="outline" onClick={handleDownloadStudentTemplate}><Download className="mr-2 h-4 w-4" /> {t('admin.student_management.student_template')}</Button>
                                 <Button size="sm" variant="outline" onClick={handleDownloadUnassignedStudents}><Download className="mr-2 h-4 w-4" /> {t('admin.student_management.unassigned.download_list')}</Button>
                                 <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> {t('batch_upload')}</Button>
                                 <input type="file" ref={fileInputRef} onChange={handleStudentFileUpload} accept=".csv" className="hidden" />
                                 <Button size="sm" variant="outline" onClick={handleToggleSelectAll}>
                                    {selectedStudentIds.size === filteredUnassignedStudents.length && filteredUnassignedStudents.length > 0 ? t('deselect_all') : t('select_all')}
                                 </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="destructive" disabled={selectedStudentIds.size === 0}>
                                            <Trash2 className="mr-2 h-4 w-4" /> {t('delete_selected')}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>{t('admin.student_management.unassigned.delete_confirm_title')}</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                {t('admin.student_management.unassigned.delete_confirm_description', { count: selectedStudentIds.size })}
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteSelectedStudents}>{t('delete')}</AlertDialogAction>
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
                                        onCardClick={() => handleUnassignedStudentClick(student)}
                                        onAssignClick={() => handleStudentCardClick(student.id)}
                                        routeType={selectedRouteType}
                                        dayOfWeek={selectedDay}
                                    />
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="font-headline">{t('admin.student_management.search.title')}</CardTitle>
                            <CardDescription>
                                {t('admin.student_management.search.description')}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="relative mb-4">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder={t('admin.student_management.search.placeholder')}
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
                                                        <UserX className="mr-1"/>{t('admin.student_management.search.unassign_all_button')}
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>{t('admin.student_management.search.unassign_all_confirm_title')}</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            {t('admin.student_management.search.unassign_all_confirm_description', { studentName: selectedGlobalStudent.name })}
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleUnassignAllFromStudent}>{t('unassign')}</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                        <Button variant="outline" size="sm" onClick={() => setSelectedGlobalStudent(null)}>{t('close')}</Button>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('student.gender')}</Label>
                                        <Select 
                                            value={selectedGlobalStudent.gender} 
                                            onValueChange={(v) => handleGenderChange(selectedGlobalStudent.id, v as 'Male' | 'Female')}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='Male'>{t('student.male')}</SelectItem>
                                                <SelectItem value='Female'>{t('student.female')}</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('student.morning_destination')}</Label>
                                        <Select 
                                            value={selectedGlobalStudent.morningDestinationId || '_NONE_'} 
                                            onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'morning')}
                                        >
                                            <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                                {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>{t('student.afternoon_destination')}</Label>
                                        <Select 
                                            value={selectedGlobalStudent.afternoonDestinationId || '_NONE_'} 
                                            onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'afternoon')}
                                        >
                                            <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                                {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="space-y-3">
                                        <Label>{t('student.after_school_destination')}</Label>
                                        {dayOrder.map(day => (
                                            <div key={day} className="space-y-1">
                                                 <Label className="text-xs text-muted-foreground">{t(`day.${day.toLowerCase()}`)}</Label>
                                                 <Select 
                                                    value={selectedGlobalStudent.afterSchoolDestinations?.[day] || '_NONE_'} 
                                                    onValueChange={(v) => handleDestinationChange(selectedGlobalStudent.id, v, 'afterSchool', day)}
                                                    disabled={day === 'Friday' && selectedRouteType === 'AfterSchool' && !selectedGlobalStudent.afterSchoolDestinations?.['Friday']}
                                                >
                                                    <SelectTrigger><SelectValue placeholder={t('no_destination')} /></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value='_NONE_'>{t('no_selection')}</SelectItem>
                                                        {destinations.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </div>


                                     <div>
                                        <Label>{t('admin.student_management.search.assigned_routes')}</Label>
                                        <div className="space-y-2 mt-1 border rounded-md p-2 max-h-40 overflow-y-auto">
                                            {assignedRoutesForSelectedStudent.length > 0 ? (
                                                assignedRoutesForSelectedStudent.map(route => {
                                                    const busName = buses.find(b => b.id === route.busId)?.name || t('unknown_bus');
                                                    const routeTypeName = t(`route_type.${route.type.toLowerCase()}`);
                                                    return (
                                                        <div key={route.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                                                            <p className="text-sm">{busName} - {t(`day.${route.dayOfWeek.toLowerCase()}`)} {routeTypeName}</p>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleUnassignStudentFromRoute(route.id, selectedGlobalStudent.id)}>
                                                                <UserX className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )
                                                })
                                            ) : (
                                                <p className="text-sm text-muted-foreground p-2">{t('admin.student_management.search.no_assigned_routes')}</p>
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
    const { t } = useTranslation();
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
                    toast({ title: t('error'), description: t('admin.teacher_management.batch.validation_error'), variant: "destructive" });
                    return;
                }

                const { dismiss } = toast({ title: t('processing'), description: t('admin.teacher_management.batch.processing') });
                try {
                    const addedTeachers = await addTeachersInBatch(newTeachersData);
                    setTeachers(prev => [...prev, ...addedTeachers].sort((a,b) => a.name.localeCompare(b.name, 'ko')));
                    dismiss();
                    toast({ title: t('success'), description: t('admin.teacher_management.batch.success', {count: addedTeachers.length}) });
                } catch (error) {
                    dismiss();
                    toast({ title: t('error'), description: t('admin.teacher_management.batch.error'), variant: "destructive" });
                }
            },
            error: (error) => {
                toast({ title: t('admin.file_parse_error'), description: error.message, variant: "destructive" });
            }
        });

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin.teacher_management.title')}</CardTitle>
                <CardDescription>{t('admin.teacher_management.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end gap-2 mb-4">
                    <Button variant="outline" onClick={handleDownloadTeacherTemplate}><Download className="mr-2" /> {t('template')}</Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> {t('batch_upload')}</Button>
                    <input type="file" ref={fileInputRef} onChange={handleTeacherFileUpload} accept=".csv" className="hidden" />
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('admin.teacher_management.teacher_name')}</TableHead>
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
    filterConfiguredBusesOnly?: boolean;
    showRouteStops?: boolean;
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
    filterConfiguredBusesOnly = false,
    showRouteStops = false,
}) => {
    const { t } = useTranslation();
    
    const displayBuses = useMemo(() => {
        if (!filterConfiguredBusesOnly) {
            return buses;
        }
        const configuredBusIds = new Set<string>();
        routes.forEach(route => {
            if (route.dayOfWeek === selectedDay && route.type === selectedRouteType) {
                 const hasStops = route.stops.length > 0;
                 const hasStudents = route.seating.some(s => s.studentId !== null);
                 
                 let isConfigured = false;
                 if (route.type === 'AfterSchool') {
                    isConfigured = hasStudents;
                 } else {
                    isConfigured = hasStops || hasStudents;
                 }

                 if (isConfigured) {
                    configuredBusIds.add(route.busId);
                 }
            }
        });
        return buses.filter(bus => configuredBusIds.has(bus.id));
    }, [buses, routes, selectedDay, selectedRouteType, filterConfiguredBusesOnly]);

    useEffect(() => {
        if (selectedBusId && !displayBuses.some(b => b.id === selectedBusId)) {
            setSelectedBusId(displayBuses.length > 0 ? displayBuses[0].id : null);
        } else if (!selectedBusId && displayBuses.length > 0) {
            setSelectedBusId(displayBuses[0].id);
        }
    }, [displayBuses, selectedBusId, setSelectedBusId]);
    
    const getRouteStopsPreview = (busId: string) => {
        const route = routes.find(r => r.busId === busId && r.dayOfWeek === selectedDay && r.type === selectedRouteType);
        if (!route || route.stops.length === 0) return null;
        
        const stopNames = route.stops
            .map(stopId => destinations.find(d => d.id === stopId)?.name)
            .filter(Boolean)
            .slice(0, 5)
            .join(', ');
            
        return stopNames;
    };

    return (
        <Card className="mb-6">
            <CardContent className="p-4">
                 <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <Label>{t('bus')}</Label>
                    <Select value={selectedBusId || ''} onValueChange={setSelectedBusId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_bus')} />
                      </SelectTrigger>
                      <SelectContent>
                        {displayBuses.map((bus) => {
                           const stopsPreview = showRouteStops ? getRouteStopsPreview(bus.id) : null;
                           return (
                              <SelectItem key={bus.id} value={bus.id}>
                                <div>
                                    <p>{bus.name}</p>
                                    {stopsPreview && (
                                        <p className="text-xs text-muted-foreground">{stopsPreview}</p>
                                    )}
                                </div>
                              </SelectItem>
                           );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('day')}</Label>
                    <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('select_day')} />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={day} value={day}>
                            {t(`day.${day.toLowerCase()}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{t('route')}</Label>
                    <Tabs value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)} className="w-full">
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="Morning">{t('route_type.morning')}</TabsTrigger>
                        <TabsTrigger value="Afternoon">{t('route_type.afternoon')}</TabsTrigger>
                        <TabsTrigger value="AfterSchool">{t('route_type.AfterSchool')}</TabsTrigger>
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
    const { t } = useTranslation();
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const handleAcknowledgeAll = async () => {
        const pendingStudentIds = pendingStudents.map(s => s.id);
        if (pendingStudentIds.length === 0) return;

        try {
            await updateStudentsInBatch(pendingStudentIds.map(id => ({ id, applicationStatus: 'reviewed' })));
            setStudents(prev => prev.map(s => pendingStudentIds.includes(s.id) ? { ...s, applicationStatus: 'reviewed' } : s));
            setPendingStudents([]);
            toast({ title: t('success'), description: t('admin.new_applications.acknowledge_success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.new_applications.acknowledge_error'), variant: "destructive" });
        }
    };
    
    return (
        <>
            {pendingStudents.length > 0 && (
                <Alert className="mb-6">
                    <Bell className="h-4 w-4" />
                    <AlertTitle>{t('admin.new_applications.title')}</AlertTitle>
                    <AlertDescription className="flex justify-between items-center">
                        {t('admin.new_applications.description', {count: pendingStudents.length})}
                         <Button onClick={handleAcknowledgeAll}>
                            <Check className="mr-2" /> {t('admin.new_applications.acknowledge_button')}
                        </Button>
                    </AlertDescription>
                </Alert>
            )}
            <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="student-management">
                <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="bus-registration">{t('admin.tabs.bus_registration')}</TabsTrigger>
                    <TabsTrigger value="teacher-management">{t('admin.tabs.teacher_management')}</TabsTrigger>
                    <TabsTrigger value="bus-configuration">{t('admin.tabs.bus_configuration')}</TabsTrigger>
                    <TabsTrigger value="student-management">{t('admin.tabs.student_management')}</TabsTrigger>
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
                        filterConfiguredBusesOnly={false}
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
                        filterConfiguredBusesOnly={true}
                        showRouteStops={true}
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
    const { t } = useTranslation();
    
    useEffect(() => {
        if (!authLoading && !user) {
          router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        if (user && !authLoading) {
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
                        setDataLoading(false);
                    });

                    return () => {
                        unsubscribeRoutes();
                    };
                } catch (error) {
                    console.error("Failed to fetch initial data:", error);
                    toast({ title: t('error'), description: t('loading.initial_data_error'), variant: "destructive" });
                    setDataLoading(false);
                }
            };

            const unsubscribePromise = fetchAndSubscribe();

            return () => {
                 unsubscribePromise.then(unsubscribe => unsubscribe && unsubscribe());
            };
        }
    }, [user, authLoading, toast, t]);

    useEffect(() => {
        setPendingStudents(students.filter(s => s.applicationStatus === 'pending'));
    }, [students]);


    if (authLoading || dataLoading) {
        return (
            <MainLayout>
                <div className="flex justify-center items-center h-64">
                    <p>{t('loading.data')}</p>
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
