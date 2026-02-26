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
        // Re-throw the original error to allow the caller to handle it if needed
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
        // We don't rethrow here as it's a listener
    });
    return unsubscribe;
}

// Buses
export const getBuses = () => fetchCollection<Bus>('buses');
export const onBusesUpdate = (callback: (buses: Bus[]) => void) => onCollectionUpdate<Bus>('buses', callback);
export const addBus = (bus: NewBus) => addDocument<Bus>('buses', { ...bus, isActive: true, excludeFromAssignment: false });
export const updateBus = async (busId: string, data: Partial<Bus>) => {
    const docRef = doc(db, 'buses', busId);
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
export const deleteBus = async (busId: string) => {
    // Also delete associated routes
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
            path: `/buses/${busId}`, // Or a more general path if batch fails
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
    const q = query(collection(db, "students"), 
        where("name", "==", student.name),
        where("grade", "==", student.grade),
        where("class", "==", student.class)
    );
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        // Student exists, update them
        const docRef = querySnapshot.docs[0].ref;
        const existingStudentDoc = await getDoc(docRef);
        const existingStudentData = existingStudentDoc.data() as Student;

        const updateData: Partial<Student> = {
            ...student,
        };
        
        if (student.afterSchoolDestinations) {
           updateData.afterSchoolDestinations = student.afterSchoolDestinations;
        } else {
           updateData.afterSchoolDestinations = existingStudentData.afterSchoolDestinations;
        }

        if (student.morningDestinationId === undefined) {
            updateData.morningDestinationId = existingStudentData.morningDestinationId;
        }
        if (student.afternoonDestinationId === undefined) {
            updateData.afternoonDestinationId = existingStudentData.afternoonDestinationId;
        }
        if (student.contact === undefined) {
            updateData.contact = existingStudentData.contact;
        }
        
        if (student.suggestedMorningDestination) updateData.morningDestinationId = null;
        if (student.suggestedAfternoonDestination) updateData.afternoonDestinationId = null;

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
        
        const docSnap = await getDoc(docRef);
        return { id: docRef.id, ...docSnap.data() } as Student;
    } else {
        // Student doesn't exist, create new
        const docRef = await addDoc(collection(db, 'students'), student).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: '/students',
                operation: 'create',
                requestResourceData: student,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            throw serverError;
        });
        const newStudentDoc = await getDoc(docRef);
        return { id: docRef.id, ...newStudentDoc.data() } as Student;
    }
};

