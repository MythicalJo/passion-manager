import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getFirestore, doc, setDoc, onSnapshot, getDoc, Unsubscribe } from 'firebase/firestore';
import { Member, AttendanceRecord } from '../types';

export interface SyncData {
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  updatedAt: string;
}

const CONFIG_KEY = 'yg_firebase_config';

export const getFirebaseConfig = (): FirebaseOptions | null => {
  const configStr = localStorage.getItem(CONFIG_KEY);
  if (!configStr) return null;
  try {
    return JSON.parse(configStr);
  } catch {
    return null;
  }
};

export const saveFirebaseConfig = (config: string): boolean => {
  try {
    // Validate it's JSON
    const parsed = JSON.parse(config);
    if (!parsed.projectId) throw new Error('Invalid config');
    localStorage.setItem(CONFIG_KEY, config);
    return true;
  } catch {
    return false;
  }
};

export const clearFirebaseConfig = () => {
  localStorage.removeItem(CONFIG_KEY);
};

export const initFirebase = () => {
  const config = getFirebaseConfig();
  if (!config) return null;
  
  try {
    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    return getFirestore(app);
  } catch (error) {
    console.error("Failed to initialize Firebase", error);
    return null;
  }
};

export const syncToCloud = async (data: SyncData) => {
  const db = initFirebase();
  if (!db) return false;
  
  try {
    await setDoc(doc(db, "app_data", "main_sync"), data);
    return true;
  } catch (error) {
    console.error("Error syncing to cloud:", error);
    return false;
  }
};

export const listenToCloud = (onDataUpdate: (data: SyncData) => void): Unsubscribe | null => {
  const db = initFirebase();
  if (!db) return null;
  
  try {
    const unsubscribe = onSnapshot(doc(db, "app_data", "main_sync"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SyncData;
        onDataUpdate(data);
      }
    });
    return unsubscribe;
  } catch (error) {
    console.error("Error listening to cloud:", error);
    return null;
  }
};
