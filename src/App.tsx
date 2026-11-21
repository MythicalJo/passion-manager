import React, { useState, useEffect } from 'react';
import { Users, Calendar as CalendarIcon, ClipboardCheck, History, Settings, BarChart3, RefreshCw, X as CloseIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Member, AttendanceRecord, ViewMode } from './types';
import { Calendar } from './components/Calendar';
import { MemberList } from './components/MemberList';
import { AttendanceTracker } from './components/AttendanceTracker';
import { CommunityView } from './components/CommunityView';
import { SettingsView } from './components/SettingsView';
import { Language, translations } from './translations';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { registerSW } from 'virtual:pwa-register';
import { auth, db, getStateDocRef, getAttendanceDocRef, attendanceCollectionRef, subscribeToAttendance, migrateLegacyAttendanceIfNeeded } from './lib/firebase';
import { onSnapshot, setDoc, getDoc, updateDoc, deleteDoc, getDocs, arrayUnion, arrayRemove } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function App() {
  const [view, setView] = useState<ViewMode>('attendance');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [gpsGroups, setGpsGroups] = useState<string[]>([]);
  const [language, setLanguage] = useState<Language>('es');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('yg_theme');
    return saved === 'dark';
  });

  const t = translations[language];

  // PWA Service Worker Registration & Update Listener
  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        // App is ready for offline usage
      },
    });
    setUpdateServiceWorker(() => update);
  }, []);

  // Apply dark class to <html> on mount and whenever isDark changes
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('yg_theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const sanitizeForFirestore = <T,>(data: T): T => {
    return JSON.parse(JSON.stringify(data));
  };

  // Load data from localStorage
  useEffect(() => {
    const savedMembers = localStorage.getItem('yg_members');
    const savedAttendance = localStorage.getItem('yg_attendance');
    const savedLanguage = localStorage.getItem('yg_language');
    const savedGpsGroups = localStorage.getItem('yg_gps_groups');
    if (savedMembers) setMembers(JSON.parse(savedMembers));
    if (savedAttendance) setAttendanceRecords(JSON.parse(savedAttendance));
    if (savedLanguage) setLanguage(savedLanguage as Language);
    if (savedGpsGroups) setGpsGroups(JSON.parse(savedGpsGroups));
  }, []);

  // Listen to Cloud Updates
  useEffect(() => {
    const stateDocRef = getStateDocRef();
    let unsubscribeState: (() => void) | null = null;
    let unsubscribeAttendance: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeState) {
        unsubscribeState();
        unsubscribeState = null;
      }
      if (unsubscribeAttendance) {
        unsubscribeAttendance();
        unsubscribeAttendance = null;
      }
      if (!user) return;

      try {
        // Run one-time automatic migration if needed
        await migrateLegacyAttendanceIfNeeded();

        const snap = await getDoc(stateDocRef);
        if (!snap.exists()) {
          const localMembersStr = localStorage.getItem('yg_members');
          const localGpsGroupsStr = localStorage.getItem('yg_gps_groups');
          const localMembers: Member[] = localMembersStr ? JSON.parse(localMembersStr) : [];
          const localGpsGroups: string[] = localGpsGroupsStr ? JSON.parse(localGpsGroupsStr) : [];

          const nowStr = new Date().toISOString();
          const seedPayload = sanitizeForFirestore({
            members: localMembers,
            gpsGroups: localGpsGroups,
            lastUpdated: nowStr,
            updatedAt: nowStr
          });
          await setDoc(stateDocRef, seedPayload, { merge: true });
          setLastSync(nowStr);
        }
      } catch (e) {
        console.warn('Initial check/seed doc error in App:', e);
      }

      // Subscribe to member profiles and gpsGroups in state doc
      unsubscribeState = onSnapshot(stateDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data) {
            if (Array.isArray(data.members)) setMembers(data.members);
            if (Array.isArray(data.gpsGroups)) setGpsGroups(data.gpsGroups);
            setLastSync(data.lastUpdated || data.updatedAt || new Date().toISOString());
          }
        }
      }, (error) => {
        console.error('Firestore state onSnapshot error:', error);
      });

      // Subscribe to dedicated attendance subcollection
      unsubscribeAttendance = subscribeToAttendance((records) => {
        setAttendanceRecords(records);
        localStorage.setItem('yg_attendance', JSON.stringify(records));
        setLastSync(new Date().toISOString());
      });
    });

    return () => {
      if (unsubscribeState) unsubscribeState();
      if (unsubscribeAttendance) unsubscribeAttendance();
      unsubscribeAuth();
    };
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('yg_members', JSON.stringify(members));
    localStorage.setItem('yg_attendance', JSON.stringify(attendanceRecords));
    localStorage.setItem('yg_gps_groups', JSON.stringify(gpsGroups));
  }, [members, attendanceRecords, gpsGroups]);

  // Helper to sync member profiles & gpsGroups to state doc (stripping all undefined fields)
  const pushToCloud = async (m: Member[], g: string[] = gpsGroups) => {
    if (!auth.currentUser) return;
    try {
      const stateDocRef = getStateDocRef();
      const nowStr = new Date().toISOString();
      const payload = sanitizeForFirestore({
        members: m,
        gpsGroups: g,
        lastUpdated: nowStr,
        updatedAt: nowStr
      });
      await setDoc(stateDocRef, payload, { merge: true });
      setLastSync(nowStr);
    } catch (e) {
      console.error('Error syncing to Firestore:', e);
    }
  };

  useEffect(() => {
    localStorage.setItem('yg_language', language);
  }, [language]);

  const handleAddGpsGroup = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || gpsGroups.includes(trimmed)) return;
    const newGpsGroups = [...gpsGroups, trimmed];
    setGpsGroups(newGpsGroups);
    pushToCloud(members, newGpsGroups);
  };

  const handleDeleteGpsGroup = (name: string) => {
    const newGpsGroups = gpsGroups.filter((g) => g !== name);
    const updatedMembers = members.map(m => m.gpsName === name ? { ...m, isGpsMember: false, gpsName: undefined } : m);
    setGpsGroups(newGpsGroups);
    setMembers(updatedMembers);
    pushToCloud(updatedMembers, newGpsGroups);
  };

  const handleAddMember = (data: { 
    name: string; 
    birthday?: string; 
    likes?: string; 
    likedFood?: string; 
    address?: string; 
    phone?: string; 
    instagram?: string;
    invitedBy?: string;
    isGpsMember?: boolean;
    gpsName?: string;
    occupation?: 'none' | 'studying' | 'working' | 'both';
    occupationTime?: 'morning' | 'night' | 'both' | 'none';
    isEvangelized?: boolean;
    isStaff?: boolean;
    ministry?: string;
  }) => {
    const newMember: Member = {
      id: crypto.randomUUID(),
      name: data.name,
      birthday: data.birthday,
      likes: data.likes,
      likedFood: data.likedFood,
      address: data.address,
      phone: data.phone,
      instagram: data.instagram,
      invitedBy: data.invitedBy,
      isGpsMember: data.isGpsMember,
      gpsName: data.gpsName,
      occupation: data.occupation,
      occupationTime: data.occupationTime,
      isEvangelized: data.isEvangelized,
      evangelizado: data.isEvangelized,
      evangelizadoDate: data.isEvangelized ? format(new Date(), 'yyyy-MM-dd') : undefined,
      isStaff: data.isStaff,
      ministry: data.ministry,
      joinDate: new Date().toISOString(),
    };
    const newMembers = [...members, newMember];
    setMembers(newMembers);
    pushToCloud(newMembers, gpsGroups);
  };

  const handleQuickAddMember = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newId = crypto.randomUUID();
    const newMember: Member = {
      id: newId,
      name: trimmed,
      joinDate: new Date().toISOString(),
    };
    const newMembers = [...members, newMember];
    setMembers(newMembers);

    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    let newAttendance = [...attendanceRecords];
    const existingRecord = newAttendance.find((r) => r.date === dateKey);
    if (existingRecord) {
      if (!existingRecord.presentMemberIds.includes(newId)) {
        newAttendance = newAttendance.map((r) => 
          r.date === dateKey 
            ? { ...r, presentMemberIds: [...r.presentMemberIds, newId] } 
            : r
        );
      }
    } else {
      newAttendance = [...newAttendance, { date: dateKey, presentMemberIds: [newId] }];
    }
    setAttendanceRecords(newAttendance);
    localStorage.setItem('yg_members', JSON.stringify(newMembers));
    localStorage.setItem('yg_attendance', JSON.stringify(newAttendance));
    pushToCloud(newMembers, gpsGroups);

    if (auth.currentUser) {
      try {
        const docRef = getAttendanceDocRef(dateKey);
        await setDoc(docRef, {
          date: dateKey,
          presentMemberIds: arrayUnion(newId)
        }, { merge: true });
        setLastSync(new Date().toISOString());
      } catch (e) {
        console.error('Error adding quick attendance in Firestore:', e);
      }
    }
  };

  const handleUpdateMember = (updatedMember: Member) => {
    const newMembers = members.map(m => m.id === updatedMember.id ? updatedMember : m);
    setMembers(newMembers);
    pushToCloud(newMembers, gpsGroups);
  };

  const handleBatchUpdateMembers = (updates: Partial<Member>[]) => {
    const newMembers = [...members];
    updates.forEach(update => {
      const index = newMembers.findIndex(m => m.id === update.id);
      if (index !== -1) {
        newMembers[index] = { ...newMembers[index], ...update };
      }
    });
    setMembers(newMembers);
    pushToCloud(newMembers, gpsGroups);
  };

  const handleDeleteMember = (id: string) => {
    const newMembers = members.filter((m) => m.id !== id);
    const newAttendance = attendanceRecords.map(record => ({
      ...record,
      presentMemberIds: record.presentMemberIds.filter(mid => mid !== id)
    }));
    setMembers(newMembers);
    setAttendanceRecords(newAttendance);
    pushToCloud(newMembers, gpsGroups);

    if (auth.currentUser) {
      attendanceRecords.forEach(async (r) => {
        if (r.presentMemberIds.includes(id)) {
          try {
            await updateDoc(getAttendanceDocRef(r.date), {
              presentMemberIds: arrayRemove(id)
            });
          } catch (e) {
            console.error('Error removing deleted member from attendance:', e);
          }
        }
      });
    }
  };

  const handleBatchDeleteMembers = (ids: string[]) => {
    const idSet = new Set(ids);
    const newMembers = members.filter((m) => !idSet.has(m.id));
    const newAttendance = attendanceRecords.map(record => ({
      ...record,
      presentMemberIds: record.presentMemberIds.filter(mid => !idSet.has(mid))
    }));
    setMembers(newMembers);
    setAttendanceRecords(newAttendance);
    pushToCloud(newMembers, gpsGroups);

    if (auth.currentUser) {
      attendanceRecords.forEach(async (r) => {
        const removedFromRecord = r.presentMemberIds.filter(mid => idSet.has(mid));
        if (removedFromRecord.length > 0) {
          try {
            await updateDoc(getAttendanceDocRef(r.date), {
              presentMemberIds: arrayRemove(...removedFromRecord)
            });
            setLastSync(new Date().toISOString());
          } catch (e) {
            console.error('Error removing deleted members from attendance:', e);
          }
        }
      });
    }
  };

  const handleToggleAttendance = async (date: string, memberId: string) => {
    let newAttendance = [...attendanceRecords];
    const existingRecord = newAttendance.find((r) => r.date === date);
    const isPresent = existingRecord ? existingRecord.presentMemberIds.includes(memberId) : false;

    if (existingRecord) {
      const newPresentIds = isPresent
        ? existingRecord.presentMemberIds.filter((id) => id !== memberId)
        : [...existingRecord.presentMemberIds, memberId];
      
      newAttendance = newAttendance.map((r) => 
        r.date === date ? { ...r, presentMemberIds: newPresentIds } : r
      );
    } else {
      newAttendance = [...newAttendance, { date, presentMemberIds: [memberId] }];
    }
    setAttendanceRecords(newAttendance);
    localStorage.setItem('yg_attendance', JSON.stringify(newAttendance));

    if (auth.currentUser) {
      const docRef = getAttendanceDocRef(date);
      try {
        if (isPresent) {
          await updateDoc(docRef, {
            presentMemberIds: arrayRemove(memberId)
          });
        } else {
          await setDoc(docRef, {
            date,
            presentMemberIds: arrayUnion(memberId)
          }, { merge: true });
        }
        setLastSync(new Date().toISOString());
      } catch (e) {
        console.error('Error updating attendance in Firestore:', e);
      }
    }
  };

  const handleImport = (data: { members: Member[]; attendanceRecords: AttendanceRecord[]; gpsGroups?: string[] }) => {
    setMembers(data.members);
    setAttendanceRecords(data.attendanceRecords);
    const groups = data.gpsGroups || [];
    setGpsGroups(groups);
    pushToCloud(data.members, groups);

    if (auth.currentUser && Array.isArray(data.attendanceRecords)) {
      data.attendanceRecords.forEach(async (rec) => {
        try {
          await setDoc(getAttendanceDocRef(rec.date), {
            date: rec.date,
            presentMemberIds: rec.presentMemberIds
          }, { merge: true });
        } catch (e) {
          console.error('Error syncing imported attendance record:', e);
        }
      });
    }
  };

  const handleClearAll = async () => {
    setMembers([]);
    setAttendanceRecords([]);
    setGpsGroups([]);
    localStorage.removeItem('yg_members');
    localStorage.removeItem('yg_attendance');
    localStorage.removeItem('yg_gps_groups');
    pushToCloud([], []);

    if (auth.currentUser) {
      try {
        const snap = await getDocs(attendanceCollectionRef);
        snap.forEach(async (d) => {
          await deleteDoc(d.ref);
        });
      } catch (e) {
        console.error('Error clearing attendance subcollection:', e);
      }
    }
  };

  const navItems = [
    { id: 'attendance', label: t.attendance, icon: ClipboardCheck },
    { id: 'members', label: t.members, icon: Users },
    { id: 'community', label: t.community, icon: BarChart3 },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  const hideSidebar = view === 'members' || view === 'community' || view === 'settings';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-24 bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-row md:flex-col items-center py-3 md:py-8 px-2 md:px-0 gap-2 md:gap-8 z-10">
        <div className="hidden md:flex w-12 h-12 bg-indigo-600 rounded-2xl items-center justify-center shadow-lg shadow-indigo-200 mb-4">
          <Users className="text-white w-6 h-6" />
        </div>
        <div className="flex flex-row md:flex-col gap-1 md:gap-4 flex-1 justify-around md:justify-start">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id as ViewMode)}
              className={cn(
                "p-2 md:p-3 rounded-xl md:rounded-2xl transition-all duration-200 flex flex-col items-center gap-1 group min-w-[60px] md:min-w-0",
                view === item.id 
                  ? "bg-indigo-50 dark:bg-indigo-950 text-indigo-600" 
                  : "text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300"
              )}
            >
              <item.icon className={cn("w-5 h-5 md:w-6 md:h-6", view === item.id ? "scale-110" : "group-hover:scale-110 transition-transform")} />
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-wider">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Left Section: Calendar and Secondary Info */}
        <AnimatePresence mode="wait">
          {!hideSidebar && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 'auto', opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className={cn(
                "w-full lg:w-96 bg-slate-50 dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 overflow-hidden whitespace-nowrap",
                view === 'attendance' && "hidden lg:block"
              )}
            >
              <div className="p-6 md:p-8 flex flex-col gap-8 w-full lg:w-96">
                <header className="mb-2">
                  <h1 className="text-sm font-bold text-indigo-600 uppercase tracking-[0.2em] mb-1">{t.youthGroup}</h1>
                  <p className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{t.manager}</p>
                </header>

                <Calendar 
                  selectedDate={selectedDate} 
                  onDateSelect={setSelectedDate}
                  language={language}
                  attendanceRecords={attendanceRecords}
                  members={members}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right Section: Dynamic View */}
        <div className={cn(
          "flex-1 p-4 md:p-8 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200/50 dark:shadow-slate-950/50 overflow-hidden relative z-10 transition-all duration-300",
          !hideSidebar ? "lg:rounded-l-[3rem]" : "rounded-0"
        )}>
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {view === 'attendance' && (
                <AttendanceTracker
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  members={members}
                  attendanceRecords={attendanceRecords}
                  onToggleAttendance={handleToggleAttendance}
                  onQuickAddMember={handleQuickAddMember}
                  language={language}
                />
              )}
              {view === 'members' && (
                <MemberList
                  members={members}
                  gpsGroups={gpsGroups}
                  onAddMember={handleAddMember}
                  onUpdateMember={handleUpdateMember}
                  onBatchUpdateMembers={handleBatchUpdateMembers}
                  onBatchDeleteMembers={handleBatchDeleteMembers}
                  onDeleteMember={handleDeleteMember}
                  language={language}
                />
              )}
              {view === 'community' && (
                <CommunityView
                  members={members}
                  attendanceRecords={attendanceRecords}
                  gpsGroups={gpsGroups}
                  onAddGpsGroup={handleAddGpsGroup}
                  onDeleteGpsGroup={handleDeleteGpsGroup}
                  onUpdateMember={handleUpdateMember}
                  language={language}
                />
              )}
              {view === 'settings' && (
                <SettingsView
                  members={members}
                  attendanceRecords={attendanceRecords}
                  onImport={handleImport}
                  onClearAll={handleClearAll}
                  language={language}
                  onLanguageChange={setLanguage}
                  isDark={isDark}
                  onToggleDark={() => setIsDark(d => !d)}
                  lastSync={lastSync}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* PWA Update Reload Banner */}
      <AnimatePresence>
        {needRefresh && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ duration: 0.2 }}
            role="alert"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] max-w-md w-[92vw] sm:w-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 px-4 py-3 rounded-2xl shadow-2xl border border-indigo-200 dark:border-indigo-900/80 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <RefreshCw className="w-4 h-4 animate-spin-slow" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">
                  {t.updateAvailable}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {t.updateAvailableDesc}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (updateServiceWorker) {
                    updateServiceWorker(true);
                  }
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-200 dark:shadow-indigo-950 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.reload}</span>
              </button>
              <button
                type="button"
                onClick={() => setNeedRefresh(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title={t.dismiss}
              >
                <CloseIcon className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