export const updateStudent = async (studentId: string, data: Partial<Student>) => {
    const studentDocRef = doc(db, 'students', studentId);
    const studentBeforeUpdate = await getDoc(studentDocRef);
    if (!studentBeforeUpdate.exists()) return;

    const oldData = studentBeforeUpdate.data() as Student;
    
    let affectedRouteTypes: RouteType[] = [];

    if ('morningDestinationId' in data && data.morningDestinationId !== oldData.morningDestinationId) {
        affectedRouteTypes.push('Morning');
    }
    if ('afternoonDestinationId' in data && data.afternoonDestinationId !== oldData.afternoonDestinationId) {
        affectedRouteTypes.push('Afternoon');
    }
    
    const oldAfterSchoolDests = oldData.afterSchoolDestinations || {};
    const newAfterSchoolDests = ('afterSchoolDestinations' in data && data.afterSchoolDestinations) ? data.afterSchoolDestinations : oldAfterSchoolDests;
    const allAfterSchoolDays = new Set([...Object.keys(oldAfterSchoolDests), ...Object.keys(newAfterSchoolDests)]);

    let afterSchoolChanged = false;
    for (const day of allAfterSchoolDays) {
        if (oldAfterSchoolDests[day as DayOfWeek] !== newAfterSchoolDests[day as DayOfWeek]) {
            afterSchoolChanged = true;
            break;
        }
    }
    if (afterSchoolChanged) {
        affectedRouteTypes.push('AfterSchool');
    }
    
    if (affectedRouteTypes.length > 0) {
        await unassignStudentFromAllRoutes(studentId, affectedRouteTypes);
    }
    
    await updateDoc(studentDocRef, data)
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: studentDocRef.path,
            operation: 'update',
            requestResourceData: data,
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
}
export const updateStudentsInBatch = async (students: (Partial<Student> & {id: string})[]) => {
    const batch = writeBatch(db);
    students.forEach(student => {
        const { id, ...data } = student;
        const docRef = doc(db, 'students', id);
        batch.update(docRef, data);
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
            path: `/`, // Represents batch write
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
export const addDestination = (destination: NewDestination) => addDocument<Destination>('destinations', destination);
export const addDestinationsInBatch = async (destinations: NewDestination[]): Promise<Destination[]> => {
    const batch = writeBatch(db);
    const newDestinations: Destination[] = [];
    const existingDestsSnapshot = await getDocs(collection(db, 'destinations'));
    const existingNames = new Set(existingDestsSnapshot.docs.map(doc => doc.data().name.toLowerCase()));

    for (const dest of destinations) {
        if (!existingNames.has(dest.name.toLowerCase())) {
            const docRef = doc(collection(db, 'destinations'));
            batch.set(docRef, dest);
            newDestinations.push({ id: docRef.id, ...dest });
            existingNames.add(dest.name.toLowerCase()); // prevent adding duplicates from the same batch
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
    const docRef = db.doc('destinations/' + destinationId);
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
            path: `/`, // Batch write affects multiple paths
            operation: 'write',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
    });
};

// Teachers
export const getTeachers = () => fetchCollection<Teacher>('teachers');
export const onTeachersUpdate = (callback: (teachers: Teacher[]) => void) => onCollectionUpdate<Teacher>('teachers', callback);
export const addTeachersInBatch = async (teachers: NewTeacher[]): Promise<Teacher[]> => {
    const batch = writeBatch(db);
    const newTeachers: Teacher[] = [];
    const q = query(collection(db, 'teachers'));
    const existingDocs = await getDocs(q);
    const existingNames = new Set(existingDocs.docs.map(d => d.data().name));

    for (const teacher of teachers) {
        if (!existingNames.has(teacher.name)) {
            const docRef = doc(collection(db, 'teachers'));
            batch.set(docRef, teacher);
            newTeachers.push({ id: docRef.id, ...teacher });
            existingNames.add(teacher.name);
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
    
    // Delete the teacher doc
    batch.delete(doc(db, 'teachers', teacherId));
    
    // Remove from all route assignments
    const routesSnapshot = await getDocs(collection(db, 'routes'));
    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        if (routeData.teacherIds && routeData.teacherIds.includes(teacherId)) {
            const newTeacherIds = routeData.teacherIds.filter(id => id !== teacherId);
            batch.update(routeDoc.ref, { teacherIds: newTeacherIds });
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

export const deleteAllTeachers = async () => {
    const batch = writeBatch(db);
    
    const teachersSnapshot = await getDocs(collection(db, 'teachers'));
    teachersSnapshot.forEach(doc => batch.delete(doc.ref));
    
    const routesSnapshot = await getDocs(collection(db, 'routes'));
    routesSnapshot.forEach(doc => {
        batch.update(doc.ref, { teacherIds: [] });
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
    const trimmedName = destination.name.trim();
    if (!trimmedName) return;

    const mainDestQ = query(collection(db, "destinations"), where("name", "==", trimmedName));
    const mainDestSnap = await getDocs(mainDestQ);
    if (!mainDestSnap.empty) return;

    const suggestedDestQ = query(collection(db, "suggestedDestinations"), where("name", "==", trimmedName));
    const suggestedDestSnap = await getDocs(suggestedDestQ);
    if (suggestedDestSnap.empty) {
        await addDocument<Destination>('suggestedDestinations', { name: trimmedName });
    }
}
export const approveSuggestedDestination = async (suggestion: Destination) => {
    const batch = writeBatch(db);
    const newDestRef = doc(collection(db, 'destinations'));
    batch.set(newDestRef, { name: suggestion.name });
    batch.delete(doc(db, 'suggestedDestinations', suggestion.id));
    await batch.commit()
    .catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: `/`, // Batch write
            operation: 'write',
            requestResourceData: { approvedSuggestion: suggestion }
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

export const unassignStudentFromAllRoutes = async (studentId: string, routeTypes?: RouteType[]) => {
    if (!studentId) return;

    const routesSnapshot = await getDocs(collection(db, 'routes'));
    if (routesSnapshot.empty) return;

    const batch = writeBatch(db);
    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        
        // If routeTypes are specified, only check routes of those types
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
export const addLostItem = (item: NewLostItem) => addDocument<LostItem>('lostItems', item);
export const updateLostItem = (itemId: string, data: Partial<LostItem>) => {
    const docRef = doc(db, 'lostItems', itemId);
    updateDoc(docRef, data)
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
