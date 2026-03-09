'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import { 
    addDestination, deleteDestination, approveSuggestedDestination, addDestinationsInBatch,
    updateRouteStops, clearAllSuggestedDestinations, deleteAllDestinations, copyRoutePlan
} from '@/lib/firebase-data';
import type { Bus, Route, Destination, DayOfWeek, RouteType, NewDestination } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Upload, Trash2, PlusCircle, Download, X, Search, Copy, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn, normalizeString } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useTranslation } from '@/hooks/use-translation';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface BusConfigurationTabProps {
  buses: Bus[];
  routes: Route[];
  destinations: Destination[];
  suggestedDestinations: Destination[];
  selectedDay: DayOfWeek;
  selectedRouteType: RouteType;
  selectedBusId: string | null;
}

export const BusConfigurationTab = ({
  buses,
  routes,
  destinations,
  suggestedDestinations,
  selectedDay,
  selectedRouteType,
  selectedBusId,
}: BusConfigurationTabProps) => {
  const [newDestinationName, setNewDestinationName] = useState('');
  const [destinationSearchQuery, setDestinationSearchQuery] = useState('');
  const { toast } = useToast();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

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

   const handleAddDestination = async () => {
        const trimmedName = newDestinationName.trim();
        if (!trimmedName) return;

        const normNew = normalizeString(trimmedName);
        if (destinations.some(d => normalizeString(d.name) === normNew)) {
            toast({ title: t('notice'), description: t('admin.bus_config.dest.add.already_exists'), variant: 'default' });
            return;
        }

        try {
            await addDestination({ name: trimmedName });
            setNewDestinationName('');
            toast({ title: t('success'), description: t('admin.bus_config.dest.add.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.bus_config.dest.add.error'), variant: 'destructive' });
        }
    };
    
    const handleDeleteDestination = async (id: string) => {
        try {
            await deleteDestination(id);
            toast({ title: t('success'), description: t('admin.bus_config.dest.delete.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.bus_config.dest.delete.error'), variant: 'destructive' });
        }
    };
    
    const handleClearAllDestinations = async () => {
        const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_config.dest.delete_all.processing') });
        try {
            await deleteAllDestinations();
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
            const normalizedExisting = new Set(destinations.map(d => normalizeString(d.name)));
            const newDestinationsData: NewDestination[] = results.data.map((row: any) => ({
                name: (row['목적지 이름'] || row['name'] || '').toString().trim()
            })).filter(dest => {
                const normName = normalizeString(dest.name);
                return normName && !normalizedExisting.has(normName);
            });

            if (newDestinationsData.length === 0) {
                toast({ title: t('notice'), description: t('admin.bus_config.dest.batch.no_new'), variant: "default" });
                return;
            }
            const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_config.dest.batch.processing') });
            try {
                await addDestinationsInBatch(newDestinationsData);
                dismiss();
                toast({ title: t('success'), description: t('admin.bus_config.dest.batch.success', {count: newDestinationsData.length}) });
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
    const normName = normalizeString(suggestion.name);
    if (destinations.some(d => normalizeString(d.name) === normName)) {
        toast({ title: t('notice'), description: t('admin.bus_config.suggestions.already_exists') });
        try {
            await deleteDoc(doc(db, 'suggestedDestinations', suggestion.id));
        } catch (error) {
             toast({ title: t('error'), description: t('admin.bus_config.suggestions.delete_error'), variant: 'destructive'});
        }
        return;
    }
      
    try {
        await approveSuggestedDestination(suggestion);
        toast({ title: t('success'), description: t('admin.bus_config.suggestions.approve_success')});
    } catch (error) {
        toast({ title: t('error'), description: t('admin.bus_config.suggestions.approve_error'), variant: 'destructive'});
    }
  };

  const handleClearAllSuggestions = async () => {
    const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_config.suggestions.delete_all.processing') });
    try {
        await clearAllSuggestedDestinations();
        dismiss();
        toast({ title: t('success'), description: t('admin.bus_config.suggestions.delete_all.success') });
    } catch (error) {
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
          [newStopIds[index], newStopIds[index + 1]] = [newStopIds[index], newStopIds[index + 1]];
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
                        <Button variant="outline" onClick={handleDownloadDestinationTemplate}><Download className="mr-2" /> {t('admin.bus_config.dest.template')}</Button>
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
                                        <CardTitle>{selectedBus.name} - {t(`day.${selectedDay.toLowerCase()}`)} {
                                            selectedRouteType === 'AfterSchool' ? t('route_type.after_school') : t(`route_type.${selectedRouteType.toLowerCase()}`)
                                        }</CardTitle>
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
    </div>
  );
};
