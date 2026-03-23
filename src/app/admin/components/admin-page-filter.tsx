'use client';

import React, { useMemo, useEffect } from 'react';
import type { Bus, Route, Destination, DayOfWeek, RouteType } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslation } from '@/hooks/use-translation';

interface AdminPageFilterProps {
    buses: Bus[];
    routes: Route[];
    destinations?: Destination[];
    selectedBusId: string | null;
    setSelectedBusId: (id: string | null) => void;
    selectedDay: DayOfWeek;
    setSelectedDay: (day: DayOfWeek) => void;
    selectedRouteType: RouteType;
    setSelectedRouteType: (type: RouteType) => void;
    days: DayOfWeek[];
    filterConfiguredBusesOnly?: boolean;
    showRouteStops?: boolean;
}

export const AdminPageFilter = ({
    buses,
    routes,
    destinations = [],
    selectedBusId,
    setSelectedBusId,
    selectedDay,
    setSelectedDay,
    selectedRouteType,
    setSelectedRouteType,
    days,
    filterConfiguredBusesOnly = false,
    showRouteStops = false,
}: AdminPageFilterProps) => {
    const { t } = useTranslation();

    const filteredBuses = useMemo(() => {
        const activeBuses = buses.filter(bus => bus.isActive !== false);
        if (!filterConfiguredBusesOnly) return activeBuses;

        const operationalBusIds = new Set<string>();
        routes.forEach(route => {
            if (route.dayOfWeek === selectedDay && route.type === selectedRouteType) {
                if ((route.stops?.length ?? 0) > 0) {
                    operationalBusIds.add(route.busId);
                }
            }
        });
        return activeBuses.filter(bus => operationalBusIds.has(bus.id));
    }, [buses, routes, selectedDay, selectedRouteType, filterConfiguredBusesOnly]);

    useEffect(() => {
        if (filterConfiguredBusesOnly) {
            if (selectedBusId && selectedBusId !== 'all' && !filteredBuses.some(b => b.id === selectedBusId)) {
                setSelectedBusId(filteredBuses.length > 0 ? filteredBuses[0].id : 'all');
            } else if (!selectedBusId && filteredBuses.length > 0) {
                setSelectedBusId('all');
            }
        } else {
             if (!selectedBusId && buses.length > 0) {
                setSelectedBusId('all');
            }
        }
    }, [filteredBuses, selectedBusId, setSelectedBusId, filterConfiguredBusesOnly, buses]);

    const currentRouteStops = useMemo(() => {
        if (!showRouteStops || !selectedBusId || selectedBusId === 'all') return null;
        const route = routes.find(r => r.busId === selectedBusId && r.dayOfWeek === selectedDay && r.type === selectedRouteType);
        if (!route || route.stops.length === 0) return t('no_route_info');

        const stopNames = route.stops.map(stopId => destinations.find(d => d.id === stopId)?.name).filter(Boolean);
        
        if (selectedRouteType === 'Afternoon') {
            return [...stopNames].reverse().join(' -> ');
        }
        
        return stopNames.join(' -> ');
    }, [showRouteStops, selectedBusId, routes, selectedDay, selectedRouteType, destinations, t]);
    
    return (
        <Card className="mb-6">
            <CardContent className="flex flex-wrap items-end gap-4 p-4">
                <div className="w-full sm:w-auto">
                    <Label className="text-xs">{t('bus')}</Label>
                    <Select value={selectedBusId || 'all'} onValueChange={setSelectedBusId}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder={t('select_bus')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">전체 (All)</SelectItem>
                            {filteredBuses.map((bus) => (
                                <SelectItem key={bus.id} value={bus.id}>
                                    {bus.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="w-full sm:w-auto">
                    <Label className="text-xs">{t('day')}</Label>
                    <Select value={selectedDay} onValueChange={(v) => setSelectedDay(v as DayOfWeek)}>
                        <SelectTrigger className="w-full sm:w-[120px]">
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
                <div className="w-full sm:w-auto">
                    <Label className="text-xs">{t('route')}</Label>
                    <Select value={selectedRouteType} onValueChange={(v) => setSelectedRouteType(v as RouteType)}>
                        <SelectTrigger className="w-full sm:w-[120px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Morning">{t('route_type.morning')}</SelectItem>
                            <SelectItem value="Afternoon">{t('route_type.afternoon')}</SelectItem>
                            {selectedDay !== 'Saturday' && <SelectItem value="AfterSchool">{t('route_type.after_school')}</SelectItem>}
                        </SelectContent>
                    </Select>
                </div>
                {showRouteStops && currentRouteStops && (
                     <div className="flex-1 min-w-full sm:min-w-fit">
                        <Label className="text-xs">{t('route')}</Label>
                        <p className="text-sm p-2 bg-muted rounded-md truncate">{currentRouteStops}</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
