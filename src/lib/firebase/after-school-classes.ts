import { db } from '../firebase';
import { 
    collection, 
    doc, 
    updateDoc, 
    deleteDoc, 
    writeBatch,
    getDocs
} from 'firebase/firestore';
import { fetchCollection, onCollectionUpdate, addDocument } from './core';
import { AfterSchoolClass, NewAfterSchoolClass } from '../types';

const COLLECTION_NAME = 'afterSchoolClasses';

export const getAfterSchoolClasses = () => fetchCollection<AfterSchoolClass>(COLLECTION_NAME);
export const onAfterSchoolClassesUpdate = (callback: (classes: AfterSchoolClass[]) => void) => onCollectionUpdate<AfterSchoolClass>(COLLECTION_NAME, callback);
export const addAfterSchoolClass = (data: NewAfterSchoolClass) => addDocument<AfterSchoolClass>(COLLECTION_NAME, data);

export const updateAfterSchoolClass = async (id: string, data: Partial<AfterSchoolClass>) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, data);
};

export const deleteAfterSchoolClass = async (id: string) => {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
};

export const addAfterSchoolClassesInBatch = async (classes: NewAfterSchoolClass[]) => {
    const batch = writeBatch(db);
    classes.forEach(cls => {
        const docRef = doc(collection(db, COLLECTION_NAME));
        batch.set(docRef, cls);
    });
    await batch.commit();
};

export const clearAllAfterSchoolClasses = async () => {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
};
