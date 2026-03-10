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
import { UserPlus, Bus, Clock, Plus, Trash2, Users } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Combobox } from '@/components/ui/combobox';
import { useTranslation } from '@/hooks/use-translation';

const daysOfWeek: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface SiblingEntry {
    name: string;
    grade: string;
    studentClass: string;
    gender: 'Male' | 'Female';
}

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
    
    // Main student state
    const [name, setName] = useState('');
    const [grade, setGrade] = useState('');
    const [studentClass, setStudentClass] = useState('');
    const [gender, setGender] = useState<'Male' | 'Female'>('Male');
    const [contact, setContact] = useState('');
    
    // Sibling state
    const [hasSiblings, setHasSiblings] = useState(false);
    const [siblings, setSiblings] = useState<SiblingEntry[]>([]);

    const [morningDestinationId, setMorningDestinationId] = useState<string | null>(null);
    const [useCustomMorningDest, setUseCustomMorningDest] = useState(false);
    const [customMorningDestName, setCustomMorningDestName] = useState('');

    const [afternoonDestinationId, setAfternoonDestinationId] = useState<string | null>(null);
    const [useCustomAfternoonDest, setUseCustomAfternoonDest] = useState(false);
    const [customAfternoonDestName, setCustomAfternoonDestName] = useState('');

    const [afterSchoolDays, setAfterSchoolDays] = useState<Partial<Record<DayOfWeek, boolean>>>({});
    
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

    const handleAddSibling = () => {
        setSiblings([...siblings, { name: '', grade: '', studentClass: '', gender: 'Male' }]);
    };

    const handleRemoveSibling = (index: number) => {
        setSiblings(siblings.filter((_, i) => i !== index));
    };

    const updateSibling = (index: number, field: keyof SiblingEntry, value: string) => {
        const newSiblings = [...siblings];
        newSiblings[index] = { ...newSiblings[index], [field]: value } as SiblingEntry;
        setSiblings(newSiblings);
    };

    const validateAllStudents = () => {
        // Validate main student
        if (!name.trim() || !grade.trim() || !studentClass.trim() || !gender) {
            toast({ title: t('error'), description: t('apply.validation.base_info_error'), variant: "destructive" });
            return false;
        }
        
        // Validate siblings
        if (hasSiblings) {
            for (let i = 0; i < siblings.length; i++) {
                const s = siblings[i];
                if (!s.name.trim() || !s.grade.trim() || !s.studentClass.trim() || !s.gender) {
                    toast({ title: t('error'), description: t('apply.validation.sibling_info_error', { index: i + 1 }), variant: "destructive" });
                    return false;
                }
            }
        }
        return true;
    }

    const findStudentInList = (sName: string, sGrade: string, sClass: string): Student | undefined => {
        return allStudents.find(s => 
            s.name === sName.trim() && 
            s.grade === sGrade.trim() && 
            s.class === sClass.trim()
        );
    }
    
    const processStudentApplication = async (studentData: {name: string, grade: string, studentClass: string, gender: 'Male'|'Female', contact: string, siblingGroupId?: string | null}, appData: Partial<Student>) => {
        const existingStudent = findStudentInList(studentData.name, studentData.grade, studentData.studentClass);
        
        if (existingStudent) {
            const updatePayload = {
                ...appData,
                name: studentData.name.trim(),
                grade: studentData.grade.trim(),
                class: studentData.studentClass.trim(),
                gender: studentData.gender,
                contact: studentData.contact.trim(),
                applicationStatus: 'pending' as const,
                siblingGroupId: studentData.siblingGroupId || existingStudent.siblingGroupId
            };
            await updateStudent(existingStudent.id, updatePayload);
            return existingStudent.id;
        } else {
            const newStudentPayload: NewStudent = {
                name: studentData.name.trim(),
                grade: studentData.grade.trim(),
                class: studentData.studentClass.trim(),
                gender: studentData.gender,
                contact: studentData.contact.trim(),
                morningDestinationId: appData.morningDestinationId || null,
                afternoonDestinationId: appData.afternoonDestinationId || null,
                afterSchoolDestinations: appData.afterSchoolDestinations || {},
                suggestedMorningDestination: appData.suggestedMorningDestination || null,
                suggestedAfternoonDestination: appData.suggestedAfternoonDestination || null,
                applicationStatus: 'pending',
                siblingGroupId: studentData.siblingGroupId || null
            };
            const added = await addStudent(newStudentPayload);
            return added.id;
        }
    }

    const handleMainSubmit = async () => {
        if (!validateAllStudents()) return;
        
        const hasMorningSelection = !useCustomMorningDest && morningDestinationId;
        const hasCustomMorning = useCustomMorningDest && customMorningDestName.trim();
        const hasAfternoonSelection = !useCustomAfternoonDest && afternoonDestinationId;
        const hasCustomAfternoon = useCustomAfternoonDest && customAfternoonDestName.trim();

        if (!hasMorningSelection && !hasCustomMorning && !hasAfternoonSelection && !hasCustomAfternoon) {
             toast({ title: t('error'), description: t('apply.validation.commute_dest_error'), variant: "destructive" });
            return;
        }

        let baseAppData: Partial<Student> = {
            morningDestinationId: useCustomMorningDest ? null : morningDestinationId,
            suggestedMorningDestination: useCustomMorningDest ? customMorningDestName.trim() : null,
            afternoonDestinationId: useCustomAfternoonDest ? null : afternoonDestinationId,
            suggestedAfternoonDestination: useCustomAfternoonDest ? customAfternoonDestName.trim() : null,
        };

        const siblingGroupId = hasSiblings ? `group_${Date.now()}` : null;

        try {
            // Handle custom suggestions first if any
            if (useCustomMorningDest && customMorningDestName.trim()) {
                await addSuggestedDestination({ name: customMorningDestName.trim() });
            }
            if (useCustomAfternoonDest && customAfternoonDestName.trim()) {
                await addSuggestedDestination({ name: customAfternoonDestName.trim() });
            }

            // Process Main Student
            await processStudentApplication({ name, grade, studentClass, gender, contact, siblingGroupId }, baseAppData);

            // Process Siblings
            if (hasSiblings) {
                for (const sib of siblings) {
                    await processStudentApplication({ ...sib, contact: contact, siblingGroupId }, baseAppData);
                }
            }

            toast({ 
                title: t('apply.commute.success_title'), 
                description: hasSiblings ? t('apply.commute.success_desc_multi') : t('apply.commute.success_desc', { studentName: name }) 
            });

            // Reset destinations
            setMorningDestinationId(null);
            setCustomMorningDestName('');
            setUseCustomMorningDest(false);
            setAfternoonDestinationId(null);
            setCustomAfternoonDestName('');
            setUseCustomAfternoonDest(false);
            
            // Refresh student list to reflect changes
            const freshStudents = await getStudents();
            setAllStudents(freshStudents);

        } catch (error) {
            console.error("Error submitting main application:", error);
            toast({ title: t('error'), description: t('apply.submit_error'), variant: 'destructive' });
        }
    }

    const handleAfterSchoolSubmit = async () => {
        if (!validateAllStudents()) return;
    
        // All students must have a base commute destination to apply for after-school
        // We'll check the main student and assume siblings share the logic or check them too
        const mainExisting = findStudentInList(name, grade, studentClass);
        let commuteDestinationId = mainExisting?.afternoonDestinationId || mainExisting?.morningDestinationId || afternoonDestinationId || morningDestinationId;
    
        if (!commuteDestinationId) {
            toast({ title: t('error'), description: t('apply.validation.after_school_no_base_dest'), variant: "destructive" });
            return;
        }
    
        const finalAfterSchoolDestinations: Partial<Record<DayOfWeek, string | null>> = {};
        for (const day of daysOfWeek) {
            finalAfterSchoolDestinations[day] = afterSchoolDays[day] ? commuteDestinationId : null;
        }

        const siblingGroupId = hasSiblings ? (mainExisting?.siblingGroupId || `group_${Date.now()}`) : null;
    
        try {
            // Process Main Student
            await processStudentApplication({ name, grade, studentClass, gender, contact, siblingGroupId }, { afterSchoolDestinations: finalAfterSchoolDestinations });

            // Process Siblings
            if (hasSiblings) {
                for (const sib of siblings) {
                    const sibExisting = findStudentInList(sib.name, sib.grade, sib.studentClass);
                    await processStudentApplication({ ...sib, contact: contact, siblingGroupId: siblingGroupId || sibExisting?.siblingGroupId }, { afterSchoolDestinations: finalAfterSchoolDestinations });
                }
            }

            toast({ 
                title: t('apply.after_school.success_title'), 
                description: hasSiblings ? t('apply.after_school.success_desc_multi') : t('apply.after_school.success_desc', { studentName: name }) 
            });
    
            setAfterSchoolDays({});
            const freshStudents = await getStudents();
            setAllStudents(freshStudents);
        } catch (error) {
            console.error("Error submitting after school application:", error);
            toast({ title: t('error'), description: t('apply.submit_error'), variant: 'destructive' });
        }
    }

    const handleToggleAfterSchoolDay = (day: DayOfWeek, checked: boolean) => {
        setAfterSchoolDays(prev => ({...prev, [day]: checked}));
    }

    return (
        <MainLayout>
            <div className="flex flex-col items-center gap-8 max-w-4xl mx-auto">
                <Card className="w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 font-headline">
                            <UserPlus className="text-primary" />
                            {t('apply.base_info.title')}
                        </CardTitle>
                        <CardDescription>
                            {t('apply.base_info.description')}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Main Student Form */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-muted/20 p-4 rounded-lg border">
                            <div className="space-y-2">
                                <Label htmlFor="name">{t('student.name')}</Label>
                                <Input id="name" placeholder={t('student.name_placeholder')} required value={name} onChange={e => setName(e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="contact">{t('student.contact')}</Label>
                                <Input id="contact" placeholder={t('student.contact_placeholder')} value={contact} onChange={e => setContact(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
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
                        </div>

                        {/* Sibling Toggle */}
                        <div className="flex items-center space-x-2 py-2">
                            <Checkbox 
                                id="has-siblings" 
                                checked={hasSiblings} 
                                onCheckedChange={(checked) => {
                                    setHasSiblings(checked as boolean);
                                    if (checked && siblings.length === 0) handleAddSibling();
                                }} 
                            />
                            <Label htmlFor="has-siblings" className="text-base font-semibold cursor-pointer">
                                {t('apply.siblings.checkbox')}
                            </Label>
                        </div>

                        {/* Sibling Forms */}
                        {hasSiblings && (
                            <div className="space-y-4 animate-in slide-in-from-top-2 duration-300">
                                {siblings.map((sib, index) => (
                                    <div key={index} className="relative grid grid-cols-1 sm:grid-cols-2 gap-4 bg-primary/5 p-4 rounded-lg border border-primary/20">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                                            onClick={() => handleRemoveSibling(index)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                        <div className="sm:col-span-2 flex items-center gap-2 mb-1">
                                            <Users className="h-4 w-4 text-primary" />
                                            <span className="text-sm font-bold text-primary">{t('apply.siblings.entry_title', { index: index + 1 })}</span>
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label>{t('student.name')}</Label>
                                            <Input value={sib.name} onChange={e => updateSibling(index, 'name', e.target.value)} placeholder={t('student.name_placeholder')} />
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 sm:col-span-2">
                                            <div className="space-y-2">
                                                <Label>{t('student.grade')}</Label>
                                                <Input value={sib.grade} onChange={e => updateSibling(index, 'grade', e.target.value)} placeholder={t('student.grade_placeholder')} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>{t('student.class')}</Label>
                                                <Input value={sib.studentClass} onChange={e => updateSibling(index, 'studentClass', e.target.value)} placeholder={t('student.class_placeholder')} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>{t('student.gender')}</Label>
                                                <Select value={sib.gender} onValueChange={(v) => updateSibling(index, 'gender', v)}>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Male">{t('student.male')}</SelectItem>
                                                        <SelectItem value="Female">{t('student.female')}</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <Button variant="outline" className="w-full border-dashed" onClick={handleAddSibling}>
                                    <Plus className="mr-2 h-4 w-4" /> {t('apply.siblings.add_button')}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                     <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline"><Bus className="text-primary" /> {t('apply.commute.title')}</CardTitle>
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
                                <div className="space-y-2 animate-in fade-in duration-300">
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
                                <div className="space-y-2 animate-in fade-in duration-300">
                                    <Label htmlFor="customAfternoonDestName">{t('apply.new_dest_name_afternoon')}</Label>
                                    <Input id="customAfternoonDestName" value={customAfternoonDestName} onChange={e => setCustomAfternoonDestName(e.target.value)} placeholder={t('apply.new_dest_placeholder_afternoon')} />
                                </div>
                            )}
                            
                            <Button onClick={handleMainSubmit} className="w-full mt-4" size="lg">
                                {hasSiblings ? t('apply.commute.submit_button_multi') : t('apply.commute.submit_button')}
                            </Button>
                        </CardContent>
                    </Card>
                    
                    <Card className="h-full">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 font-headline"><Clock className="text-primary" /> {t('apply.after_school.title')}</CardTitle>
                            <CardDescription>{t('apply.after_school.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t('apply.after_school.select_days')}</Label>
                                <div className="grid grid-cols-3 gap-2 p-2 bg-muted/20 rounded-md border">
                                    {daysOfWeek.map(day => (
                                        <div key={day} className="flex items-center gap-2 p-1">
                                            <Checkbox
                                                id={`day-${day}`}
                                                checked={!!afterSchoolDays[day]}
                                                onCheckedChange={(checked) => handleToggleAfterSchoolDay(day, checked as boolean)}
                                            />
                                            <Label htmlFor={`day-${day}`} className="cursor-pointer">{dayLabels[day]}</Label>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-3 bg-primary/5 border border-primary/10 rounded-md">
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    {t('apply.after_school.notice')}
                                </p>
                            </div>
                            
                            <Button 
                                onClick={handleAfterSchoolSubmit} 
                                className="w-full mt-4" 
                                size="lg"
                                disabled={Object.values(afterSchoolDays).every(v => !v)}
                            >
                                {hasSiblings ? t('apply.after_school.submit_button_multi') : t('apply.after_school.submit_button')}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}
