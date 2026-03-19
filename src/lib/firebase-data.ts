import { db } from './firebase';
import {
  collection,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  writeBatch,
  query,
  where,
  deleteDoc,
  getDoc,
  setDoc,
  onSnapshot,
  DocumentReference,
  Query,
} from 'firebase/firestore';
import type {
  Bus,
  Student,
  Destination,
  Route,
  SeatingAssignment,
  NewBus,
  NewStudent,
  NewDestination,
  GroupLeaderRecord,
  AttendanceRecord,
  Teacher,
  NewTeacher,
  LostItem,
  NewLostItem,
  RouteType,
  DayOfWeek,
} from './types';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { normalizeString, sanitizeDataForSystem } from './utils';

// Helper to sanitize contact numbers: remove hyphens/spaces, take first number if multiple
const sanitizeContact = (val: any): string | null => {
    if (typeof val !== 'string') return null;
    const trimmed = val.trim();
    if (!trimmed) return null;
    const firstPart = trimmed.split(/[/,]/)[0];
    const digitsOnly = firstPart.replace(/\D/g, '');
    return digitsOnly || null;
};

// Generic function to fetch data from a collection
async function fetchCollection<T>(collectionName: string, q?: Query): Promise<T[]> {
    const queryToExecute = q || query(collection(db, collectionName));
    try {
        const querySnapshot = await getDocs(queryToExecute);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: `/${collectionName}`,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    }
}

// Generic function to add a document to a collection
async function addDocument<T extends {id: string}>(collectionName: string, data: Omit<T, 'id'>): Promise<T> {
  const docRef = await addDoc(collection(db, collectionName), data)
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/${collectionName}`,
            operation: 'create',
            requestResourceData: data,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
  return { id: docRef.id, ...data } as T;
}

// Generic realtime listener function
function onCollectionUpdate<T>(collectionName: string, callback: (data: T[]) => void): () => void {
    const q = query(collection(db, collectionName));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const data: T[] = [];
        querySnapshot.forEach((doc) => {
            data.push({ id: doc.id, ...doc.data() } as T);
        });
        callback(data);
    }, (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/${collectionName}`,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
    return unsubscribe;
}

