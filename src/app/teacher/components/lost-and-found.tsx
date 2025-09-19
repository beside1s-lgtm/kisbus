
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
import { PlusCircle, Trash2, Camera, Undo2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addLostItem, deleteLostItem, updateLostItem } from '@/lib/firebase-data';
import { format } from 'date-fns';
import Image from 'next/image';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

interface LostAndFoundProps {
    lostItems: LostItem[];
    setLostItems: React.Dispatch<React.SetStateAction<LostItem[]>>;
    buses: Bus[];
    isReadOnly?: boolean;
}

const MAX_IMAGE_SIZE_BYTES = 1048576; // 1MB

export function LostAndFound({ lostItems, setLostItems, buses, isReadOnly = false }: LostAndFoundProps) {
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
                    title: '오류',
                    description: '이미지 파일은 1MB를 초과할 수 없습니다.',
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
            toast({ title: '오류', description: '분실물 종류 또는 사진 중 하나는 반드시 입력해야 합니다.', variant: 'destructive' });
            return;
        }

        try {
            const addedItem = await addLostItem({ ...newItem, status: 'unclaimed' } as NewLostItem);
            setLostItems(prev => [addedItem, ...prev].sort((a,b) => (b.foundDate || '').localeCompare(a.foundDate || '')));
            toast({ title: '성공', description: '분실물이 등록되었습니다.' });
            setNewItem({ foundDate: format(new Date(), 'yyyy-MM-dd'), status: 'unclaimed' });
            setAddDialogOpen(false);
        } catch (error) {
            toast({ title: '오류', description: '분실물 등록에 실패했습니다.', variant: 'destructive' });
        }
    };

    const handleViewImage = (url: string) => {
        setImageToView(url);
        setViewImageDialogOpen(true);
    };

    const handleToggleStatus = async (item: LostItem) => {
        const newStatus = item.status === 'unclaimed' ? 'claimed' : 'unclaimed';
        try {
            await updateLostItem(item.id, { status: newStatus });
            setLostItems(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
            toast({ title: '성공', description: `상태가 '${newStatus === 'claimed' ? '반환 완료' : '미반환'}'으로 변경되었습니다.` });
        } catch (error) {
            toast({ title: '오류', description: '상태 변경에 실패했습니다.', variant: 'destructive' });
        }
    }

    const handleDeleteItem = async (itemId: string) => {
        try {
            await deleteLostItem(itemId);
            setLostItems(prev => prev.filter(i => i.id !== itemId));
            toast({ title: '성공', description: '분실물 정보가 삭제되었습니다.' });
        } catch (error) {
            toast({ title: '오류', description: '삭제에 실패했습니다.', variant: 'destructive' });
        }
    }

    const getBusName = (busId?: string | null) => buses.find(b => b.id === busId)?.name || 'N/A';
    
    const sortedItems = useMemo(() => {
        return [...lostItems].sort((a, b) => (b.foundDate || '').localeCompare(a.foundDate || ''));
    }, [lostItems]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>분실물 현황</CardTitle>
                    <CardDescription>버스에서 발견된 분실물 목록입니다.</CardDescription>
                </div>
                {!isReadOnly && (
                    <Dialog open={isAddDialogOpen} onOpenChange={setAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button><PlusCircle className="mr-2"/> 분실물 추가</Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>새 분실물 등록</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="itemType">분실물 종류</Label>
                                    <Input id="itemType" value={newItem.itemType || ''} onChange={e => setNewItem(p => ({...p, itemType: e.target.value}))} placeholder="예: 파란색 물병" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="foundDate">발견 날짜</Label>
                                    <Input id="foundDate" type="date" value={newItem.foundDate || ''} onChange={e => setNewItem(p => ({...p, foundDate: e.target.value}))} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="foundBus">발견 버스</Label>
                                    <Select value={newItem.foundBusId || ''} onValueChange={v => setNewItem(p => ({...p, foundBusId: v}))}>
                                        <SelectTrigger><SelectValue placeholder="버스 선택" /></SelectTrigger>
                                        <SelectContent>
                                            {buses.map(bus => <SelectItem key={bus.id} value={bus.id}>{bus.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>사진</Label>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Camera className="mr-2"/> 사진 선택</Button>
                                        <span className="text-xs text-muted-foreground">(1MB 미만)</span>
                                    </div>
                                    <Input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                                    {newItem.itemPhotoUrl && <Image src={newItem.itemPhotoUrl} alt="Preview" width={100} height={100} className="rounded-md mt-2" />}
                                </div>
                            </div>
                            <DialogFooter>
                                <Button onClick={handleAddItem}>등록</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                )}
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>종류</TableHead>
                            <TableHead>발견 날짜</TableHead>
                            <TableHead>발견 버스</TableHead>
                            <TableHead>사진</TableHead>
                            <TableHead>상태</TableHead>
                            {!isReadOnly && <TableHead className="text-right">작업</TableHead>}
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
                                     <Badge variant={item.status === 'claimed' ? 'secondary' : 'default'}>
                                        {item.status === 'claimed' ? '반환 완료' : '미반환'}
                                    </Badge>
                                </TableCell>
                                {!isReadOnly && (
                                    <TableCell className="text-right space-x-1">
                                        <Button variant="outline" size="sm" onClick={() => handleToggleStatus(item)}>
                                           <Undo2 className="mr-1 h-3 w-3"/> {item.status === 'unclaimed' ? '반환' : '미반환'}
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>정말 이 항목을 삭제하시겠습니까?</AlertDialogTitle>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>취소</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteItem(item.id)}>삭제</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                )}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                 {sortedItems.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground py-8">
                        등록된 분실물이 없습니다.
                    </div>
                )}
            </CardContent>

            <Dialog open={isViewImageDialogOpen} onOpenChange={setViewImageDialogOpen}>
                <DialogContent className="max-w-3xl">
                     <DialogHeader>
                        <DialogTitle>분실물 사진</DialogTitle>
                    </DialogHeader>
                    {imageToView && <Image src={imageToView} alt="Lost Item" width={800} height={600} style={{width: '100%', height: 'auto'}} className="rounded-md" />}
                </DialogContent>
            </Dialog>
        </Card>
    );
}

