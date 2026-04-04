import { db } from '../firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import type { GroupLeaderRecord } from '../types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export const getGroupLeaderRecords = async (routeId: string): Promise<GroupLeaderRecord[]> => {
    const recordsSnapshot = await getDocs(collection(db, `routes/${routeId}/groupLeaderRecords`));
    return recordsSnapshot.docs.map(doc => doc.data() as GroupLeaderRecord);
};

export const saveGroupLeaderRecords = async (routeId: string, records: GroupLeaderRecord[]) => {
    const batch = writeBatch(db);
    const recordsCollection = collection(db, `routes/${routeId}/groupLeaderRecords`);
    const existingRecordsSnapshot = await getDocs(recordsCollection);
    const existingRecordIds = new Set(existingRecordsSnapshot.docs.map(d => d.id));
    const localRecordIds = new Set<string>();
    
    records.forEach(record => {
        const recordId = record.studentId + '_' + record.startDate;
        localRecordIds.add(recordId);
        batch.set(doc(recordsCollection, recordId), record, { merge: true });
    });
    
    existingRecordIds.forEach(id => { 
        if (!localRecordIds.has(id)) batch.delete(doc(recordsCollection, id)); 
    });

    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ 
            path: `/routes/${routeId}/groupLeaderRecords`, 
            operation: 'write', 
            requestResourceData: records 
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};
