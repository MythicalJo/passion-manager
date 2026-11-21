import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut as fbSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from './firebase';
import { Member, AttendanceRecord } from '../types';

export interface SyncData {
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  updatedAt?: string;
}

export const getStateDocRef = () => doc(db, 'groups', 'main', 'data', 'state');

export const subscribeToAuth = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export const signInLeader = async (email: string, password: string): Promise<User> => {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
};

export const signOutLeader = async (): Promise<void> => {
  await fbSignOut(auth);
};

export const getCurrentLeader = (): User | null => {
  return auth.currentUser;
};

let lastSyncDate = new Date(0).toISOString();
let lastError = 'None';

export const getLastSyncDate = () => lastSyncDate;
export const getLastError = () => lastError;

export const syncToCloud = async (data: SyncData): Promise<boolean> => {
  if (!auth.currentUser) return false;
  try {
    const docRef = getStateDocRef();
    await setDoc(docRef, {
      members: data.members,
      attendanceRecords: data.attendanceRecords,
      updatedAt: data.updatedAt || new Date().toISOString()
    }, { merge: true });
    lastSyncDate = new Date().toISOString();
    lastError = 'None';
    return true;
  } catch (error: any) {
    lastError = error?.message || 'Error updating Firestore';
    console.error('Error syncing to Firestore:', error);
    return false;
  }
};

export const listenToCloud = (onDataUpdate: (data: SyncData) => void): (() => void) => {
  let unsubscribeDoc: (() => void) | null = null;

  const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (unsubscribeDoc) {
      unsubscribeDoc();
      unsubscribeDoc = null;
    }

    if (!user) {
      return;
    }

    const docRef = getStateDocRef();

    try {
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        const localMembersStr = localStorage.getItem('yg_members');
        const localAttendanceStr = localStorage.getItem('yg_attendance');
        const localMembers: Member[] = localMembersStr ? JSON.parse(localMembersStr) : [];
        const localAttendance: AttendanceRecord[] = localAttendanceStr ? JSON.parse(localAttendanceStr) : [];

        await setDoc(docRef, {
          members: localMembers,
          attendanceRecords: localAttendance,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (e: any) {
      console.warn('Initial check/seed doc error:', e);
    }

    unsubscribeDoc = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data) {
          lastSyncDate = data.updatedAt || new Date().toISOString();
          lastError = 'None';
          onDataUpdate({
            members: Array.isArray(data.members) ? data.members : [],
            attendanceRecords: Array.isArray(data.attendanceRecords) ? data.attendanceRecords : [],
            updatedAt: data.updatedAt
          });
        }
      }
    }, (error) => {
      lastError = error.message;
      console.error('Firestore onSnapshot error:', error);
    });
  });

  return () => {
    if (unsubscribeDoc) unsubscribeDoc();
    unsubscribeAuth();
  };
};
