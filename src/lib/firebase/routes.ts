import { db } from '../firebase';
import { collection, doc, writeBatch, updateDoc, query, getDocs, where, setDoc } from 'firebase/firestore';
import type { Route, SeatingAssignment, DayOfWeek, RouteType } from '../types';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export const getRoutes = () => fetchCollection<Route>('routes');
export const onRoutesUpdate = (callback: (routes: Route[]) => void) => onCollectionUpdate<Route>('routes', callback);

export const addRoute = (route: Omit<Route, 'id'>) => addDocument<Route>('routes', route);

export const updateRouteSeating = async (routeId: string, seating: SeatingAssignment[]) => {
    const docRef = doc(db, 'routes', routeId);
    await updateDoc(docRef, { seating }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: { seating } } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const updateRouteStops = async (routeId: string, stops: string[]) => {
    const docRef = doc(db, 'routes', routeId);
    await updateDoc(docRef, { stops }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: { stops } } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const updateRoute = async (routeId: string, data: Partial<Route>) => {
    const docRef = doc(db, 'routes', routeId);
    await updateDoc(docRef, data).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'update', requestResourceData: data } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const copySeatingPlan = async (sourceRouteId: string, targetBusId: string, targetDays: DayOfWeek[], targetRouteTypes: RouteType[]) => {
    const batch = writeBatch(db);
    const sourceSnap = await getDocs(query(collection(db, 'routes'), where('__name__', '==', sourceRouteId)));
    if (sourceSnap.empty) return;
    const sourceData = sourceSnap.docs[0].data() as Route;
    const seating = sourceData.seating;
    
    const targetQuery = query(collection(db, 'routes'), where('busId', '==', targetBusId));
    const targetSnap = await getDocs(targetQuery);
    targetSnap.forEach(docSnap => {
        const data = docSnap.data() as Route;
        if (targetDays.includes(data.dayOfWeek) && targetRouteTypes.includes(data.type)) {
            batch.update(docSnap.ref, { seating });
        }
    });
    await batch.commit().catch(async (serverError) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: '/routes', operation: 'update' }));
        throw serverError;
    });
};
