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
