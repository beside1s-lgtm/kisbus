import { db } from '../firebase';
import { collection, doc, writeBatch, updateDoc, onSnapshot, query, getDocs, setDoc } from 'firebase/firestore';
import type { Student, NewStudent, Destination } from '../types';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { sanitizeDataForSystem } from '../utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export const getStudents = () => fetchCollection<Student>('students');
export const onStudentsUpdate = (callback: (students: Student[]) => void) => onCollectionUpdate<Student>('students', callback);

export const addStudent = async (student: NewStudent) => {
    const docRef = doc(collection(db, 'students'));
    const sanitizedName = sanitizeDataForSystem(student.name);
    const sanitizedContact = student.contact?.replace(/\D/g, '') || null;
    const data = { 
        ...student, 
        name: sanitizedName, 
        contact: sanitizedContact 
    };
    await setDoc(docRef, data).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'create', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
    return { id: docRef.id, ...data } as Student;
};

export const updateStudent = async (studentId: string, data: Partial<Student>) => {
    const docRef = doc(db, 'students', studentId);
    const updateData = { ...data };
    if (updateData.name) updateData.name = sanitizeDataForSystem(updateData.name);
    if (updateData.contact) updateData.contact = updateData.contact.replace(/\D/g, '') || null;
    await updateDoc(docRef, updateData).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteStudentsInBatch = async (ids: string[]) => {
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, 'students', id)));
    await batch.commit().catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/students', operation: 'delete' }));
        throw serverError;
    });
};

export const updateStudentsInBatch = async (updates: { id: string, data: Partial<Student> }[]) => {
    const batch = writeBatch(db);
    updates.forEach(u => batch.update(doc(db, 'students', u.id), u.data));
    await batch.commit().catch(serverError => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/students', operation: 'update' }));
        throw serverError;
    });
};

export const upsertStudent = async (student: Partial<Student> & { id?: string }) => {
    const docRef = student.id ? doc(db, 'students', student.id) : doc(collection(db, 'students'));
    const data = { ...student };
    delete data.id;
    
    if (data.name) data.name = sanitizeDataForSystem(data.name);
    if (data.nameKo) data.nameKo = sanitizeDataForSystem(data.nameKo);
    if (data.nameEn) data.nameEn = sanitizeDataForSystem(data.nameEn);
    if (data.contact) data.contact = data.contact.replace(/\D/g, '') || null;
    
    await setDoc(docRef, data, { merge: true }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'write', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
    return { id: docRef.id, ...data } as Student;
};
