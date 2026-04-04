import { db } from '../firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import type { AttendanceRecord } from '../types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export const updateAttendance = async (routeId: string, date: string, data: Partial<Omit<AttendanceRecord, 'id' | 'routeId'>>) => {
  const docRef = doc(db, 'routes', routeId, 'attendance', date);
  await setDoc(docRef, data, { merge: true }).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'write', requestResourceData: data } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  });
};

export const onAttendanceUpdate = (routeId: string, date: string, callback: (record: AttendanceRecord | null) => void) => {
  const docRef = doc(db, 'routes', routeId, 'attendance', date);
  return onSnapshot(docRef, (docSnap) => { 
    callback(docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord) : null); 
  }, (serverError) => {
    const permissionError = new FirestorePermissionError({ path: docRef.path, operation: 'get' } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });
};
