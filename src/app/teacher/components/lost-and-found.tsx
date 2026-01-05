
'use client';
import React, { useState, useRef, useMemo } from 'react';
import { LostItem, NewLostItem, Bus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Camera, Undo2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addLostItem, deleteLostItem, updateLostItem } from '@/lib/firebase-data';
import { format } from 'date-fns';
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/hooks/use-translation';

interface LostAndFoundProps {
    lostItems: LostItem[];
    setLostItems: React.Dispatch<React.SetStateAction<LostItem[]>>;
    buses: Bus[];
    isReadOnly?: boolean;
}

const MAX_IMAGE_SIZE_BYTES = 1048576; // 1MB

export function LostAndFound({ lostItems, setLostItems, buses, isReadOnly = false }: LostAndFoundProps) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [isAddDialogOpen, setAddDialogOpen] = useState(false);
    const [isViewImageDialogOpen, setViewImageDialogOpen] = useState(false);
    const [imageToView, setImageToView] = useState<string | null>(null);
    const [newItem, setNewItem] = useState<Partial<NewLostItem>>({
        foundDate: format(new Date(), 'yyyy-MM-dd'),
        status: 'unclaimed',
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > MAX_IMAGE_SIZE_BYTES) {
                toast({
                    title: t('error'),
                    description: t('lost_and_found.image_size_error'),
                    variant: 'destructive',
                });
                if(fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewItem(prev => ({ ...prev, itemPhotoUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAddItem = async () => {
        if (!newItem.itemType && !newItem.itemPhotoUrl) {
            toast({ title: t('error'), description: t('lost_and_found.add.validation_error'), variant: 'destructive' });
            return;
        }

        try {
            const addedItem = await addLostItem({ ...newItem, status: 'unclaimed' } as NewLostItem);
            setLostItems(prev => [addedItem, ...prev].sort((a,b) => (b.foundDate || '').localeCompare(a.foundDate || '')));
            toast({ title: t('success'), description: t('lost_and_found.add.success') });
            setNewItem({ foundDate: format(new Date(), 'yyyy-MM-dd'), status: 'unclaimed' });
            setAddDialogOpen(false);
        } catch (error) {
            toast({ title: t('error'), description: t('lost_and_found.add.error'), variant: 'destructive' });
        }
    };

    const handleViewImage = (url: string) => {
        setImageToView(url);
        setViewImageDialogOpen(true);
    };

    const handleToggleStatus = async (item: LostItem) => {
        const newStatus = item.status === 'claimed' ? 'unclaimed' : 'claimed';
        try {
            await updateLostItem(item.id, { status: newStatus });
            setLostItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
            toast({ title: t('success'), description: t('lost_and_found.status_change.success', { status: t(`lost_and_found.action.${newStatus === 'claimed' ? 'claim' : 'unclaim'}`)}) });
        } catch (error) {
            toast({ title: t('error'), description: t('lost_and_found.status_change.error'), variant: 'destructive' });
        }
    }
    
    const handleAcknowledge = async (item: LostItem) => {
        if (item.status !== 'unclaimed') return;
         try {
            await updateLostItem(item.id, { status: 'acknowledged' });
            setLostItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'acknowledged' } : i));
            toast({ title: t('success'), description: t('lost_and_found.acknowledge.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('lost_and_found.acknowledge.error'), variant: 'destructive' });
        }
    }

    const handleDeleteItem = async (itemId: string) => {
        try {
            await deleteLostItem(itemId);
            setLostItems(prev => prev.filter(i => i.id !== itemId));
            toast({ title: t('success'), description: t('lost_and_found.delete.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('lost_and_found.delete.error'), variant: 'destructive' });
        }
    }

    const getBusName = (busId?: string | null) => buses.find(b => b.id === busId)?.name || 'N/A';
    
    const sortedItems = useMemo(() => {
        return [...lostItems].sort((a, b) => (b.foundDate || '').localeCompare(a.foundDate || ''));
    }, [lostItems]);
    
    const getStatusVariant = (status: LostItem['status']): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'claimed':
                return 'secondary';
            case 'unclaimed':
                return 'default';
            case 'acknowledged':
                return 'destructive'; // Using destructive for yellow/attention
            default:
                return 'default';
        }
    }
    const getStatusText = (status: LostItem['status']): string => {
        switch (status) {
            case 'claimed':
                return t('lost_and_found.status.claimed');
            case 'unclaimed':
                return t('lost_and_found.status.unclaimed');
            case 'acknowledged':
                return t('lost_and_found.status.acknowledged');
            default:
                return t('lost_and_found.status.unknown');
        }
    }


    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>{t('lost_and_found.title')}</CardTitle>
                    <CardDescription>{t('lost_and_found.description')}</CardDescription>
                </div>
                {!isReadOnly && (
                    <Dialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2"/> {t('lost_and_found.add_button')}</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>{t('lost_and_found.add.title')}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="itemType">{t('lost_and_found.item_type')}</Label>
                                    <Input id="itemType" value={newItem.itemType || ''} onChange={e => setNewItem(p => ({...p, itemType: e.target.value}))} placeholder={t('lost_and_found.item_type_placeholder')} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="foundDate">{t('lost_and_found.found_date')}</Label>
                                    <Input id="foundDate" type="date" value={newItem.foundDate || ''} onChange={e => setNewItem(p => ({...p, foundDate: e.target.value}))} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="foundBus">{t('lost_and_found.found_bus')}</Label>
                                    <Select value={newItem.foundBusId || ''} onValueChange={v => setNewItem(p => ({...p, foundBusId: v}))}>
                                        <SelectTrigger><SelectValue placeholder={t('lost_and_found.select_bus')} /></SelectTrigger>
                                        <SelectContent>
                                            {buses.map(bus => <SelectItem key={bus.id} value={bus.id}>{bus.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('lost_and_found.photo')}</Label>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Camera className="mr-2"/> {t('lost_and_found.select_photo')}</Button>
                                        <span className="text-xs text-muted-foreground">{t('lost_and_found.photo_size_limit')}</span>
                                    </div>
                                    <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                    {newItem.itemPhotoUrl && <Image src={newItem.itemPhotoUrl} alt="Preview" width={100} height={100} className="rounded-md mt-2" />}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAddItem}>{t('add')}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('lost_and_found.table.type')}</TableHead>
                            <TableHead>{t('lost_and_found.table.found_date')}</TableHead>
                            <TableHead>{t('lost_and_found.table.found_bus')}</TableHead>
                            <TableHead>{t('lost_and_found.table.photo')}</TableHead>
                            <TableHead>{t('lost_and_found.table.status')}</TableHead>
                            <TableHead className="text-right">{t('lost_and_found.table.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedItems.map(item => (
                            <TableRow key={item.id}>
                                <TableCell>{item.itemType || 'N/A'}</TableCell>
                                <TableCell>{item.foundDate || 'N/A'}</TableCell>
                                <TableCell>{getBusName(item.foundBusId)}</TableCell>
                                <TableCell>
                                    {item.itemPhotoUrl && (
                                        <Button variant="ghost" size="icon" onClick={() => handleViewImage(item.itemPhotoUrl!)}>
                                            <Camera className="h-4 w-4"/>
                                        </Button>
                                    )}
                                </TableCell>
                                <TableCell>
                                     <Badge variant={getStatusVariant(item.status)} 
                                        className={cn(item.status === 'acknowledged' && 'bg-yellow-500 text-white hover:bg-yellow-500/80')}>
                                        {getStatusText(item.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right space-x-1">
                                    {isReadOnly && item.status === 'unclaimed' && (
                                         <Button variant="outline" size="sm" onClick={() => handleAcknowledge(item)}>
                                           <CheckCircle className="mr-1 h-3 w-3"/> {t('lost_and_found.action.acknowledge')}
                                        </Button>
                                    )}
                                    {!isReadOnly && (
                                        <>
                                            <Button variant="outline" size="sm" onClick={() => handleToggleStatus(item)}>
                                               <Undo2 className="mr-1 h-3 w-3"/> {item.status === 'claimed' ? t('lost_and_found.action.unclaim') : t('lost_and_found.action.claim')}
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>{t('lost_and_found.delete.confirm_title')}</AlertDialogTitle>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteItem(item.id)}>{t('delete')}</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 {sortedItems.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        {t('lost_and_found.no_items')}
                    </div>
                )}
            </CardContent>

            <Dialog open={isViewImageDialogOpen} onOpenChange={setViewImageDialogOpen}>
                <DialogContent className="max-w-3xl">
                     <DialogHeader>
                        <DialogTitle>{t('lost_and_found.view_photo_title')}</DialogTitle>
                    </DialogHeader>
                    {imageToView && <Image src={imageToView} alt="Lost Item" width={800} height={600} style={{width: '100%', height: 'auto'}} className="rounded-md" />}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
