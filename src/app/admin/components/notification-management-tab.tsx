'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Save, Bell, Users, GraduationCap, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { onNotificationSettingsUpdate, saveNotificationSettings } from '@/lib/firebase-data';
import type { NotificationSettings, NotificationTarget, NotificationTrigger } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

const DEFAULT_SETTINGS: NotificationSettings[] = [
    { id: 'parent-boarding', target: 'parent', trigger: 'boarding', isEnabled: true, titleTemplate: '[KIS 버스] 승차 안내', bodyTemplate: '{studentName} 학생이 {busName} 버스에 승차하였습니다. (시간: {time})', lastModified: '' },
    { id: 'parent-disembarking', target: 'parent', trigger: 'disembarking', isEnabled: true, titleTemplate: '[KIS 버스] 하차 안내', bodyTemplate: '{studentName} 학생이 {destinationName}에서 하차하였습니다. 안심하고 마중 나오세요.', lastModified: '' },
    { id: 'parent-absence', target: 'parent', trigger: 'absence', isEnabled: true, titleTemplate: '[KIS 버스] 미탑승/결석 확인', bodyTemplate: '{studentName} 학생의 미탑승(결석) 처리가 완료되었습니다. 확인 부탁드립니다.', lastModified: '' },
    { id: 'teacher-delay', target: 'teacher', trigger: 'delay', isEnabled: true, titleTemplate: '[KIS 버스] 운행 지연 알림', bodyTemplate: '{busName} 버스 운행이 지연되고 있습니다. {routeType} 노선 확인 바랍니다.', lastModified: '' },
];

export function NotificationManagementTab() {
    const [settings, setSettings] = useState<NotificationSettings[]>(DEFAULT_SETTINGS);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const unsub = onNotificationSettingsUpdate((data) => {
            if (data.length > 0) {
                // Ensure all default keys exist
                const merged = DEFAULT_SETTINGS.map(def => {
                    const found = data.find(d => d.id === def.id);
                    return found || def;
                });
                setSettings(merged);
            }
            setIsLoading(false);
        });
        return () => unsub();
    }, []);

    const handleChange = (id: string, field: keyof NotificationSettings, value: any) => {
        setSettings(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleSave = async (id: string) => {
        const setting = settings.find(s => s.id === id);
        if (!setting) return;

        try {
            await saveNotificationSettings(setting);
            toast({ title: '저장 완료', description: '알림 설정이 성공적으로 반영되었습니다.' });
        } catch (error) {
            toast({ title: '저장 실패', description: '설정 저장 중 오류가 발생했습니다.', variant: 'destructive' });
        }
    };

    const renderSettingCard = (s: NotificationSettings) => {
        const triggerLabels: Record<NotificationTrigger, string> = {
            boarding: '버스 승차 시',
            disembarking: '목적지 하차 시',
            absence: '결석/미탑승 처리 시',
            delay: '운행 지연 시'
        };

        return (
            <Card key={s.id} className="mb-6 border-slate-200 shadow-sm overflow-hidden">
                <CardHeader className="bg-slate-50/50 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-white">{triggerLabels[s.trigger]}</Badge>
                            <CardTitle className="text-lg">{s.target === 'parent' ? '학부모용 알림' : '교사용 알림'}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label htmlFor={`${s.id}-enable`} className="text-xs text-muted-foreground">자동 발송</Label>
                            <Switch 
                                id={`${s.id}-enable`} 
                                checked={s.isEnabled} 
                                onCheckedChange={(val) => handleChange(s.id, 'isEnabled', val)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <div className="space-y-2">
                        <Label>알림 제목</Label>
                        <Input 
                            value={s.titleTemplate} 
                            onChange={(e) => handleChange(s.id, 'titleTemplate', e.target.value)}
                            placeholder="알림 팝업에 표시될 제목"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>알림 내용 (템플릿)</Label>
                        <Textarea 
                            value={s.bodyTemplate} 
                            onChange={(e) => handleChange(s.id, 'bodyTemplate', e.target.value)}
                            placeholder="메시지 본문 내용을 입력하세요"
                            rows={3}
                        />
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            사용 가능 변수: {`{studentName}, {busName}, {time}, {destinationName}, {routeType}`}
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="bg-slate-50/30 border-t py-3 flex justify-end">
                    <Button size="sm" onClick={() => handleSave(s.id)}>
                        <Save className="w-4 h-4 mr-2" /> 저장하기
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex gap-3">
                <Bell className="w-5 h-5 text-sky-600 mt-0.5" />
                <div className="flex-1">
                    <h3 className="font-semibold text-sky-900 text-sm">자동 푸시 알림 설정</h3>
                    <p className="text-sky-700 text-xs mt-1 leading-relaxed">
                        버스 승/하차 및 결석 처리 시 등록된 대상에게 자동으로 앱 푸시 알림이 발송됩니다.<br/>
                        템플릿 내 변수는 실제 데이터로 자동 치환되어 전송됩니다.
                    </p>
                </div>
            </div>

            <Tabs defaultValue="parents" className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
                    <TabsTrigger value="parents" className="flex gap-2">
                        <Users className="w-4 h-4" /> 학부모 앱
                    </TabsTrigger>
                    <TabsTrigger value="teachers" className="flex gap-2">
                        <GraduationCap className="w-4 h-4" /> 교사/관리자 앱
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="parents" className="mt-6">
                    {settings.filter(s => s.target === 'parent').map(renderSettingCard)}
                </TabsContent>
                
                <TabsContent value="teachers" className="mt-6">
                    {settings.filter(s => s.target === 'teacher').map(renderSettingCard)}
                </TabsContent>
            </Tabs>
        </div>
    );
}