// Buses
export const getBuses = () => fetchCollection<Bus>('buses');
export const onBusesUpdate = (callback: (buses: Bus[]) => void) => onCollectionUpdate<Bus>('buses', callback);
export const addBus = (bus: NewBus) => addDocument<Bus>('buses', { 
    ...bus, 
    name: sanitizeDataForSystem(bus.name),
    isActive: true, 
    excludeFromAssignment: false 
});
export const updateBus = async (busId: string, data: Partial<Bus>) => {
    const docRef = doc(db, 'buses', busId);
    const updateData = { ...data };
    if (updateData.name) updateData.name = sanitizeDataForSystem(updateData.name);
    
    let capacityChanged = false;
    let newCapacity = 0;
    if (data.capacity !== undefined) {
        const busSnap = await getDoc(docRef);
        if (busSnap.exists()) {
            const oldCapacity = busSnap.data().capacity;
            capacityChanged = data.capacity !== oldCapacity;
            newCapacity = data.capacity;
        }
    }

    await updateDoc(docRef, updateData)
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: updateData,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });

    if (capacityChanged && newCapacity > 0) {
        const q = query(collection(db, "routes"), where("busId", "==", busId));
        const routesSnapshot = await getDocs(q);
        const batch = writeBatch(db);
        
        routesSnapshot.forEach((routeDoc) => {
            const routeData = routeDoc.data() as Route;
            let newSeating = [...(routeData.seating || [])];
            
            if (newSeating.length > newCapacity) {
                newSeating = newSeating.slice(0, newCapacity);
            } else if (newSeating.length < newCapacity) {
                for (let i = newSeating.length + 1; i <= newCapacity; i++) {
                    newSeating.push({ seatNumber: i, studentId: null });
                }
            }
            batch.update(routeDoc.ref, { seating: newSeating });
        });
        
        await batch.commit().catch(e => console.error("Failed to sync route seating on bus update", e));
    }
}
export const deleteBus = async (busId: string) => {
    const q = query(collection(db, "routes"), where("busId", "==", busId));
    const querySnapshot = await getDocs(q);

    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
    
    const busDocRef = doc(db, 'buses', busId);
    batch.delete(busDocRef);
    
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/buses/${busId}`,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

// Students
export const getStudents = () => fetchCollection<Student>('students');
export const onStudentsUpdate = (callback: (students: Student[]) => void) => onCollectionUpdate<Student>('students', callback);

export const addStudent = async (student: NewStudent): Promise<Student> => {
    const sanitizedName = sanitizeDataForSystem(student.name);
    const sanitizedGrade = sanitizeDataForSystem(student.grade);
    const sanitizedClass = sanitizeDataForSystem(student.class);
    const sanitizedContact = sanitizeContact(student.contact);

    // Improvement: Try matching by (Name + Grade + Class) OR (Name + Contact if provided)
    // This allows bulk updating grades for students if their phone number is the same.
    let existingStudentDoc: any = null;

    // 1. Try exact match
    const q1 = query(collection(db, "students"), 
        where("name", "==", sanitizedName),
        where("grade", "==", sanitizedGrade),
        where("class", "==", sanitizedClass)
    );
    const snap1 = await getDocs(q1);
    if (!snap1.empty) {
        existingStudentDoc = snap1.docs[0];
    } else if (sanitizedContact) {
        // 2. Try match by Name + Contact (Allows Grade/Class updates)
        const q2 = query(collection(db, "students"), 
            where("name", "==", sanitizedName),
            where("contact", "==", sanitizedContact)
        );
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
            existingStudentDoc = snap2.docs[0];
        }
    }

    if (existingStudentDoc) {
        const docRef = existingStudentDoc.ref;
        const existingStudentData = existingStudentDoc.data() as Student;

        const updateData: Partial<Student> = {};
        if (student.name) updateData.name = sanitizedName;
        if (student.grade) updateData.grade = sanitizedGrade;
        if (student.class) updateData.class = sanitizedClass;
        if (student.gender) updateData.gender = student.gender;
        if (student.contact !== undefined) updateData.contact = sanitizedContact;
        if (student.morningDestinationId !== undefined) updateData.morningDestinationId = student.morningDestinationId;
        if (student.afternoonDestinationId !== undefined) updateData.afternoonDestinationId = student.afternoonDestinationId;
        if (student.afterSchoolDestinations !== undefined) updateData.afterSchoolDestinations = student.afterSchoolDestinations;
        
        if (student.satMorningDestinationId !== undefined) updateData.satMorningDestinationId = student.satMorningDestinationId;
        if (student.satAfternoonDestinationId !== undefined) updateData.satAfternoonDestinationId = student.satAfternoonDestinationId;

        if (student.applicationStatus) updateData.applicationStatus = student.applicationStatus;
        if (student.siblingGroupId !== undefined) updateData.siblingGroupId = student.siblingGroupId;
        if (student.suggestedMorningDestination !== undefined) updateData.suggestedMorningDestination = student.suggestedMorningDestination ? sanitizeDataForSystem(student.suggestedMorningDestination) : null;
        if (student.suggestedAfternoonDestination !== undefined) updateData.suggestedAfternoonDestination = student.suggestedAfternoonDestination ? sanitizeDataForSystem(student.suggestedAfternoonDestination) : null;
        if (student.suggestedSatMorningDestination !== undefined) updateData.suggestedSatMorningDestination = student.suggestedSatMorningDestination ? sanitizeDataForSystem(student.suggestedSatMorningDestination) : null;
        if (student.suggestedSatAfternoonDestination !== undefined) updateData.suggestedSatAfternoonDestination = student.suggestedSatAfternoonDestination ? sanitizeDataForSystem(student.suggestedSatAfternoonDestination) : null;

        await updateStudent(docRef.id, updateData);
        return { id: docRef.id, ...existingStudentData, ...updateData } as Student;
    } else {
        const newStudentData = {
            ...student,
            name: sanitizedName,
            grade: sanitizedGrade,
            class: sanitizedClass,
            contact: sanitizedContact,
            suggestedMorningDestination: student.suggestedMorningDestination ? sanitizeDataForSystem(student.suggestedMorningDestination) : null,
            suggestedAfternoonDestination: student.suggestedAfternoonDestination ? sanitizeDataForSystem(student.suggestedAfternoonDestination) : null,
            suggestedSatMorningDestination: student.suggestedSatMorningDestination ? sanitizeDataForSystem(student.suggestedSatMorningDestination) : null,
            suggestedSatAfternoonDestination: student.suggestedSatAfternoonDestination ? sanitizeDataForSystem(student.suggestedSatAfternoonDestination) : null,
        };
        const docRef = await addDoc(collection(db, 'students'), newStudentData).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: '/students',
                operation: 'create',
                requestResourceData: newStudentData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
        return { id: docRef.id, ...newStudentData } as Student;
    }
};

export const updateStudent = async (studentId: string, data: Partial<Student>) => {
    const studentDocRef = doc(db, 'students', studentId);
    const studentBeforeUpdate = await getDoc(studentDocRef);
    if (!studentBeforeUpdate.exists()) return;

    const oldData = studentBeforeUpdate.data() as Student;
    
    // Core Fix: Unassigning one session should NOT affect others.
    // We only unassign from routes that match the SPECIFIC destination change.
    let affectedRouteConfigs: { day?: DayOfWeek, types: RouteType[] }[] = [];

    // Mon-Fri Commute Morning
    if ('morningDestinationId' in data && data.morningDestinationId !== oldData.morningDestinationId) {
        affectedRouteConfigs.push({ types: ['Morning'] }); // Defaults to Mon-Fri in unassign logic
    }
    
    // Mon-Fri Commute Afternoon
    if ('afternoonDestinationId' in data && data.afternoonDestinationId !== oldData.afternoonDestinationId) {
        affectedRouteConfigs.push({ types: ['Afternoon'] });
    }
    
    // Mon-Fri AfterSchool
    if ('afterSchoolDestinations' in data) {
        const oldAfterSchoolDests = oldData.afterSchoolDestinations || {};
        const newAfterSchoolDests = data.afterSchoolDestinations || {};
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(day => {
            if (oldAfterSchoolDests[day as DayOfWeek] !== newAfterSchoolDests[day as DayOfWeek]) {
                affectedRouteConfigs.push({ day: day as DayOfWeek, types: ['AfterSchool'] });
            }
        });
    }

    // Saturday Morning
    if ('satMorningDestinationId' in data && data.satMorningDestinationId !== oldData.satMorningDestinationId) {
        affectedRouteConfigs.push({ day: 'Saturday', types: ['Morning'] });
    }

    // Saturday Afternoon
    if ('satAfternoonDestinationId' in data && data.satAfternoonDestinationId !== oldData.satAfternoonDestinationId) {
        affectedRouteConfigs.push({ day: 'Saturday', types: ['Afternoon', 'AfterSchool'] });
    }
    
    if (affectedRouteConfigs.length > 0) {
        for (const config of affectedRouteConfigs) {
            // Note: config.day is optional. If null, unassignStudentFromAllRoutes handles weekdays.
            await unassignStudentFromAllRoutes(studentId, config.types, config.day);
        }
    }

    const updatePayload: any = { ...data };
    if (updatePayload.name) updatePayload.name = sanitizeDataForSystem(updatePayload.name);
    if (updatePayload.grade) updatePayload.grade = sanitizeDataForSystem(updatePayload.grade);
    if (updatePayload.class) updatePayload.class = sanitizeDataForSystem(updatePayload.class);
    if (updatePayload.contact) updatePayload.contact = sanitizeContact(updatePayload.contact);
    
    await updateDoc(studentDocRef, updatePayload)
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: studentDocRef.path,
            operation: 'update',
            requestResourceData: updatePayload,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}
export const updateStudentsInBatch = async (students: (Partial<Student> & {id: string})[]) => {
    const batch = writeBatch(db);
    students.forEach(student => {
        const { id, ...data } = student;
        const updatePayload: any = { ...data };
        if (updatePayload.name) updatePayload.name = sanitizeDataForSystem(updatePayload.name);
        if (updatePayload.grade) updatePayload.grade = sanitizeDataForSystem(updatePayload.grade);
        if (updatePayload.class) updatePayload.class = sanitizeDataForSystem(updatePayload.class);
        if (updatePayload.contact) updatePayload.contact = sanitizeContact(updatePayload.contact);
        const docRef = doc(db, 'students', id);
        batch.update(docRef, updatePayload);
    });
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/students`,
            operation: 'update',
            requestResourceData: students,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteStudentsInBatch = async (studentIds: string[]) => {
    const batch = writeBatch(db);
    
    studentIds.forEach(id => {
        const docRef = doc(db, 'students', id);
        batch.delete(docRef);
    });
    
    const routesSnapshot = await getDocs(collection(db, 'routes'));

    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        let seatingChanged = false;
        const newSeating = routeData.seating.map(seat => {
            if (seat.studentId && studentIds.includes(seat.studentId)) {
                seatingChanged = true;
                return { ...seat, studentId: null };
            }
            return seat;
        });

        if (seatingChanged) {
            batch.update(routeDoc.ref, { seating: newSeating });
        }
    });

    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/`,
            operation: 'write',
            requestResourceData: { deletedStudentIds: studentIds }
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};


// Destinations
export const getDestinations = () => fetchCollection<Destination>('destinations');
export const onDestinationsUpdate = (callback: (destinations: Destination[]) => void) => onCollectionUpdate<Destination>('destinations', callback);
export const addDestination = (destination: NewDestination) => addDocument<Destination>('destinations', {
    ...destination,
    name: sanitizeDataForSystem(destination.name)
});
export const addDestinationsInBatch = async (destinations: NewDestination[]): Promise<Destination[]> => {
    const batch = writeBatch(db);
    const newDestinations: Destination[] = [];
    const existingDestsSnapshot = await getDocs(collection(db, 'destinations'));
    const normalizedExisting = new Set(existingDestsSnapshot.docs.map(doc => normalizeString(doc.data().name)));

    for (const dest of destinations) {
        const sanitizedName = sanitizeDataForSystem(dest.name);
        const normName = normalizeString(sanitizedName);
        if (normName && !normalizedExisting.has(normName)) {
            const docRef = doc(collection(db, 'destinations'));
            batch.set(docRef, { name: sanitizedName });
            newDestinations.push({ id: docRef.id, name: sanitizedName });
            normalizedExisting.add(normName);
        }
    }
    
    if (newDestinations.length > 0) {
        await batch.commit()
        .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: `/destinations`,
                operation: 'create',
                requestResourceData: newDestinations,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
    }
    return newDestinations;
}
export const deleteDestination = (destinationId: string) => {
    const docRef = doc(db, 'destinations', destinationId);
    deleteDoc(docRef)
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}
export const deleteAllDestinations = async () => {
    const batch = writeBatch(db);

    const destSnapshot = await getDocs(collection(db, 'destinations'));
    destSnapshot.forEach(doc => batch.delete(doc.ref));

    const routesSnapshot = await getDocs(collection(db, 'routes'));
    routesSnapshot.forEach(doc => {
        batch.update(doc.ref, { stops: [] });
    });

    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/`,
            operation: 'write',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

