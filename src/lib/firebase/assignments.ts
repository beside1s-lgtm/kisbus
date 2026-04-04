import { db } from '../firebase';
import { collection, doc, writeBatch, query, getDocs, where } from 'firebase/firestore';
import type { Route, Student, RouteType, DayOfWeek } from '../types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export const unassignStudentFromAllRoutes = async (studentId: string, routeTypes?: RouteType[], day?: DayOfWeek) => {
    if (!studentId) return;
    let q = query(collection(db, 'routes'));
    if (day) q = query(collection(db, 'routes'), where('dayOfWeek', '==', day));
    else if (routeTypes && (routeTypes.includes('Morning') || routeTypes.includes('Afternoon'))) {
        q = query(collection(db, 'routes'), where('dayOfWeek', 'in', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']));
    }
    const routesSnapshot = await getDocs(q);
    if (routesSnapshot.empty) return;
    const batch = writeBatch(db);
    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        if (routeTypes && !routeTypes.includes(routeData.type)) return;
        let seatingChanged = false;
        const newSeating = routeData.seating.map(seat => { 
            if (seat.studentId === studentId) { 
                seatingChanged = true; 
                return { ...seat, studentId: null }; 
            } 
            return seat; 
        });
        if (seatingChanged) batch.update(routeDoc.ref, { seating: newSeating });
    });
    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/routes`, operation: 'update', requestResourceData: { unassignStudentId: studentId } } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const clearAllAfterSchoolAssignments = async () => {
    const batch = writeBatch(db);
    const studentsSnapshot = await getDocs(collection(db, 'students'));
    studentsSnapshot.forEach(studentDoc => {
        const data = studentDoc.data() as Student;
        if (data.afterSchoolDestinations && Object.keys(data.afterSchoolDestinations).length > 0) {
            batch.update(studentDoc.ref, { afterSchoolDestinations: {} });
        }
    });

    const routesSnapshot = await getDocs(query(collection(db, 'routes'), where('type', '==', 'AfterSchool')));
    routesSnapshot.forEach(routeDoc => {
        const data = routeDoc.data() as Route;
        const newSeating = (data.seating || []).map(seat => ({ ...seat, studentId: null }));
        batch.update(routeDoc.ref, { seating: newSeating });
    });

    await batch.commit().catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({ path: `/`, operation: 'write', requestResourceData: { action: 'clearAllAfterSchool' } } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};
