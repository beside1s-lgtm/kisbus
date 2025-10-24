
'use client';
import React, { useState, useEffect } from 'react';
import { getStudents, getDestinations, addStudent, addSuggestedDestination, updateStudent } from '@/lib/firebase-data';
import { Destination, NewStudent, Student, DayOfWeek } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Bus, Clock } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Combobox } from '@/components/ui/combobox';
import { useTranslation } from '@/hooks/use-translation';

const daysOfWeek: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function ApplyPage() {
    const { t } = useTranslation();
    const dayLabels: Record<DayOfWeek, string> = {
        Monday: t('day_short.monday'),
        Tuesday: t('day_short.tuesday'),
        Wednesday: t('day_short.wednesday'),
        Thursday: t('day_short.thursday'),
        Friday: t('day_short.friday'),
        Saturday: t('day_short.saturday'),
    };

    const [destinations, setDestinations] = useState<Destination[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    
    const [name, setName] = useState('');
    const [grade, setGrade] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [gender, setGender] = useState<'Male' | 'Female'>('Male');
    
    const [morningDestinationId, setMorningDestinationId] = useState<string | null>(null);
    const [useCustomMorningDest, setUseCustomMorningDest] = useState(false);
    const [customMorningDestName, setCustomMorningDestName] = useState('');

    const [afternoonDestinationId, setAfternoonDestinationId] = useState<string | null>(null);
    const [useCustomAfternoonDest, setUseCustomAfternoonDest] = useState(false);
    const [customAfternoonDestName, setCustomAfternoonDestName] = useState('');

    const [afterSchoolDays, setAfterSchoolDays] = useState<Partial<Record<DayOfWeek, boolean>>>({});
    const [afterSchoolDestinations, setAfterSchoolDestinations] = useState<Partial<Record<DayOfWeek, string | null>>>({});
    const [useCustomAfterSchoolDests, setUseCustomAfterSchoolDests] = useState<Partial<Record<DayOfWeek, boolean>>>({});
    const [customAfterSchoolDestNames, setCustomAfterSchoolDestNames] = useState<Partial<Record<DayOfWeek, string>>>({});

    const { toast } = useToast();

    useEffect(() => {
        const fetchData = async () => {
            const [destinationsData, studentsData] = await Promise.all([
                getDestinations(),
                getStudents()
            ]);
            destinationsData.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
            setDestinations(destinationsData);
            setAllStudents(studentsData);
        };
        fetchData();
    }, []);

    const destinationOptions = destinations.map(d => ({ value: d.id, label: d.name }));

    const validateBaseInfo = () => {
        if (!name.trim() || !grade.trim() || !studentClass.trim() || !gender) {
            toast({ title: t('error'), description: t('apply.validation.base_info_error'), variant: "destructive" });
            return false;
        }
        return true;
    }

    const findExistingStudent = (): Student | undefined => {
        return allStudents.find(s => 
            s.name === name.trim() && 
            s.grade === grade.trim() && 
            s.class === studentClass.trim()
        );
    }
    
    const handleMainSubmit = async () => {
        if (!validateBaseInfo()) return;
        
        const hasMorningSelection = !useCustomMorningDest && morningDestinationId;
        const hasCustomMorning = useCustomMorningDest && customMorningDestName.trim();
        const hasAfternoonSelection = !useCustomAfternoonDest && afternoonDestinationId;
        const hasCustomAfternoon = useCustomAfternoonDest && customAfternoonDestName.trim();

        if (!hasMorningSelection && !hasCustomMorning && !hasAfternoonSelection && !hasCustomAfternoon) {
             toast({ title: t('error'), description: t('apply.validation.commute_dest_error'), variant: "destructive" });
            return;
        }

        const existingStudent = findExistingStudent();
        let updateData: Partial<Student> = { 
            applicationStatus: 'pending',
            ...existingStudent,
            name: name.trim(),
            grade: grade.trim(),
            class: studentClass.trim(),
            gender,
        };
        
        try {
            if (useCustomMorningDest && customMorningDestName.trim()) {
                await addSuggestedDestination({ name: customMorningDestName.trim() });
                toast({ title: t('apply.suggestion_submitted'), description: t('apply.suggestion_submitted_desc', { destName: customMorningDestName.trim() }) });
                updateData.suggestedMorningDestination = customMorningDestName.trim();
                updateData.morningDestinationId = null;
            } else {
                updateData.morningDestinationId = morningDestinationId;
                updateData.suggestedMorningDestination = null;
            }

            if (useCustomAfternoonDest && customAfternoonDestName.trim()) {
                await addSuggestedDestination({ name: customAfternoonDestName.trim() });
                toast({ title: t('apply.suggestion_submitted'), description: t('apply.suggestion_submitted_desc', { destName: customAfternoonDestName.trim() }) });
                updateData.suggestedAfternoonDestination = customAfternoonDestName.trim();
                updateData.afternoonDestinationId = null;
            } else {
                updateData.afternoonDestinationId = afternoonDestinationId;
                updateData.suggestedAfternoonDestination = null;
            }
        } catch(e) {
            toast({ title: t('error'), description: t('apply.suggestion_error'), variant: "destructive" });
            return;
        }

        try {
            if (existingStudent) {
                await updateStudent(existingStudent.id, updateData);
                setAllStudents(prevStudents => prevStudents.map(s => s.id === existingStudent.id ? { ...s, ...updateData } : s));
            } else {
                const newStudentData: NewStudent = {
                    name: name.trim(),
                    grade: grade.trim(),
                    class: studentClass.trim(),
                    gender,
                    morningDestinationId: updateData.morningDestinationId || null,
                    afternoonDestinationId: updateData.afternoonDestinationId || null,
                    afterSchoolDestinations: existingStudent?.afterSchoolDestinations || {},
                    suggestedMorningDestination: updateData.suggestedMorningDestination || null,
                    suggestedAfternoonDestination: updateData.suggestedAfternoonDestination || null,
                    applicationStatus: 'pending',
                };
                const addedStudent = await addStudent(newStudentData);
                setAllStudents(prevStudents => [...prevStudents, addedStudent]);
            }
            toast({ title: t('apply.commute.success_title'), description: t('apply.commute.success_desc', { studentName: name }) });
            setMorningDestinationId(null);
            setCustomMorningDestName('');
            setUseCustomMorningDest(false);
            setAfternoonDestinationId(null);
            setCustomAfternoonDestName('');
            setUseCustomAfternoonDest(false);

        } catch (error) {
            console.error("Error submitting main application:", error);
            toast({ title: t('error'), description: t('apply.submit_error'), variant: 'destructive' });
        }
    }

    const handleAfterSchoolSubmit = async () => {
        if (!validateBaseInfo()) return;

        const existingStudent = findExistingStudent();
        let finalDestinations: Partial<Record<DayOfWeek, string | null>> = existingStudent?.afterSchoolDestinations || {};
        let finalSuggestedDests: Partial<Record<DayOfWeek, string | null>> = existingStudent?.suggestedAfterSchoolDestinations || {};

        let hasError = false;
        const suggestionPromises = [];

        for (const day of daysOfWeek) {
            if (afterSchoolDays[day]) {
                const isCustom = useCustomAfterSchoolDests[day];
                const customName = customAfterSchoolDestNames[day]?.trim();
                const selectedId = afterSchoolDestinations[day];

                if (!isCustom && !selectedId) {
                    toast({ title: t('error'), description: t('apply.validation.after_school_dest_error', { day: dayLabels[day] }), variant: "destructive" });
                    hasError = true;
                    break;
                }
                if (isCustom && !customName) {
                    toast({ title: t('error'), description: t('apply.validation.after_school_custom_dest_error', { day: dayLabels[day] }), variant: "destructive" });
                    hasError = true;
                    break;
                }
                if (isCustom && customName) {
                    suggestionPromises.push(addSuggestedDestination({ name: customName }));
                    finalDestinations[day] = null;
                    finalSuggestedDests[day] = customName;
                } else {
                    finalDestinations[day] = selectedId || null;
                    finalSuggestedDests[day] = null;
                }
            } else {
                 finalDestinations[day] = finalDestinations[day] !== undefined ? finalDestinations[day] : null;
                 finalSuggestedDests[day] = finalSuggestedDests[day] !== undefined ? finalSuggestedDests[day] : null;
            }
        }
        if (hasError) return;
        
        try {
            await Promise.all(suggestionPromises);
            if (suggestionPromises.length > 0) {
                 toast({ title: t('apply.suggestion_submitted'), description: t('apply.after_school_suggestion_submitted_desc') });
            }
        } catch(e) {
            toast({ title: t('error'), description: t('apply.after_school_suggestion_error'), variant: "destructive" });
            return;
        }

        const updateData: Partial<Student> = { 
            ...existingStudent,
            name: name.trim(),
            grade: grade.trim(),
            class: studentClass.trim(),
            gender,
            afterSchoolDestinations: finalDestinations,
            suggestedAfterSchoolDestinations: finalSuggestedDests,
            applicationStatus: 'pending'
        };

         try {
            if (existingStudent) {
                await updateStudent(existingStudent.id, updateData);
                setAllStudents(prevStudents => prevStudents.map(s => s.id === existingStudent.id ? { ...s, ...updateData } : s));
            } else {
                 const newStudentData: NewStudent = {
                    name: name.trim(),
                    grade: grade.trim(),
                    class: studentClass.trim(),
                    gender,
                    morningDestinationId: existingStudent?.morningDestinationId || null,
                    afternoonDestinationId: existingStudent?.afternoonDestinationId || null,
                    afterSchoolDestinations: finalDestinations,
                    suggestedAfterSchoolDestinations: finalSuggestedDests,
                    applicationStatus: 'pending'
                };
                const addedStudent = await addStudent(newStudentData);
                setAllStudents(prevStudents => [...prevStudents, addedStudent]);
            }
            toast({ title: t('apply.after_school.success_title'), description: t('apply.after_school.success_desc', { studentName: name }) });

            setAfterSchoolDays({});
            setAfterSchoolDestinations({});
            setUseCustomAfterSchoolDests({});
            setCustomAfterSchoolDestNames({});

        } catch (error) {
            console.error("Error submitting after school application:", error);
            toast({ title: t('error'), description: t('apply.submit_error'), variant: 'destructive' });
        }
    }


    const handleToggleAfterSchoolDay = (day: DayOfWeek, checked: boolean) => {
        setAfterSchoolDays(prev => ({...prev, [day]: checked}));
        if (!checked) {
            setAfterSchoolDestinations(prev => ({...prev, [day]: null}));
            setUseCustomAfterSchoolDests(prev => ({...prev, [day]: false}));
            setCustomAfterSchoolDestNames(prev => ({...prev, [day]: ''}));
        }
    }

    return (
        <MainLayout>
            <div className="flex flex-col items-center gap-8">
                <Card className="w-full max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline">
                            <UserPlus />
                            {t('apply.base_info.title')}
                        </CardTitle>
                        <CardDescription>
                            {t('apply.base_info.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">{t('student.name')}</Label>
                                <Input id="name" placeholder={t('student.name_placeholder')} required value={name} onChange={e => setName(e.target.value)} />
                            </div>
                        </div>
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="grade">{t('student.grade')}</Label>
                                <Input id="grade" placeholder={t('student.grade_placeholder')} required value={grade} onChange={e => setGrade(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="class">{t('student.class')}</Label>
                                <Input id="class" placeholder={t('student.class_placeholder')} required value={studentClass} onChange={e => setStudentClass(e.target.value)}/>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender">{t('student.gender')}</Label>
                                <Select required value={gender} onValueChange={(v) => setGender(v as 'Male' | 'Female')}>
                                    <SelectTrigger id="gender">
                                        <SelectValue placeholder={t('student.select_gender')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">{t('student.male')}</SelectItem>
                                        <SelectItem value="Female">{t('student.female')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="w-full max-w-2xl grid grid-cols-1 md:grid-cols-2 gap-8">
                     <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline"><Bus /> {t('apply.commute.title')}</CardTitle>
                             <CardDescription>{t('apply.commute.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="space-y-2">
                                <Label htmlFor="morningDestinationId">{t('student.morning_destination')}</Label>
                                <Combobox 
                                    options={destinationOptions}
                                    value={morningDestinationId}
                                    onSelect={setMorningDestinationId}
                                    placeholder={t('select_or_search_destination')}
                                    disabled={useCustomMorningDest}
                                />
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="useCustomMorningDest" checked={useCustomMorningDest} onCheckedChange={(checked) => setUseCustomMorningDest(checked as boolean)} />
                                <label htmlFor="useCustomMorningDest" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {t('apply.custom_dest_prompt_morning')}
                                </label>
                            </div>
                            {useCustomMorningDest && (
                                <div className="space-y-2">
                                    <Label htmlFor="customMorningDestName">{t('apply.new_dest_name_morning')}</Label>
                                    <Input id="customMorningDestName" value={customMorningDestName} onChange={e => setCustomMorningDestName(e.target.value)} placeholder={t('apply.new_dest_placeholder_morning')} />
                                </div>
                            )}
                            
                            <Separator />

                            <div className="space-y-2">
                                <Label htmlFor="afternoonDestinationId">{t('student.afternoon_destination')}</Label>
                                <Combobox 
                                    options={destinationOptions}
                                    value={afternoonDestinationId}
                                    onSelect={setAfternoonDestinationId}
                                    placeholder={t('select_or_search_destination')}
                                    disabled={useCustomAfternoonDest}
                                />
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="useCustomAfternoonDest" checked={useCustomAfternoonDest} onCheckedChange={(checked) => setUseCustomAfternoonDest(checked as boolean)} />
                                <label htmlFor="useCustomAfternoonDest" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {t('apply.custom_dest_prompt_afternoon')}
                                </label>
                            </div>
                            {useCustomAfternoonDest && (
                                <div className="space-y-2">
                                    <Label htmlFor="customAfternoonDestName">{t('apply.new_dest_name_afternoon')}</Label>
                                    <Input id="customAfternoonDestName" value={customAfternoonDestName} onChange={e => setCustomAfternoonDestName(e.target.value)} placeholder={t('apply.new_dest_placeholder_afternoon')} />
                                </div>
                            )}
                            
                            <Button onClick={handleMainSubmit} className="w-full">{t('apply.commute.submit_button')}</Button>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline"><Clock /> {t('apply.after_school.title')}</CardTitle>
                            <CardDescription>{t('apply.after_school.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('apply.after_school.select_days')}</Label>
                                <div className="flex flex-wrap gap-2">
                                    {daysOfWeek.map(day => (
                                        <div key={day} className="flex items-center gap-1">
                                            <Checkbox
                                                id={`day-${day}`}
                                                checked={!!afterSchoolDays[day]}
                                                onCheckedChange={(checked) => handleToggleAfterSchoolDay(day, checked as boolean)}
                                            />
                                            <Label htmlFor={`day-${day}`}>{dayLabels[day]}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            {daysOfWeek.map(day => afterSchoolDays[day] && (
                                <div key={day} className="p-3 border rounded-md space-y-3">
                                    <Label className="font-semibold">{t('apply.after_school.dest_for_day', { day: dayLabels[day] })}</Label>
                                     <Combobox 
                                        options={destinationOptions}
                                        value={afterSchoolDestinations[day]}
                                        onSelect={(value) => setAfterSchoolDestinations(prev => ({...prev, [day]: value}))}
                                        placeholder={t('select_or_search_destination')}
                                        disabled={!!useCustomAfterSchoolDests[day]}
                                    />
                                     <div className="flex items-center space-x-2">
                                        <Checkbox 
                                            id={`custom-day-${day}`}
                                            checked={!!useCustomAfterSchoolDests[day]}
                                            onCheckedChange={(checked) => setUseCustomAfterSchoolDests(prev => ({...prev, [day]: checked as boolean}))}
                                        />
                                        <label htmlFor={`custom-day-${day}`} className="text-sm font-medium">{t('apply.custom_dest_prompt_short')}</label>
                                    </div>
                                    {useCustomAfterSchoolDests[day] && (
                                        <Input
                                            value={customAfterSchoolDestNames[day] || ''}
                                            onChange={(e) => setCustomAfterSchoolDestNames(prev => ({...prev, [day]: e.target.value}))}
                                            placeholder={t('apply.new_after_school_dest_placeholder')}
                                        />
                                    )}
                                </div>
                            ))}
                            
                            <Button onClick={handleAfterSchoolSubmit} className="w-full" disabled={Object.values(afterSchoolDays).every(v => !v)}>{t('apply.after_school.submit_button')}</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}
