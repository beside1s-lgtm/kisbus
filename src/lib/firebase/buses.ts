import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Bus, NewBus } from '../types';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { sanitizeDataForSystem } from '../utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export const getBuses = () => fetchCollection<Bus>('buses');
export const onBusesUpdate = (callback: (buses: Bus[]) => void) => onCollectionUpdate<Bus>('buses', callback);
export const addBus = (bus: NewBus) => addDocument<Bus>('buses', { 
    ...bus, 
    name: sanitizeDataForSystem(bus.name),
    isActive: true 
});

export const updateBus = async (busId: string, data: Partial<Bus>) => {
    const docRef = doc(db, 'buses', busId);
    await updateDoc(docRef, data).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ 
            path: docRef.path, 
            operation: 'update', 
            requestResourceData: data 
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteBus = (id: string) => deleteDoc(doc(db, 'buses', id)).catch(async (serverError: any) => {
    const permissionError = new FirestorePermissionError({ path: `/buses/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});
