import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAKqBgHVKQ9Fy3DyAy835S8o_61fbql1CM",
  authDomain: "passion-manager2.firebaseapp.com",
  projectId: "passion-manager2",
  storageBucket: "passion-manager2.firebasestorage.app",
  messagingSenderId: "524792693909",
  appId: "1:524792693909:web:9c23cea6f801f10c64079c"
};

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

// Firestore helper utilities for attendance subcollection and migration
import { collection, doc as firestoreDoc, setDoc, updateDoc, onSnapshot, query, orderBy, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { AttendanceRecord } from '../types';

/** Get reference to a specific attendance document for a date (format YYYY-MM-DD) */
export const getAttendanceDocRef = (date: string) => firestoreDoc(db, 'groups', 'main', 'attendance', date);

/** Reference to the attendance collection */
export const attendanceCollectionRef = collection(db, 'groups', 'main', 'attendance');

/** Subscribe to attendance subcollection updates, invoking callback with sorted records */
export const subscribeToAttendance = (callback: (records: AttendanceRecord[]) => void) => {
  const q = query(attendanceCollectionRef, orderBy('date'));
  const unsub = onSnapshot(q, (snapshot) => {
    const records: AttendanceRecord[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as AttendanceRecord;
      records.push(data);
    });
    callback(records);
  }, (error) => {
    console.error('Firestore attendance subscription error:', error);
  });
  return unsub;
};

/** Migrate legacy attendanceRecords array to the new subcollection if needed */
export const migrateLegacyAttendanceIfNeeded = async () => {
  const stateDocRef = getStateDocRef();
  const stateSnap = await getDoc(stateDocRef);
  if (!stateSnap.exists()) return;
  const stateData = stateSnap.data() as any;
  const legacy = stateData?.attendanceRecords;
  if (!legacy || !Array.isArray(legacy) || legacy.length === 0) return;
  // Ensure subcollection is empty before migrating
  const colSnap = await getDocs(attendanceCollectionRef);
  if (!colSnap.empty) return; // Already migrated
  // Migrate each attendance record
  const migrations = legacy.map((rec: any) =>
    setDoc(getAttendanceDocRef(rec.date), { date: rec.date, presentMemberIds: rec.presentMemberIds }, { merge: true })
  );
  await Promise.all(migrations);
  // Clear legacy field to avoid future confusion
  await updateDoc(stateDocRef, { attendanceRecords: [] });
};
