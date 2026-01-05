
'use client';
import React, { useMemo } from 'react';
import { GroupLeaderRecord } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Crown, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { differenceInDays, format } from 'date-fns';
import { useTranslation } from '@/hooks/use-translation';

interface GroupLeaderManagerProps {
    records: GroupLeaderRecord[];
    setRecords: React.Dispatch<React.SetStateAction<GroupLeaderRecord[]>>;
}

export function GroupLeaderManager({ records, setRecords }: GroupLeaderManagerProps) {
  const { t } = useTranslation();
  
  const handleClearAll = () => {
    setRecords([]);
  }

  const processedRecords = useMemo(() => {
    const today = new Date();
    return records.map(record => {
      if (record.endDate === null) {
        const startDate = new Date(record.startDate);
        const days = differenceInDays(today, startDate) + 1;
        return { ...record, days };
      }
      return record;
    }).sort((a, b) => {
        if (a.endDate === null) return -1;
        if (b.endDate === null) return 1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  }, [records]);


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Crown /> {t('teacher_page.group_leader_management.title')}
        </CardTitle>
        <CardDescription>
            {t('teacher_page.group_leader_management.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[40vh] overflow-y-auto">
        {processedRecords.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('teacher_page.group_leader_management.name')}</TableHead>
                <TableHead>{t('teacher_page.group_leader_management.start_date')}</TableHead>
                <TableHead>{t('teacher_page.group_leader_management.end_date')}</TableHead>
                <TableHead className="text-right">{t('teacher_page.group_leader_management.days')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedRecords.map((record) => (
                <TableRow key={record.studentId + record.startDate}>
                  <TableCell>{record.name}</TableCell>
                  <TableCell>{record.startDate}</TableCell>
                  <TableCell>
                    {record.endDate ? record.endDate : <Badge variant="secondary">{t('teacher_page.group_leader_management.active')}</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{record.days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            {t('teacher_page.group_leader_management.no_leaders')}
          </div>
        )}
      </CardContent>
      {records.length > 0 && (
         <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" /> {t('teacher_page.group_leader_management.delete_all_records')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('teacher_page.group_leader_management.delete_confirm.title')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('teacher_page.group_leader_management.delete_confirm.description')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll}>{t('delete')}</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
         </CardFooter>
      )}
    </Card>
  );
}
