

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
  NewTeacher
} from './types';

// Generic function to fetch data from a collection
async function fetchCollection<T>(collectionName: string): Promise<T[]> {
  const querySnapshot = await getDocs(collection(db, collectionName));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
}

// Generic function to add a document to a collection
async function addDocument<T extends {id: string}>(collectionName: string, data: Omit<T, 'id'>): Promise<T> {
  const docRef = await addDoc(collection(db, collectionName), data);
  return { id: docRef.id, ...data } as T;
}

// Buses
export const getBuses = () => fetchCollection<Bus>('buses');
export const addBus = (bus: NewBus) => addDocument<Bus>('buses', bus);
export const deleteBus = async (busId: string) => {
    // Also delete associated routes
    const q = query(collection(db, "routes"), where("busId", "==", busId));
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    await deleteDoc(doc(db, 'buses', busId));
};
export const updateBus = async (busId: string, data: Partial<Bus>) => {
    await updateDoc(doc(db, 'buses', busId), data);
}


// Students
export const getStudents = () => fetchCollection<Student>('students');

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
        await updateDoc(docRef, student);
        const docSnap = await getDoc(docRef);
        return { id: docRef.id, ...docSnap.data() } as Student;
    } else {
        // Student doesn't exist, create new
        const docRef = await addDoc(collection(db, 'students'), student);
        const newStudentDoc = await getDoc(docRef);
        return { id: docRef.id, ...newStudentDoc.data() } as Student;
    }
};

export const updateStudent = async (studentId: string, data: Partial<Student>) => {
    await updateDoc(doc(db, 'students', studentId), data);
}
export const updateStudentsInBatch = async (students: (Partial<Student> & {id: string})[]) => {
    const batch = writeBatch(db);
    students.forEach(student => {
        const { id, ...data } = student;
        const docRef = doc(db, 'students', id);
        batch.update(docRef, data);
    });
    await batch.commit();
};

export const deleteStudentsInBatch = async (studentIds: string[]) => {
    const batch = writeBatch(db);
    
    // 1. Delete student documents
    studentIds.forEach(id => {
        const docRef = doc(db, 'students', id);
        batch.delete(docRef);
    });
    
    // 2. Unassign students from all routes
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

    await batch.commit();
};


// Destinations
export const getDestinations = () => fetchCollection<Destination>('destinations');
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
        await batch.commit();
    }
    return newDestinations;
}
export const deleteDestination = (destinationId: string) => deleteDoc(doc(db, 'destinations', destinationId));

// Teachers
export const getTeachers = () => fetchCollection<Teacher>('teachers');
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
    await batch.commit();
    return newTeachers;
};

// Routes
export const getRoutes = () => fetchCollection<Route>('routes');
export const getRoutesForBus = (busId: string) => {
    const q = query(collection(db, "routes"), where("busId", "==", busId));
    return getDocs(q).then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route)));
}
export const getRoutesByStop = async (stopId: string): Promise<Route[]> => {
    const mainRoutesQuery = query(collection(db, "routes"), where("stops", "array-contains", stopId), where("type", "in", ["Morning", "Afternoon"]));
    const afterSchoolRoutesQuery = query(collection(db, "routes"), where("stops", "array-contains", stopId), where("type", "==", "AfterSchool"));

    const [mainRoutesSnap, afterSchoolRoutesSnap] = await Promise.all([
        getDocs(mainRoutesQuery),
        getDocs(afterSchoolRoutesQuery),
    ]);

    const routes: Route[] = [];
    mainRoutesSnap.forEach(doc => routes.push({id: doc.id, ...doc.data()} as Route));
    afterSchoolRoutesSnap.forEach(doc => routes.push({id: doc.id, ...doc.data()} as Route));
    
    // This logic needs to be aware of which destination field to check. 
    // The query itself is tricky. Let's simplify and do filtering client-side for now where needed.
    // A better solution would be to restructure data, but for now we query all and let client filter.
    const allRoutesQuery = query(collection(db, "routes"), where("stops", "array-contains", stopId));
    const querySnapshot = await getDocs(allRoutesQuery);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route));
}
export const addRoute = async (route: Omit<Route, 'id'>) => {
    const docRef = await addDoc(collection(db, 'routes'), route);
    return docRef.id;
}
export const updateRouteSeating = async (routeId: string, seating: SeatingAssignment[]) => {
  await updateDoc(doc(db, 'routes', routeId), { seating });
};

export const updateSeatingForBusRoutes = async (routeIds: string[], seating: SeatingAssignment[]) => {
    const batch = writeBatch(db);
    routeIds.forEach(routeId => {
        const docRef = doc(db, 'routes', routeId);
        batch.update(docRef, { seating });
    });
    await batch.commit();
};