// Teachers (Commute)
export const getTeachers = () => fetchCollection<Teacher>('teachers');
export const onTeachersUpdate = (callback: (teachers: Teacher[]) => void) => onCollectionUpdate<Teacher>('teachers', callback);
export const addTeachersInBatch = async (teachers: NewTeacher[]): Promise<Teacher[]> => {
    const batch = writeBatch(db);
    const newTeachers: Teacher[] = [];
    const q = query(collection(db, 'teachers'));
    const existingDocs = await getDocs(q);
    const existingNames = new Set(existingDocs.docs.map(d => normalizeString(d.data().name)));

    for (const teacher of teachers) {
        const sanitizedName = sanitizeDataForSystem(teacher.name);
        const normName = normalizeString(sanitizedName);
        if (!existingNames.has(normName)) {
            const docRef = doc(collection(db, 'teachers'));
            batch.set(docRef, { name: sanitizedName });
            newTeachers.push({ id: docRef.id, name: sanitizedName });
            existingNames.add(normName);
        }
    }
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/teachers`,
            operation: 'create',
            requestResourceData: newTeachers,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
    return newTeachers;
};

export const deleteTeacher = async (teacherId: string) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'teachers', teacherId));
    const routesSnapshot = await getDocs(query(collection(db, 'routes'), where('type', '==', 'Afternoon')));
    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        if (routeData.teacherIds && routeData.teacherIds.includes(teacherId)) {
            batch.update(routeDoc.ref, { teacherIds: routeData.teacherIds.filter(id => id !== teacherId) });
        }
    });
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/teachers/${teacherId}`,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteTeachersInBatch = async (teacherIds: string[]) => {
    const batch = writeBatch(db);
    teacherIds.forEach(id => batch.delete(doc(db, 'teachers', id)));
    const routesSnapshot = await getDocs(query(collection(db, 'routes'), where('type', '==', 'Afternoon')));
    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        if (routeData.teacherIds) {
            const newIds = routeData.teacherIds.filter(id => !teacherIds.includes(id));
            if (newIds.length !== routeData.teacherIds.length) batch.update(routeDoc.ref, { teacherIds: newIds });
        }
    });
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/teachers`,
            operation: 'delete',
            } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteAllTeachers = async () => {
    const batch = writeBatch(db);
    const teachersSnapshot = await getDocs(collection(db, 'teachers'));
    teachersSnapshot.forEach(doc => batch.delete(doc.ref));
    const routesSnapshot = await getDocs(query(collection(db, 'routes'), where('type', '==', 'Afternoon')));
    routesSnapshot.forEach(doc => batch.update(doc.ref, { teacherIds: [] }));
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/teachers`,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

