import React, { useState, useEffect } from 'react';
import { Users, Calendar as CalendarIcon, ClipboardCheck, History, Settings, BarChart3 } from 'lucide-react';
import { Member, AttendanceRecord, ViewMode } from './types';
import { Calendar } from './components/Calendar';
import { MemberList } from './components/MemberList';
import { AttendanceTracker } from './components/AttendanceTracker';
import { CommunityView } from './components/CommunityView';
import { SettingsView } from './components/SettingsView';
import { Language, translations } from './translations';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import { syncToCloud, listenToCloud, SyncData } from './lib/gists';

export default function App() {
  const [view, setView] = useState<ViewMode>('attendance');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [members, setMembers] = useState<Member[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [language, setLanguage] = useState<Language>('es');

  const t = translations[language];

  // Load data from localStorage
  useEffect(() => {
    const savedMembers = localStorage.getItem('yg_members');
    const savedAttendance = localStorage.getItem('yg_attendance');
    const savedLanguage = localStorage.getItem('yg_language');
    if (savedMembers) setMembers(JSON.parse(savedMembers));
    if (savedAttendance) setAttendanceRecords(JSON.parse(savedAttendance));
    if (savedLanguage) setLanguage(savedLanguage as Language);
  }, []);

  // Listen to Cloud Updates
  useEffect(() => {
    const unsubscribe = listenToCloud((data: SyncData) => {
      if (data.members) setMembers(data.members);
      if (data.attendanceRecords) setAttendanceRecords(data.attendanceRecords);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('yg_members', JSON.stringify(members));
    localStorage.setItem('yg_attendance', JSON.stringify(attendanceRecords));
  }, [members, attendanceRecords]);

  // Helper to sync to cloud ONLY on explicitly triggered user modifications
  const pushToCloud = (m: Member[], a: AttendanceRecord[]) => {
    syncToCloud({ members: m, attendanceRecords: a, updatedAt: new Date().toISOString() });
  };

  useEffect(() => {
    localStorage.setItem('yg_language', language);
  }, [language]);

  const handleAddMember = (data: { 
    name: string; 
    birthday?: string; 
    likes?: string; 
    likedFood?: string; 
    address?: string; 
    phone?: string;
    isGpsMember?: boolean;
    gpsName?: string;
  }) => {
    const newMember: Member = {
      id: crypto.randomUUID(),
      name: data.name,
      birthday: data.birthday,
      likes: data.likes,
      likedFood: data.likedFood,
      address: data.address,
      phone: data.phone,
      isGpsMember: data.isGpsMember,
      gpsName: data.gpsName,
      joinDate: new Date().toISOString(),
    };
    const newMembers = [...members, newMember];
    setMembers(newMembers);
    pushToCloud(newMembers, attendanceRecords);
  };

  const handleUpdateMember = (updatedMember: Member) => {
    const newMembers = members.map(m => m.id === updatedMember.id ? updatedMember : m);
    setMembers(newMembers);
    pushToCloud(newMembers, attendanceRecords);
  };

  const handleDeleteMember = (id: string) => {
    const newMembers = members.filter((m) => m.id !== id);
    // Also clean up attendance records
    const newAttendance = attendanceRecords.map(record => ({
      ...record,
      presentMemberIds: record.presentMemberIds.filter(mid => mid !== id)
    }));
    setMembers(newMembers);
    setAttendanceRecords(newAttendance);
    pushToCloud(newMembers, newAttendance);
  };

  const handleToggleAttendance = (date: string, memberId: string) => {
    let newAttendance = [...attendanceRecords];
    const existingRecord = newAttendance.find((r) => r.date === date);
    if (existingRecord) {
      const isPresent = existingRecord.presentMemberIds.includes(memberId);
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
    pushToCloud(members, newAttendance);
  };

  const handleImport = (data: { members: Member[]; attendanceRecords: AttendanceRecord[] }) => {
    setMembers(data.members);
    setAttendanceRecords(data.attendanceRecords);
    pushToCloud(data.members, data.attendanceRecords);
  };

  const handleClearAll = () => {
    setMembers([]);
    setAttendanceRecords([]);
    localStorage.removeItem('yg_members');
    localStorage.removeItem('yg_attendance');
    pushToCloud([], []);
  };

  const navItems = [
    { id: 'attendance', label: t.attendance, icon: ClipboardCheck },
    { id: 'members', label: t.members, icon: Users },
    { id: 'community', label: t.community, icon: BarChart3 },
    { id: 'settings', label: t.settings, icon: Settings },
  ];

  const hideSidebar = view === 'members' || view === 'community' || view === 'settings';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <nav className="w-full md:w-24 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-row md:flex-col items-center py-3 md:py-8 px-2 md:px-0 gap-2 md:gap-8 z-10">
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
                  ? "bg-indigo-50 text-indigo-600" 
                  : "text-slate-400 hover:bg-slate-50 hover:text-slate-600"
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
              className="w-full lg:w-96 bg-slate-50 border-r border-slate-100 overflow-hidden whitespace-nowrap"
            >
              <div className="p-6 md:p-8 flex flex-col gap-8 w-full lg:w-96">
                <header className="mb-2">
                  <h1 className="text-sm font-bold text-indigo-600 uppercase tracking-[0.2em] mb-1">{t.youthGroup}</h1>
                  <p className="text-3xl font-black text-slate-900 tracking-tight">{t.manager}</p>
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
          "flex-1 p-4 md:p-8 bg-white shadow-2xl shadow-slate-200/50 overflow-hidden relative z-10 transition-all duration-300",
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
                  members={members}
                  attendanceRecords={attendanceRecords}
                  onToggleAttendance={handleToggleAttendance}
                  language={language}
                />
              )}
              {view === 'members' && (
                <MemberList
                  members={members}
                  onAddMember={handleAddMember}
                  onUpdateMember={handleUpdateMember}
                  onDeleteMember={handleDeleteMember}
                  language={language}
                />
              )}
              {view === 'community' && (
                <CommunityView
                  members={members}
                  attendanceRecords={attendanceRecords}
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
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
