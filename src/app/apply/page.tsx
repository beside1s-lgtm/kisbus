'use client';
import React, { useState, useEffect } from 'react';
import { getStudents, getDestinations, addStudent, addSuggestedDestination, updateStudent } from '@/lib/firebase-data';
import { Destination, NewStudent, Student, DayOfWeek } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Bus, Clock, Plus, Trash2, Users } from 'lucide-react';
import { MainLayout } from '@/components/layout/main-layout';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Combobox } from '@/components/ui/combobox';
import { useTranslation } from '@/hooks/use-translation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SiblingEntry {
    name: string;
    grade: string;
    studentClass: string;
    gender: 'Male' | 'Female';
}

export default function ApplyPage() {
    const { t } = useTranslation();

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

    // Saturday specific state
    const [satMorningDestinationId, setSatMorningDestinationId] = useState<string | null>(null);
    const [useCustomSatMorningDest, setUseCustomSatMorningDest] = useState(false);
    const [customSatMorningDestName, setCustomSatMorningDestName] = useState('');

    const [satAfternoonDestinationId, setSatAfternoonDestinationId] = useState<string | null>(null);
    const [useCustomSatAfternoonDest, setUseCustomSatAfternoonDest] = useState(false);
    const [customSatAfternoonDestName, setCustomSatAfternoonDestName] = useState('');

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
        if (!name.trim() || !grade.trim() || !studentClass.trim() || !gender) {
            toast({ title: t('error'), description: t('apply.validation.base_info_error'), variant: "destructive" });
            return false;
        }
        
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
                satMorningDestinationId: appData.satMorningDestinationId || null,
                satAfternoonDestinationId: appData.satAfternoonDestinationId || null,
                suggestedMorningDestination: appData.suggestedMorningDestination || null,
                suggestedAfternoonDestination: appData.suggestedAfternoonDestination || null,
                suggestedSatMorningDestination: appData.suggestedSatMorningDestination || null,
                suggestedSatAfternoonDestination: appData.suggestedSatAfternoonDestination || null,
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
            if (useCustomMorningDest && customMorningDestName.trim()) {
                await addSuggestedDestination({ name: customMorningDestName.trim() });
            }
            if (useCustomAfternoonDest && customAfternoonDestName.trim()) {
                await addSuggestedDestination({ name: customAfternoonDestName.trim() });
            }

            await processStudentApplication({ name, grade, studentClass, gender, contact, siblingGroupId }, baseAppData);

            if (hasSiblings) {
                for (const sib of siblings) {
                    await processStudentApplication({ ...sib, contact: contact, siblingGroupId }, baseAppData);
                }
            }

            toast({ 
                title: t('apply.commute.success_title'), 
                description: hasSiblings ? t('apply.commute.success_desc_multi') : t('apply.commute.success_desc', { studentName: name }) 
            });

            setMorningDestinationId(null);
            setCustomMorningDestName('');
            setUseCustomMorningDest(false);
            setAfternoonDestinationId(null);
            setCustomAfternoonDestName('');
            setUseCustomAfternoonDest(false);
            
            const freshStudents = await getStudents();
            setAllStudents(freshStudents);

        } catch (error) {
            console.error("Error submitting main application:", error);
            toast({ title: t('error'), description: t('apply.submit_error'), variant: 'destructive' });
        }
    }

    const handleSatSubmit = async () => {
        if (!validateAllStudents()) return;
    
        const hasSatMorning = !useCustomSatMorningDest && satMorningDestinationId;
        const hasCustomSatMorning = useCustomSatMorningDest && customSatMorningDestName.trim();
        const hasSatAfternoon = !useCustomSatAfternoonDest && satAfternoonDestinationId;
        const hasCustomSatAfternoon = useCustomSatAfternoonDest && customSatAfternoonDestName.trim();

        if (!hasSatMorning && !hasCustomSatMorning && !hasSatAfternoon && !hasCustomSatAfternoon) {
            toast({ title: t('error'), description: "토요일 등교 또는 하교 목적지를 선택하거나 입력해주세요.", variant: "destructive" });
            return;
        }

        let satAppData: Partial<Student> = {
            satMorningDestinationId: useCustomSatMorningDest ? null : satMorningDestinationId,
            suggestedSatMorningDestination: useCustomSatMorningDest ? customSatMorningDestName.trim() : null,
            satAfternoonDestinationId: useCustomSatAfternoonDest ? null : satAfternoonDestinationId,
            suggestedSatAfternoonDestination: useCustomSatAfternoonDest ? customSatAfternoonDestName.trim() : null,
        };

        const mainExisting = findStudentInList(name, grade, studentClass);
        const siblingGroupId = hasSiblings ? (mainExisting?.siblingGroupId || `group_${Date.now()}`) : null;
    
        try {
            if (useCustomSatMorningDest && customSatMorningDestName.trim()) {
                await addSuggestedDestination({ name: customSatMorningDestName.trim() });
            }
            if (useCustomSatAfternoonDest && customSatAfternoonDestName.trim()) {
                await addSuggestedDestination({ name: customSatAfternoonDestName.trim() });
            }

            await processStudentApplication({ name, grade, studentClass, gender, contact, siblingGroupId }, satAppData);

            if (hasSiblings) {
                for (const sib of siblings) {
                    await processStudentApplication({ ...sib, contact: contact, siblingGroupId }, satAppData);
                }
            }

            toast({ 
                title: t('apply.sat_after_school.success_title'), 
                description: hasSiblings ? t('apply.sat_after_school.success_desc_multi') : t('apply.sat_after_school.success_desc', { studentName: name }) 
            });
    
            setSatMorningDestinationId(null);
            setCustomSatMorningDestName('');
            setUseCustomSatMorningDest(false);
            setSatAfternoonDestinationId(null);
            setCustomSatAfternoonDestName('');
            setUseCustomSatAfternoonDest(false);

            const freshStudents = await getStudents();
            setAllStudents(freshStudents);
        } catch (error) {
            console.error("Error submitting saturday application:", error);
            toast({ title: t('error'), description: t('apply.submit_error'), variant: 'destructive' });
        }
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
                            <CardTitle className="flex items-center gap-2 font-headline"><Clock className="text-primary" /> {t('apply.sat_after_school.title')}</CardTitle>
                            <CardDescription>{t('apply.sat_after_school.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="satMorningDestinationId">{t('student.sat_morning_destination')}</Label>
                                <Combobox 
                                    options={destinationOptions}
                                    value={satMorningDestinationId}
                                    onSelect={setSatMorningDestinationId}
                                    placeholder={t('select_or_search_destination')}
                                    disabled={useCustomSatMorningDest}
                                />
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="useCustomSatMorningDest" checked={useCustomSatMorningDest} onCheckedChange={(checked) => setUseCustomSatMorningDest(checked as boolean)} />
                                <label htmlFor="useCustomSatMorningDest" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {t('apply.custom_dest_prompt_sat_morning')}
                                </label>
                            </div>
                            {useCustomSatMorningDest && (
                                <div className="space-y-2 animate-in fade-in duration-300">
                                    <Label htmlFor="customSatMorningDestName">{t('apply.new_dest_name_morning')}</Label>
                                    <Input id="customSatMorningDestName" value={customSatMorningDestName} onChange={e => setCustomSatMorningDestName(e.target.value)} placeholder={t('apply.new_dest_placeholder_morning')} />
                                </div>
                            )}
                            
                            <Separator />

                            <div className="space-y-2">
                                <Label htmlFor="satAfternoonDestinationId">{t('student.sat_afternoon_destination')}</Label>
                                <Combobox 
                                    options={destinationOptions}
                                    value={satAfternoonDestinationId}
                                    onSelect={setSatAfternoonDestinationId}
                                    placeholder={t('select_or_search_destination')}
                                    disabled={useCustomSatAfternoonDest}
                                />
                            </div>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="useCustomSatAfternoonDest" checked={useCustomSatAfternoonDest} onCheckedChange={(checked) => setUseCustomSatAfternoonDest(checked as boolean)} />
                                <label htmlFor="useCustomSatAfternoonDest" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                    {t('apply.custom_dest_prompt_sat_afternoon')}
                                </label>
                            </div>
                            {useCustomSatAfternoonDest && (
                                <div className="space-y-2 animate-in fade-in duration-300">
                                    <Label htmlFor="customSatAfternoonDestName">{t('apply.new_dest_name_afternoon')}</Label>
                                    <Input id="customSatAfternoonDestName" value={customSatAfternoonDestName} onChange={e => setCustomSatAfternoonDestName(e.target.value)} placeholder={t('apply.new_dest_placeholder_afternoon')} />
                                </div>
                            )}
                            
                            <Button onClick={handleSatSubmit} className="w-full mt-4" size="lg">
                                {hasSiblings ? t('apply.sat_after_school.submit_button_multi') : t('apply.sat_after_school.submit_button')}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </MainLayout>
    );
}