// After School Teachers
export const getAfterSchoolTeachers = () => fetchCollection<Teacher>('afterSchoolTeachers');
export const onAfterSchoolTeachersUpdate = (callback: (teachers: Teacher[]) => void) => onCollectionUpdate<Teacher>('afterSchoolTeachers', callback);
export const addAfterSchoolTeachersInBatch = async (teachers: NewTeacher[]): Promise<Teacher[]> => {
    const batch = writeBatch(db);
    const newTeachers: Teacher[] = [];
    const q = query(collection(db, 'afterSchoolTeachers'));
    const existingDocs = await getDocs(q);
    const existingNames = new Set(existingDocs.docs.map(d => normalizeString(d.data().name)));

    for (const teacher of teachers) {
        const sanitizedName = sanitizeDataForSystem(teacher.name);
        const normName = normalizeString(sanitizedName);
        if (!existingNames.has(normName)) {
            const docRef = doc(collection(db, 'afterSchoolTeachers'));
            batch.set(docRef, { name: sanitizedName });
            newTeachers.push({ id: docRef.id, name: sanitizedName });
            existingNames.add(normName);
        }
    }
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/afterSchoolTeachers`,
            operation: 'create',
            requestResourceData: newTeachers,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
    return newTeachers;
};

export const deleteAfterSchoolTeacher = async (teacherId: string) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'afterSchoolTeachers', teacherId));
    const routesSnapshot = await getDocs(query(collection(db, 'routes'), where('type', '==', 'AfterSchool')));
    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        if (routeData.teacherIds && routeData.teacherIds.includes(teacherId)) {
            batch.update(routeDoc.ref, { teacherIds: routeData.teacherIds.filter(id => id !== teacherId) });
        }
    });
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/afterSchoolTeachers/${teacherId}`,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteAfterSchoolTeachersInBatch = async (teacherIds: string[]) => {
    const batch = writeBatch(db);
    teacherIds.forEach(id => batch.delete(doc(db, 'afterSchoolTeachers', id)));
    const routesSnapshot = await getDocs(query(collection(db, 'routes'), where('type', '==', 'AfterSchool')));
    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        if (routeData.teacherIds) {
            const newIds = routeData.teacherIds.filter(id => !teacherIds.includes(id));
            if (newIds.length !== routeData.teacherIds.length) batch.update(routeDoc.ref, { teacherIds: newIds });
        }
    });
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/afterSchoolTeachers`,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const deleteAllAfterSchoolTeachers = async () => {
    const batch = writeBatch(db);
    const teachersSnapshot = await getDocs(collection(db, 'afterSchoolTeachers'));
    teachersSnapshot.forEach(doc => batch.delete(doc.ref));
    const routesSnapshot = await getDocs(query(collection(db, 'routes'), where('type', '==', 'AfterSchool')));
    routesSnapshot.forEach(doc => batch.update(doc.ref, { teacherIds: [] }));
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/afterSchoolTeachers`,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

