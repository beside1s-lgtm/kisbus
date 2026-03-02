'use client';

import React, { useRef } from 'react';
import Papa from 'papaparse';
import { addTeachersInBatch, deleteTeacher, deleteAllTeachers } from '@/lib/firebase-data';
import type { Teacher, NewTeacher } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Upload, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from '@/hooks/use-translation';

interface TeacherManagementTabProps {
    teachers: Teacher[];
}

export const TeacherManagementTab = ({ teachers }: TeacherManagementTabProps) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();
    const { t } = useTranslation();

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
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
                    await addTeachersInBatch(newTeachersData);
                    dismiss();
                    toast({ title: t('success'), description: t('admin.teacher_management.batch.success', { count: newTeachersData.length }) });
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
    
    const handleDownloadTemplate = () => {
        const headers = "선생님 이름";
        const example = "홍길동";
        const csvContent = "data:text/csv;charset=utf-8," + "\uFEFF" + headers + "\n" + example;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "teacher_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDeleteSingleTeacher = async (id: string) => {
        try {
            await deleteTeacher(id);
            toast({ title: t('success'), description: t('admin.teacher_management.delete.success') });
        } catch (error) {
            toast({ title: t('error'), description: t('admin.teacher_management.delete.error'), variant: 'destructive' });
        }
    };

    const handleClearAllTeachers = async () => {
        try {
            await deleteAllTeachers();
            toast({ title: t('success'), description: "모든 교사 정보가 삭제되었습니다." });
        } catch (error) {
            toast({ title: t('error'), description: "교사 정보 삭제 중 오류가 발생했습니다.", variant: 'destructive' });
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
                    <Button variant="outline" onClick={handleDownloadTemplate}><Download className="mr-2" /> {t('admin.teacher_management.template')}</Button>
                    <Button variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2" /> {t('batch_upload')}</Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive"><Trash2 className="mr-2" /> {t('delete_all')}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>{t('admin.teacher_management.delete_all.confirm_title')}</AlertDialogTitle>
                                <AlertDialogDescription>{t('admin.teacher_management.delete_all.confirm_description')}</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearAllTeachers}>{t('delete')}</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".csv" className="hidden" />
                </div>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('admin.teacher_management.teacher_name')}</TableHead>
                            <TableHead className="text-right">{t('actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {teachers.map(teacher => (
                            <TableRow key={teacher.id}>
                                <TableCell>{teacher.name}</TableCell>
                                <TableCell className="text-right">
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>교사 정보를 삭제하시겠습니까?</AlertDialogTitle>
                                                <AlertDialogDescription>"{teacher.name}" 선생님의 정보가 삭제됩니다.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteSingleTeacher(teacher.id)}>{t('delete')}</AlertDialogAction>
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