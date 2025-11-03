
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

interface GroupLeaderManagerProps {
    records: GroupLeaderRecord[];
    setRecords: React.Dispatch<React.SetStateAction<GroupLeaderRecord[]>>;
}

export function GroupLeaderManager({ records, setRecords }: GroupLeaderManagerProps) {
  
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
          <Crown /> 조장 관리
        </CardTitle>
        <CardDescription>
            현재 노선의 조장 임명 및 활동 이력입니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-h-[40vh] overflow-y-auto">
        {processedRecords.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>시작일</TableHead>
                <TableHead>종료일</TableHead>
                <TableHead className="text-right">일수</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedRecords.map((record) => (
                <TableRow key={record.studentId + record.startDate}>
                  <TableCell>{record.name}</TableCell>
                  <TableCell>{record.startDate}</TableCell>
                  <TableCell>
                    {record.endDate ? record.endDate : <Badge variant="secondary">활동 중</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{record.days}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-sm text-muted-foreground py-8">
            조장으로 임명된 학생이 없습니다.
          </div>
        )}
      </CardContent>
      {records.length > 0 && (
         <CardFooter>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="mr-2 h-4 w-4" /> 모든 기록 삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>정말 모든 기록을 삭제하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                    이 작업은 되돌릴 수 없습니다. 현재 노선의 모든 조장 임명 기록이 영구적으로 삭제됩니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll}>삭제</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
         </CardFooter>
      )}
    </Card>
  );
}