// Routes
export const getRoutes = () => fetchCollection<Route>('routes');
export const onRoutesUpdate = (callback: (routes: Route[]) => void) => onCollectionUpdate<Route>('routes', callback);

export const getRoutesForBus = (busId: string) => {
    const q = query(collection(db, "routes"), where("busId", "==", busId));
    return fetchCollection<Route>('routes', q);
}
export const getRoutesByStop = async (stopId: string): Promise<Route[]> => {
    const q = query(collection(db, "routes"), where("stops", "array-contains", stopId));
    return fetchCollection<Route>('routes', q);
}
export const addRoute = (route: Omit<Route, 'id'>) => {
    return addDoc(collection(db, 'routes'), route)
    .then(docRef => docRef.id)
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: '/routes',
            operation: 'create',
            requestResourceData: route,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}
export const updateRouteSeating = async (routeId: string, seating: SeatingAssignment[]) => {
  const docRef = doc(db, 'routes', routeId);
  await updateDoc(docRef, { seating })
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: { seating },
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const updateRoute = async (routeId: string, data: Partial<Route>) => {
    const docRef = doc(db, 'routes', routeId);
    await updateDoc(docRef, data)
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: data,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}

export const updateRouteStops = async (routeId: string, stops: string[]) => {
    const docRef = doc(db, 'routes', routeId);
    await updateDoc(docRef, { stops })
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: { stops },
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}

export const copySeatingPlan = async (sourcePlan: { seatNumber: number; studentId: string | null }[], targetRoutes: Route[]) => {
    const batch = writeBatch(db);

    for (const targetRoute of targetRoutes) {
        batch.update(doc(db, 'routes', targetRoute.id), { seating: sourcePlan });
    }

    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/routes`,
            operation: 'update',
            requestResourceData: { seatingPlan: sourcePlan, targetRouteIds: targetRoutes.map(r => r.id) }
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const copyRoutePlan = async (sourceStops: string[], targetRoutes: Route[]) => {
    const batch = writeBatch(db);

    for (const targetRoute of targetRoutes) {
        batch.update(doc(db, 'routes', targetRoute.id), { stops: sourceStops });
    }

    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/routes`,
            operation: 'update',
            requestResourceData: { stops: sourceStops, targetRouteIds: targetRoutes.map(r => r.id) }
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}

// Group Leader Records
export const getGroupLeaderRecords = async (routeId: string): Promise<GroupLeaderRecord[]> => {
    const collectionName = `routes/${routeId}/groupLeaderRecords`;
    const recordsSnapshot = await getDocs(collection(db, collectionName));
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
        const docRef = doc(recordsCollection, recordId);
        batch.set(docRef, record, { merge: true });
    });

    existingRecordIds.forEach(id => {
        if (!localRecordIds.has(id)) {
            batch.delete(doc(recordsCollection, id));
        }
    });
    
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/routes/${routeId}/groupLeaderRecords`,
            operation: 'write',
            requestResourceData: records
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};


// Suggested Destinations
export const getSuggestedDestinations = () => fetchCollection<Destination>('suggestedDestinations');
export const onSuggestedDestinationsUpdate = (callback: (destinations: Destination[]) => void) => onCollectionUpdate<Destination>('suggestedDestinations', callback);
export const addSuggestedDestination = async (destination: { name: string }) => {
    const sanitizedName = sanitizeDataForSystem(destination.name);
    if (!sanitizedName) return;

    const currentDests = await getDestinations();
    const normNewName = normalizeString(sanitizedName);
    if (currentDests.some(d => normalizeString(d.name) === normNewName)) return;

    const currentSuggestions = await getSuggestedDestinations();
    if (currentSuggestions.some(s => normalizeString(s.name) === normNewName)) return;

    await addDocument<Destination>('suggestedDestinations', { name: sanitizedName });
}
export const approveSuggestedDestination = async (suggestion: Destination) => {
    const batch = writeBatch(db);
    const newDestRef = doc(collection(db, 'destinations'));
    const sanitizedName = sanitizeDataForSystem(suggestion.name);
    batch.set(newDestRef, { name: sanitizedName });
    batch.delete(doc(db, 'suggestedDestinations', suggestion.id));
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/`,
            operation: 'write',
            requestResourceData: { approvedSuggestion: suggestion }
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}
export const deleteSuggestedDestination = (id: string) => {
    const docRef = doc(db, 'suggestedDestinations', id);
    return deleteDoc(docRef).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}
