import { db } from '../firebase';
import { collection, doc, writeBatch, deleteDoc, getDocs } from 'firebase/firestore';
import type { Destination, NewDestination } from '../types';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { sanitizeDataForSystem, normalizeString } from '../utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export const getDestinations = () => fetchCollection<Destination>('destinations');
export const onDestinationsUpdate = (callback: (destinations: Destination[]) => void) => onCollectionUpdate<Destination>('destinations', callback);
export const addDestination = (destination: Omit<Destination, 'id'>) => addDocument<Destination>('destinations', destination);

export const addDestinationsInBatch = async (destinations: Omit<Destination, 'id'>[]) => {
    const batch = writeBatch(db);
    destinations.forEach(dest => batch.set(doc(collection(db, 'destinations')), dest));
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/destinations', operation: 'create' }));
        throw serverError;
    });
};

export const deleteDestination = (id: string) => deleteDoc(doc(db, 'destinations', id)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/destinations/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});

export const clearDestinations = async () => {
    const snapshot = await getDocs(collection(db, 'destinations'));
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/destinations`, operation: 'delete' } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const getSuggestedDestinations = () => fetchCollection<Destination>('suggestedDestinations');
export const onSuggestedDestinationsUpdate = (callback: (destinations: Destination[]) => void) => onCollectionUpdate<Destination>('suggestedDestinations', callback);

export const addSuggestedDestination = async (destination: { name: string }) => {
    const sanitizedName = sanitizeDataForSystem(destination.name);
    if (!sanitizedName) return;
    const currentDests = await getDestinations();
    if (currentDests.some(d => normalizeString(d.name) === normalizeString(sanitizedName))) return;
    const currentSuggestions = await getSuggestedDestinations();
    if (currentSuggestions.some(s => normalizeString(s.name) === normalizeString(sanitizedName))) return;
    await addDocument<Destination>('suggestedDestinations', { name: sanitizedName });
};

export const approveSuggestedDestination = async (suggestion: Destination) => {
    const batch = writeBatch(db);
    const sanitizedName = sanitizeDataForSystem(suggestion.name);
    batch.set(doc(collection(db, 'destinations')), { name: sanitizedName });
    batch.delete(doc(db, 'suggestedDestinations', suggestion.id));
    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/`, operation: 'write', requestResourceData: { approvedSuggestion: suggestion } } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteSuggestedDestination = (id: string) => deleteDoc(doc(db, 'suggestedDestinations', id)).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: `/suggestedDestinations/${id}`, operation: 'delete' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
});

export const clearAllSuggestedDestinations = async () => {
    const snapshot = await getDocs(collection(db, 'suggestedDestinations'));
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/suggestedDestinations`, operation: 'delete' } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};