export const updateRouteStops = async (routeId: string, stops: string[]) => {
    await updateDoc(doc(db, 'routes', routeId), { stops });
}

export const updateAllBusRoutesSeating = async (busId: string, seating: SeatingAssignment[]) => {
    const q = query(collection(db, "routes"), where("busId", "==", busId));
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    querySnapshot.forEach(doc => {
        batch.update(doc.ref, { seating });
    });
    await batch.commit();
}


// Group Leader Records
export const getGroupLeaderRecords = (routeId: string) => fetchCollection<GroupLeaderRecord>(`routes/${routeId}/groupLeaderRecords`);

export const saveGroupLeaderRecords = async (routeId: string, records: Omit<GroupLeaderRecord, 'name'>[]) => {
    const batch = writeBatch(db);
    const recordsCollection = collection(db, `routes/${routeId}/groupLeaderRecords`);
    
    // First, fetch existing records to avoid overwriting them all, which can be destructive.
    const snapshot = await getDocs(recordsCollection);
    const existingRecords = snapshot.docs.map(d => d.data() as GroupLeaderRecord);

    const recordsToUpdate = new Map<string, Omit<GroupLeaderRecord, 'name'>>();
    records.forEach(r => recordsToUpdate.set(r.studentId + '_' + r.startDate, r));

    const recordsToDelete: string[] = [];

    // Check existing records against new ones
    existingRecords.forEach(existing => {
        const key = existing.studentId + '_' + existing.startDate;
        if (!recordsToUpdate.has(key)) {
            // If an existing record is not in the new list, it might have been deleted locally
            // This part of logic depends on how you handle deletions.
            // For now, let's assume we are only adding/updating.
        }
    });

    // Add or update records
    records.forEach(record => {
        const docRef = doc(recordsCollection, record.studentId + '_' + record.startDate);
        batch.set(docRef, record, { merge: true });
    });
    
    await batch.commit();
}


// Suggested Destinations (using a simple 'suggestedDestinations' collection)
export const getSuggestedDestinations = () => fetchCollection<Destination>('suggestedDestinations');
export const addSuggestedDestination = async (destination: { name: string }) => {
    // Check main destinations first
    const mainDestQ = query(collection(db, "destinations"), where("name", "==", destination.name));
    const mainDestSnap = await getDocs(mainDestQ);
    if (!mainDestSnap.empty) return; // Already exists as a main destination

    // Check suggested destinations
    const q = query(collection(db, "suggestedDestinations"), where("name", "==", destination.name));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        await addDocument<Destination>('suggestedDestinations', destination);
    }
}
export const approveSuggestedDestination = async (suggestion: Destination) => {
    const batch = writeBatch(db);
    // Add to main destinations
    const newDestRef = doc(collection(db, 'destinations'));
    batch.set(newDestRef, { name: suggestion.name });
    // Delete from suggestions
    batch.delete(doc(db, 'suggestedDestinations', suggestion.id));
    await batch.commit();
}
export const clearAllSuggestedDestinations = async () => {
    const suggestionsCollection = collection(db, 'suggestedDestinations');
    const snapshot = await getDocs(suggestionsCollection);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
};

export const unassignStudentFromAllRoutes = async (studentId: string) => {
    const routesSnapshot = await getDocs(collection(db, 'routes'));
    const batch = writeBatch(db);

    routesSnapshot.forEach(routeDoc => {
        const routeData = routeDoc.data() as Route;
        const newSeating = routeData.seating.map(seat => {
            if (seat.studentId === studentId) {
                return { ...seat, studentId: null };
            }
            return seat;
        });

        // Check if the seating actually changed to avoid unnecessary writes
        if (JSON.stringify(newSeating) !== JSON.stringify(routeData.seating)) {
            batch.update(routeDoc.ref, { seating: newSeating });
        }
    });

    await batch.commit();
};


// --- Attendance ---
export const getAttendance = async (routeId: string, date: string): Promise<AttendanceRecord | null> => {
  const docRef = doc(db, 'routes', routeId, 'attendance', date);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as AttendanceRecord;
  }
  return null;
};

export const updateAttendance = async (routeId: string, date: string, data: Partial<Omit<AttendanceRecord, 'id' | 'routeId'>>) => {
  const docRef = doc(db, 'routes', routeId, 'attendance', date);
  await setDoc(docRef, data, { merge: true });
};

export const onAttendanceUpdate = (routeId: string, date: string, callback: (record: AttendanceRecord | null) => void) => {
  const docRef = doc(db, 'routes', routeId, 'attendance', date);
  return onSnapshot(docRef, (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as AttendanceRecord);
    } else {
      callback(null);
    }
  });
};