export const clearAllSuggestedDestinations = async () => {
    const suggestionsCollection = collection(db, 'suggestedDestinations');
    const snapshot = await getDocs(suggestionsCollection);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/suggestedDestinations`,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const unassignStudentFromAllRoutes = async (studentId: string, routeTypes?: RouteType[], day?: DayOfWeek) => {
    if (!studentId) return;

    let q = query(collection(db, 'routes'));
    // If day is provided, we ONLY search for that day.
    // If day is NOT provided, it defaults to the Mon-Fri commute logic.
    if (day) {
        q = query(collection(db, 'routes'), where('dayOfWeek', '==', day));
    } else if (routeTypes && (routeTypes.includes('Morning') || routeTypes.includes('Afternoon'))) {
        // For general commute updates, we limit to weekdays to be safe
        q = query(collection(db, 'routes'), where('dayOfWeek', 'in', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']));
    }
    
    const routesSnapshot = await getDocs(q);
    if (routesSnapshot.empty) return;

    const batch = writeBatch(db);
    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        
        if (routeTypes && !routeTypes.includes(routeData.type)) {
            return;
        }

        let seatingChanged = false;
        const newSeating = routeData.seating.map(seat => {
            if (seat.studentId === studentId) {
                seatingChanged = true;
                return { ...seat, studentId: null };
            }
            return seat;
        });

        if (seatingChanged) {
            batch.update(routeDoc.ref, { seating: newSeating });
        }
    });

    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/routes`,
            operation: 'update',
            requestResourceData: { unassignStudentId: studentId }
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};


