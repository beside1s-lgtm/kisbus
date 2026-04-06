import { db } from '../firebase';
import { doc, deleteDoc, writeBatch, collection, getDocs, updateDoc } from 'firebase/firestore';
import type { Teacher, NewTeacher } from '../types';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { sanitizeDataForSystem } from '../utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export const getTeachers = () => fetchCollection<Teacher>('teachers');
export const onTeachersUpdate = (callback: (teachers: Teacher[]) => void) => onCollectionUpdate<Teacher>('teachers', callback);
export const addTeacher = (teacher: NewTeacher) => addDocument<Teacher>('teachers', { ...teacher, name: sanitizeDataForSystem(teacher.name) });

export const getAfterSchoolTeachers = () => fetchCollection<Teacher>('afterSchoolTeachers');
export const onAfterSchoolTeachersUpdate = (callback: (teachers: Teacher[]) => void) => onCollectionUpdate<Teacher>('afterSchoolTeachers', callback);
export const addAfterSchoolTeacher = (teacher: NewTeacher) => addDocument<Teacher>('afterSchoolTeachers', { ...teacher, name: sanitizeDataForSystem(teacher.name) });

export const getSaturdayTeachers = () => fetchCollection<Teacher>('saturdayTeachers');
export const onSaturdayTeachersUpdate = (callback: (teachers: Teacher[]) => void) => onCollectionUpdate<Teacher>('saturdayTeachers', callback);
export const addSaturdayTeacher = (teacher: NewTeacher) => addDocument<Teacher>('saturdayTeachers', { ...teacher, name: sanitizeDataForSystem(teacher.name) });

export const updateTeacher = async (id: string, data: Partial<Teacher>) => {
    const docRef = doc(db, 'teachers', id);
    await updateDoc(docRef, data).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const updateAfterSchoolTeacher = async (id: string, data: Partial<Teacher>) => {
    const docRef = doc(db, 'afterSchoolTeachers', id);
    await updateDoc(docRef, data).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const updateSaturdayTeacher = async (id: string, data: Partial<Teacher>) => {
    const docRef = doc(db, 'saturdayTeachers', id);
    await updateDoc(docRef, data).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteTeacher = (id: string) => deleteDoc(doc(db, 'teachers', id)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/teachers/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});

export const deleteAfterSchoolTeacher = (id: string) => deleteDoc(doc(db, 'afterSchoolTeachers', id)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/afterSchoolTeachers/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});

export const deleteSaturdayTeacher = (id: string) => deleteDoc(doc(db, 'saturdayTeachers', id)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/saturdayTeachers/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});

export const addTeachersInBatch = async (teachers: Omit<Teacher, 'id'>[]) => {
    const batch = writeBatch(db);
    teachers.forEach(teacher => {
        const { afterSchoolDays, ...rest } = teacher;
        const data: any = { ...rest, name: sanitizeDataForSystem(teacher.name) };
        if (afterSchoolDays !== undefined) data.afterSchoolDays = afterSchoolDays;
        batch.set(doc(collection(db, 'teachers')), data);
    });
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/teachers', operation: 'create' } satisfies SecurityRuleContext));
        throw serverError;
    });
};

export const deleteTeachersInBatch = async (ids: string[]) => {
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, 'teachers', id)));
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/teachers', operation: 'delete' } satisfies SecurityRuleContext));
        throw serverError;
    });
};

export const addAfterSchoolTeachersInBatch = async (teachers: Omit<Teacher, 'id'>[]) => {
    const batch = writeBatch(db);
    teachers.forEach(teacher => {
        const { afterSchoolDays, ...rest } = teacher;
        const data: any = { ...rest, name: sanitizeDataForSystem(teacher.name) };
        if (afterSchoolDays !== undefined) data.afterSchoolDays = afterSchoolDays;
        batch.set(doc(collection(db, 'afterSchoolTeachers')), data);
    });
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/afterSchoolTeachers', operation: 'create' } satisfies SecurityRuleContext));
        throw serverError;
    });
};

export const addSaturdayTeachersInBatch = async (teachers: Omit<Teacher, 'id'>[]) => {
    const batch = writeBatch(db);
    teachers.forEach(teacher => {
        const { afterSchoolDays, ...rest } = teacher;
        const data: any = { ...rest, name: sanitizeDataForSystem(teacher.name) };
        if (afterSchoolDays !== undefined) data.afterSchoolDays = afterSchoolDays;
        batch.set(doc(collection(db, 'saturdayTeachers')), data);
    });
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/saturdayTeachers', operation: 'create' } satisfies SecurityRuleContext));
        throw serverError;
    });
};

export const deleteAfterSchoolTeachersInBatch = async (ids: string[]) => {
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, 'afterSchoolTeachers', id)));
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/afterSchoolTeachers', operation: 'delete' } satisfies SecurityRuleContext));
        throw serverError;
    });
};

export const deleteSaturdayTeachersInBatch = async (ids: string[]) => {
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, 'saturdayTeachers', id)));
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/saturdayTeachers', operation: 'delete' } satisfies SecurityRuleContext));
        throw serverError;
    });
};

export const clearTeachers = async () => {
    const snapshot = await getDocs(collection(db, 'teachers'));
    if (snapshot.empty) return;
    
    // Process in chunks of 500
    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit().catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({ path: `/teachers`, operation: 'delete' } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
    }
};

export const clearAfterSchoolTeachers = async () => {
    const snapshot = await getDocs(collection(db, 'afterSchoolTeachers'));
    if (snapshot.empty) return;

    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit().catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({ path: `/afterSchoolTeachers`, operation: 'delete' } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
    }
};

export const clearSaturdayTeachers = async () => {
    const snapshot = await getDocs(collection(db, 'saturdayTeachers'));
    if (snapshot.empty) return;

    const docs = snapshot.docs;
    for (let i = 0; i < docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = docs.slice(i, i + 500);
        chunk.forEach(doc => batch.delete(doc.ref));
        await batch.commit().catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({ path: `/saturdayTeachers`, operation: 'delete' } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
    }
};
