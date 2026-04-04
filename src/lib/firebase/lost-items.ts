import { db } from '../firebase';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { LostItem, NewLostItem } from '../types';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { sanitizeDataForSystem } from '../utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export const getLostItems = () => fetchCollection<LostItem>('lostItems');
export const onLostItemsUpdate = (callback: (items: LostItem[]) => void) => onCollectionUpdate<LostItem>('lostItems', callback);
export const addLostItem = (item: NewLostItem) => addDocument<LostItem>('lostItems', { ...item, itemType: item.itemType ? sanitizeDataForSystem(item.itemType) : null });

export const updateLostItem = (itemId: string, data: Partial<LostItem>) => {
    const docRef = doc(db, 'lostItems', itemId);
    const updateData = { ...data };
    if (updateData.itemType) updateData.itemType = sanitizeDataForSystem(updateData.itemType);
    
    updateDoc(docRef, updateData).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteLostItem = (itemId: string) => deleteDoc(doc(db, 'lostItems', itemId)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/lostItems/${itemId}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});