// --- Attendance ---
export const getAttendance = async (routeId: string, date: string): Promise<AttendanceRecord | null> => {
  const docRef = doc(db, 'routes', routeId, 'attendance', date);
  const docSnap = await getDoc(docRef).catch(async (serverError) => {
    const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'get',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw serverError;
  });
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as AttendanceRecord;
  }
  return null;
};

export const updateAttendance = async (routeId: string, date: string, data: Partial<Omit<AttendanceRecord, 'id' | 'routeId'>>) => {
  const docRef = doc(db, 'routes', routeId, 'attendance', date);
  await setDoc(docRef, data, { merge: true })
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'write',
            requestResourceData: data,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

export const onAttendanceUpdate = (routeId: string, date: string, callback: (record: AttendanceRecord | null) => void) => {
  const docRef = doc(db, 'routes', routeId, 'attendance', date);
  const unsubscribe = onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord);
    } else {
      callback(null);
    }
  }, (serverError) => {
    const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'get',
    } satisfies SecurityRuleContext);
    errorEmitter.emit('permission-error', permissionError);
  });
  return unsubscribe;
};

// --- Lost & Found ---
export const getLostItems = () => fetchCollection<LostItem>('lostItems');
export const onLostItemsUpdate = (callback: (items: LostItem[]) => void) => onCollectionUpdate<LostItem>('lostItems', callback);
export const addLostItem = (item: NewLostItem) => addDocument<LostItem>('lostItems', {
    ...item,
    itemType: item.itemType ? sanitizeDataForSystem(item.itemType) : null
});
export const updateLostItem = (itemId: string, data: Partial<LostItem>) => {
    const docRef = doc(db, 'lostItems', itemId);
    const updateData = { ...data };
    if (updateData.itemType) updateData.itemType = sanitizeDataForSystem(updateData.itemType);
    
    updateDoc(docRef, updateData)
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'update',
            requestResourceData: data,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}
export const deleteLostItem = (itemId: string) => {
    const docRef = doc(db, 'lostItems', itemId);
    deleteDoc(docRef)
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: docRef.path,
            operation: 'delete',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}
