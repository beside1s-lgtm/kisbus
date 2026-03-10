'use client';

import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { addBus, deleteBus, updateBus, addRoute } from '@/lib/firebase-data';
import type { Bus, NewBus, DayOfWeek, RouteType, Destination, Route } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Upload, Trash2, PlusCircle, Download, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from '@/hooks/use-translation';

const sortBuses = (buses: Bus[]): Bus[] => {
    return [...buses].sort((a, b) => {
      const numA = parseInt(a.name.replace(/\D/g, ''), 10);
      const numB = parseInt(b.name.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) {
        return numA - numB;
      }
      return a.name.localeCompare(b.name);
    });
};

interface BusRegistrationTabProps {
    buses: Bus[];
    routes: Route[];
    destinations: Destination[];
}

const generateInitialSeating = (capacity: number): { seatNumber: number; studentId: string | null }[] => {
    return Array.from({ length: capacity }, (_, i) => ({
        seatNumber: i + 1,
        studentId: null,
    }));
};

export const BusRegistrationTab = ({ buses, routes, destinations }: BusRegistrationTabProps) => {
    const [newBusName, setNewBusName] = useState('');
    const [newBusType, setNewBusType] = useState<'16-seater' | '29-seater' | '45-seater'>('45-seater');
    
    // States for editing bus
    const [editingBus, setEditingBus] = useState<Bus | null>(null);
    const [editBusName, setEditBusName] = useState('');
    const [editBusType, setEditBusType] = useState<'16-seater' | '29-seater' | '45-seater'>('45-seater');

    const { toast } = useToast();
    const { t } = useTranslation();
    const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const routeTypes: RouteType[] = ['Morning', 'Afternoon', 'AfterSchool'];
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddBusLogic = async (busData: NewBus) => {
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
        const capacityMap = { '16-seater': 16, '29-seater': 29, '45-seater': 45 } as const;
        const newBusData: NewBus = { name: newBusName, type: newBusType, capacity: capacityMap[newBusType] };
        try {
            await handleAddBusLogic(newBusData);
            setNewBusName('');
            toast({ title: t('success'), description: t('admin.bus_registration.add.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.bus_registration.add.error'), variant: 'destructive' });
        }
    };

    const handleEditClick = (bus: Bus) => {
        setEditingBus(bus);
        setEditBusName(bus.name);
        setEditBusType(bus.type);
    };

    const handleUpdateBus = async () => {
        if (!editingBus || !editBusName || !editBusType) {
            toast({ title: t('error'), description: "버스 이름과 타입을 모두 입력해주세요.", variant: 'destructive' });
            return;
        }
        const capacityMap = { '16-seater': 16, '29-seater': 29, '45-seater': 45 } as const;
        const updateData: Partial<Bus> = {
            name: editBusName,
            type: editBusType,
            capacity: capacityMap[editBusType]
        };
        try {
            await updateBus(editingBus.id, updateData);
            setEditingBus(null);
            toast({ title: t('success'), description: "버스 정보가 수정되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "버스 수정 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };
    
    const handleDeleteBus = async (busId: string) => {
        try {
            await deleteBus(busId);
            toast({ title: t('success'), description: t('admin.bus_registration.delete.success')});
        } catch (error) {
            console.error("Error deleting bus:", error);
            toast({ title: t('error'), description: t('admin.bus_registration.delete.error'), variant: 'destructive' });
        }
    }

    const handleToggleBusActive = async (bus: Bus) => {
        try {
            const newIsActive = !(bus.isActive ?? true);
            await updateBus(bus.id, { isActive: newIsActive });
            toast({ title: t('success'), description: `"${bus.name}" 버스 상태가 ${newIsActive ? '활성' : '비활성'}으로 변경되었습니다.` });
        } catch (error) {
            console.error("Error updating bus status:", error);
            toast({ title: t('error'), description: "버스 상태 변경 중 오류가 발생했습니다.", variant: 'destructive' });
        }
    };

    const handleDownloadBusTemplate = () => {
        const headers = "번호,타입";
        const examples = [
            "Bus-10,45-seater",
            "Bus-11,29-seater",
            "Bus-12,16-seater"
        ];
        const csvContent = "\uFEFF" + headers + "\n" + examples.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement("a"));
        link.setAttribute("href", url);
        link.setAttribute("download", "bus_template.csv");
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
                const capacityMap = { '16-seater': 16, '29-seater': 29, '45-seater': 45 } as const;
                const validTypes = Object.keys(capacityMap);
                const newBusesData: NewBus[] = results.data.map((row: any) => {
                    const type = (row['타입'] || row['type'] || '').trim();
                    return {
                        name: (row['번호'] || row['name'] || '').trim(),
                        type: type as '16-seater' | '29-seater' | '45-seater',
                        capacity: capacityMap[type as keyof typeof capacityMap]
                    }
                }).filter(bus => bus.name && bus.type && validTypes.includes(bus.type));
                if (newBusesData.length === 0) {
                    toast({ title: t('error'), description: t('admin.bus_registration.batch.validation_error'), variant: "destructive" });
                    return;
                }
                const { dismiss } = toast({ title: t('processing'), description: t('admin.bus_registration.batch.processing') });
                try {
                    await Promise.all(newBusesData.map(busData => handleAddBusLogic(busData)));
                    dismiss();
                    toast({ title: t('success'), description: t('admin.bus_registration.batch.success', { count: newBusesData.length }) });
                } catch (error) {
                    dismiss();
                    toast({ title: t('error'), description: t('admin.bus_registration.batch.error'), variant: "destructive" });
                }
            },
            error: (error) => {
                toast({ title: t('admin.file_parse_error'), description: error.message, variant: "destructive" });
            }
        });
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleDownloadBusList = () => {
        if (buses.length === 0) {
            toast({ title: t('notice'), description: "다운로드할 버스 데이터가 없습니다." });
            return;
        }
        const headers = ["버스 번호", "타입", "상태"];
        const sorted = sortBuses(buses);
        const csvRows = sorted.map(bus => {
            const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
            return [
                escape(bus.name),
                escape(t(`bus_type.${bus.type}`)),
                escape((bus.isActive ?? true) ? '활성' : '비활성')
            ].join(',');
        });
        const csvContent = "\uFEFF" + headers.join(',') + "\n" + csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.body.appendChild(document.createElement("a"));
        link.setAttribute("href", url);
        link.setAttribute("download", `KIS_Bus_Metadata_List.csv`);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t('admin.bus_registration.title')}</CardTitle>
                <CardDescription>{t('admin.bus_registration.description')}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col sm:flex-row justify-end items-start sm:items-center gap-2 mb-4 flex-wrap">
                    <Button variant="outline" onClick={handleDownloadBusList}><Download className="mr-2 h-4 w-4" /> 목록 다운로드</Button>
                    <Button variant="outline" onClick={handleDownloadBusTemplate}><Download className="mr-2 h-4 w-4" /> {t('admin.bus_registration.template')}</Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> {t('batch_upload')}</Button>
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
                                            <SelectItem value="16-seater">{t('bus_type.16')}</SelectItem>
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

                {/* Edit Bus Dialog */}
                <Dialog open={!!editingBus} onOpenChange={(open) => !open && setEditingBus(null)}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>버스 정보 수정</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-bus-name" className="text-right">{t('admin.bus_registration.bus_number')}</Label>
                                <Input id="edit-bus-name" className="col-span-3" value={editBusName} onChange={e => setEditBusName(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="edit-bus-type" className="text-right">{t('type')}</Label>
                                <Select onValueChange={(v) => setEditBusType(v as any)} value={editBusType}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="16-seater">{t('bus_type.16')}</SelectItem>
                                        <SelectItem value="29-seater">{t('bus_type.29')}</SelectItem>
                                        <SelectItem value="45-seater">{t('bus_type.45')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditingBus(null)}>{t('cancel')}</Button>
                            <Button onClick={handleUpdateBus}>{t('save')}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>활성화</TableHead>
                            <TableHead>{t('admin.bus_registration.bus_number')}</TableHead>
                            <TableHead>{t('type')}</TableHead>
                            <TableHead className="text-right">{t('actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortBuses(buses).map(bus => (
                            <TableRow key={bus.id} className={cn(!(bus.isActive ?? true) && "text-muted-foreground")}>
                                <TableCell>
                                    <Switch
                                        checked={bus.isActive ?? true}
                                        onCheckedChange={() => handleToggleBusActive(bus)}
                                        aria-label="Toggle bus active state"
                                    />
                                </TableCell>
                                <TableCell>{bus.name}</TableCell>
                                <TableCell>{t(`bus_type.${bus.type}`)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(bus)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
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
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
};
