import { db } from '../firebase';
import { collection, doc, writeBatch, getDocs } from 'firebase/firestore';
import type { GroupLeaderRecord } from '../types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

const getLeadersCollection = (routeId: string, busId?: string, type?: string) => {
    if (!busId) {
        // busId가 없는 경우 예외적으로 routeId 기반 경로를 사용하되 경고 로그를 남깁니다.
        console.warn('busId missing for group leader records, falling back to route path:', routeId);
        return collection(db, `routes/${routeId}/groupLeaderRecords`);
    }
    // 모든 노선 타입(등교, 하교, 방과후)에서 버스 ID별 전역 경로를 공유합니다.
    return collection(db, `busLeaders/${busId}/records`);
};

export const getGroupLeaderRecords = async (routeId: string, busId?: string, type?: string): Promise<GroupLeaderRecord[]> => {
    const recordsCollection = getLeadersCollection(routeId, busId, type);
    const recordsSnapshot = await getDocs(recordsCollection);
    return recordsSnapshot.docs.map(doc => doc.data() as GroupLeaderRecord);
};

export const saveGroupLeaderRecords = async (routeId: string, records: GroupLeaderRecord[], busId?: string, type?: string) => {
    const batch = writeBatch(db);
    const recordsCollection = getLeadersCollection(routeId, busId, type);
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
            path: recordsCollection.path, 
            operation: 'write', 
            requestResourceData: records 
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};
