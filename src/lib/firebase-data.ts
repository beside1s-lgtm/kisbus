
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
export const addStudent = (student: NewStudent) => addDocument<Student>('students', student);
export const updateStudent = async (studentId: string, data: Partial<Student>) => {
    await updateDoc(doc(db, 'students', studentId), data);
}

// Destinations
export const getDestinations = () => fetchCollection<Destination>('destinations');
export const addDestination = (destination: NewDestination) => addDocument<Destination>('destinations', destination);
export const addDestinationsInBatch = async (destinations: NewDestination[]): Promise<Destination[]> => {
    const batch = writeBatch(db);
    const newDestinations: Destination[] = [];
    destinations.forEach(dest => {
        const docRef = doc(collection(db, 'destinations'));
        batch.set(docRef, dest);
        newDestinations.push({ id: docRef.id, ...dest });
    });
    await batch.commit();
    return newDestinations;
}
export const deleteDestination = (destinationId: string) => deleteDoc(doc(db, 'destinations', destinationId));

// Routes
export const getRoutes = () => fetchCollection<Route>('routes');
export const getRoutesForBus = (busId: string) => {
    const q = query(collection(db, "routes"), where("busId", "==", busId));
    return getDocs(q).then(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Route)));
}
export const addRoute = async (route: Omit<Route, 'id'>) => {
    const docRef = await addDoc(collection(db, 'routes'), route);
    return docRef.id;
}
export const updateRouteSeating = async (routeId: string, seating: SeatingAssignment[]) => {
  await updateDoc(doc(db, 'routes', routeId), { seating });
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

export const saveGroupLeaderRecords = async (routeId: string, records: GroupLeaderRecord[]) => {
    const batch = writeBatch(db);
    const recordsCollection = collection(db, `routes/${routeId}/groupLeaderRecords`);
    // Simple approach: clear and re-add. For high-frequency, use individual updates.
    const snapshot = await getDocs(recordsCollection);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    records.forEach(record => {
        const docRef = doc(recordsCollection, record.studentId + '_' + record.startDate);
        batch.set(docRef, record);
    });
    await batch.commit();
}

// Suggested Destinations (using a simple 'suggestedDestinations' collection)
export const getSuggestedDestinations = () => fetchCollection<Destination>('suggestedDestinations');
export const addSuggestedDestination = (destination: { name: string }) => addDocument<Destination>('suggestedDestinations', destination);
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
