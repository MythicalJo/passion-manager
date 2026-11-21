import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { format, addDays, isSameDay, differenceInDays, parseISO } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { Check, X, Users, Calendar as CalendarIcon, Search, ChevronLeft, ChevronRight, UserPlus, Plus } from 'lucide-react';
import { Member, AttendanceRecord } from '../types';
import { Language, translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Calendar } from './Calendar';

interface AttendanceTrackerProps {
  selectedDate: Date;
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  onToggleAttendance: (date: string, memberId: string) => void;
  language: Language;
  onDateSelect?: (date: Date) => void;
  onQuickAddMember?: (name: string) => void;
}

interface UndoToastState {
  memberId: string;
  memberName: string;
  action: 'present' | 'absent';
  date: string;
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  selectedDate,
  members,
  attendanceRecords,
  onToggleAttendance,
  language,
  onDateSelect,
  onQuickAddMember,
}) => {
  const t = translations[language];
  const isEs = language === 'es';
  const locale = isEs ? es : enUS;
  const [searchQuery, setSearchQuery] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'present' | 'absent2Weeks'>('all');
  const [internalDate, setInternalDate] = useState<Date | null>(null);
  const [localMembers, setLocalMembers] = useState<Member[]>([]);

  // Undo Toast state & timer
  const [toast, setToast] = useState<UndoToastState | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const effectiveDate = onDateSelect ? selectedDate : (internalDate ?? selectedDate);
  const dateKey = format(effectiveDate, 'yyyy-MM-dd');
  const record = attendanceRecords.find((r) => r.date === dateKey);
  const presentIds = record?.presentMemberIds || [];

  const handleDateChange = (d: Date) => {
    if (onDateSelect) {
      onDateSelect(d);
    } else {
      setInternalDate(d);
    }
  };

  const handlePrevDay = () => handleDateChange(addDays(effectiveDate, -1));
  const handleToday = () => handleDateChange(new Date());
  const handleNextDay = () => handleDateChange(addDays(effectiveDate, 1));

  const allMembers = useMemo(() => {
    if (localMembers.length === 0) return members;
    const existingIds = new Set(members.map(m => m.id));
    const newlyAdded = localMembers.filter(m => !existingIds.has(m.id));
    return [...members, ...newlyAdded];
  }, [members, localMembers]);

  // Never-Attended Rule: Members with 0 total attendance records are NEVER flagged as at-risk/absent.
  // Only flag members who have attended at least 1 meeting previously AND whose last attended date was 14+ days ago.
  const isAbsentTwoPlusWeeks = useCallback((member: Member) => {
    if (member.isArchived) return false;
    const now = new Date();

    const isPresentOnSelectedDate = presentIds.includes(member.id);

    const attendedDates: string[] = [];
    attendanceRecords.forEach(r => {
      if (r.date === dateKey) {
        if (isPresentOnSelectedDate) attendedDates.push(r.date);
      } else {
        if (r.presentMemberIds.includes(member.id)) attendedDates.push(r.date);
      }
    });
    if (isPresentOnSelectedDate && !attendanceRecords.some(r => r.date === dateKey)) {
      attendedDates.push(dateKey);
    }

    // Members with 0 total attendance records across all dates are NEVER flagged
    if (attendedDates.length === 0) return false;

    attendedDates.sort((a, b) => b.localeCompare(a));
    const lastAttendedDate = attendedDates[0];

    try {
      const daysSinceLastAttended = differenceInDays(now, parseISO(lastAttendedDate));
      return daysSinceLastAttended >= 14;
    } catch {
      return false;
    }
  }, [attendanceRecords, presentIds, dateKey]);

  // Newcomer check: joinDate is within the last 14 days
  const isNewcomer = useCallback((member: Member): boolean => {
    if (!member.joinDate) return false;
    try {
      const now = new Date();
      const days = differenceInDays(now, parseISO(member.joinDate));
      return days >= 0 && days <= 14;
    } catch {
      return false;
    }
  }, []);

  // Streak Counter: 4 or more consecutive attended meetings
  const calculateStreak = useCallback((memberId: string): number => {
    const isPresentCurrent = presentIds.includes(memberId);
    const meetingDatesSet = new Set<string>(
      attendanceRecords
        .filter(r => r.presentMemberIds.length > 0 || r.date === dateKey)
        .map(r => r.date)
    );
    if (isPresentCurrent) meetingDatesSet.add(dateKey);

    const sortedDates = Array.from(meetingDatesSet).sort((a: string, b: string) => b.localeCompare(a));
    if (sortedDates.length === 0) return 0;

    let streakLatest = 0;
    for (const d of sortedDates) {
      const present = d === dateKey
        ? isPresentCurrent
        : (attendanceRecords.find(r => r.date === d)?.presentMemberIds.includes(memberId) ?? false);
      if (present) {
        streakLatest++;
      } else {
        break;
      }
    }

    let streakPast = 0;
    const pastDates = sortedDates.filter(d => d < dateKey);
    for (const d of pastDates) {
      const present = attendanceRecords.find(r => r.date === d)?.presentMemberIds.includes(memberId) ?? false;
      if (present) {
        streakPast++;
      } else {
        break;
      }
    }

    let maxConsecutive = 0;
    let currentRun = 0;
    const chronologicalDates = [...sortedDates].sort((a: string, b: string) => a.localeCompare(b));
    for (const d of chronologicalDates) {
      const present = d === dateKey
        ? isPresentCurrent
        : (attendanceRecords.find(r => r.date === d)?.presentMemberIds.includes(memberId) ?? false);
      if (present) {
        currentRun++;
        if (currentRun > maxConsecutive) maxConsecutive = currentRun;
      } else {
        currentRun = 0;
      }
    }

    return Math.max(streakLatest, streakPast, maxConsecutive);
  }, [attendanceRecords, presentIds, dateKey]);

  const filteredMembers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return allMembers
      .filter(m => {
        if (m.isArchived) return false;
        if (query && !m.name.toLowerCase().includes(query)) return false;
        if (activeFilter === 'present') return presentIds.includes(m.id);
        if (activeFilter === 'absent2Weeks') return isAbsentTwoPlusWeeks(m);
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allMembers, searchQuery, activeFilter, presentIds, isAbsentTwoPlusWeeks]);

  const stats = {
    total: allMembers.filter(m => !m.isArchived).length,
    present: presentIds.length,
    absent: allMembers.filter(m => !m.isArchived).length - presentIds.length,
  };

  const handleToggle = (member: Member) => {
    const isCurrentlyPresent = presentIds.includes(member.id);
    const newAction = isCurrentlyPresent ? 'absent' : 'present';

    onToggleAttendance(dateKey, member.id);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    setToast({
      memberId: member.id,
      memberName: member.name,
      action: newAction,
      date: dateKey,
    });

    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  const handleUndo = () => {
    if (!toast) return;
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    onToggleAttendance(toast.date, toast.memberId);
    setToast(null);
  };

  const handleQuickAdd = () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    const newId = crypto.randomUUID();
    const newMember: Member = {
      id: newId,
      name: trimmed,
      joinDate: new Date().toISOString(),
    };

    if (onQuickAddMember) {
      onQuickAddMember(trimmed);
    } else {
      setLocalMembers(prev => [...prev, newMember]);
      onToggleAttendance(dateKey, newId);
    }
  };

  const filterOptions = [
    { id: 'all' as const, label: 'All' },
    { id: 'present' as const, label: 'Present' },
    { id: 'absent2Weeks' as const, label: 'Absent 2+ Weeks' },
  ];

  const quickAddText = (t.quickAddMarkPresent || "+ Quick Add '{name}' & Mark Present")
    .replace('{name}', searchQuery.trim());

  return (
    <div className="flex flex-col h-full relative">
      {/* Header and Compact Horizontal Date Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t.attendance}</h2>
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mt-1">
            <CalendarIcon className="w-4 h-4" />
            <span className="text-sm font-medium capitalize">{format(effectiveDate, 'EEEE, MMMM do, yyyy', { locale })}</span>
          </div>
        </div>

        {/* Compact Horizontal Date Bar & Monthly Calendar Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={handlePrevDay}
              aria-label="Previous"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>&lt; Previous</span>
            </button>
            <button
              type="button"
              onClick={handleToday}
              aria-label="Today"
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm",
                isSameDay(effectiveDate, new Date())
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700"
              )}
            >
              <span>Today</span>
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              aria-label="Next"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm"
            >
              <span>Next &gt;</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowCalendar(prev => !prev)}
            aria-label="Toggle Calendar"
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all",
              showCalendar 
                ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 shadow-sm" 
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            )}
          >
            <CalendarIcon className="w-4 h-4" />
            <span>Calendar</span>
          </button>
        </div>
      </div>

      {/* Collapsible Monthly Calendar */}
      <AnimatePresence>
        {showCalendar && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-4"
          >
            <Calendar
              selectedDate={effectiveDate}
              onDateSelect={(d) => {
                handleDateChange(d);
              }}
              language={language}
              attendanceRecords={attendanceRecords}
              members={allMembers}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main List Area with Sticky Search and Filter Pills */}
      <div className="flex-1 overflow-y-auto pr-2 relative">
        <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 pt-1 pb-4 border-b border-slate-100 dark:border-slate-800 mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm"
              />
            </div>

            <div className="flex items-center gap-4 justify-end shrink-0">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.present}</p>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{stats.present}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.absent}</p>
                <p className="text-lg font-bold text-slate-400 dark:text-slate-500">{stats.absent}</p>
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
            {filterOptions.map((opt) => {
              const isSelected = activeFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setActiveFilter(opt.id)}
                  aria-label={opt.label}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border shrink-0",
                    isSelected
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-950"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                  )}
                >
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Member Items or Empty State with Quick Add Button */}
        <div className="space-y-3 pb-6">
          {filteredMembers.length === 0 ? (
            searchQuery.trim().length > 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center mx-auto text-indigo-500">
                  <UserPlus className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t.noMembers}</p>
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 dark:shadow-indigo-950 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>{quickAddText}</span>
                </button>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>{t.addMembersPrompt}</p>
              </div>
            )
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredMembers.map((member) => {
                const isPresent = presentIds.includes(member.id);
                const streak = calculateStreak(member.id);
                const newcomer = isNewcomer(member);

                return (
                  <motion.button
                    key={member.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleToggle(member)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 text-left",
                      isPresent 
                        ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-100 dark:border-emerald-900/60 shadow-sm" 
                        : "bg-white dark:bg-slate-800/90 border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors shrink-0",
                        isPresent ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300"
                      )}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className={cn(
                          "font-semibold transition-colors truncate",
                          isPresent ? "text-emerald-900 dark:text-emerald-200" : "text-slate-700 dark:text-slate-200"
                        )}>
                          {member.name}
                        </span>
                        {member.isStaff && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[9px] font-black uppercase tracking-wider shrink-0">
                            {t.staff}
                          </span>
                        )}
                        {newcomer && (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-100/80 dark:border-emerald-800/80 shrink-0">
                            {t.newBadge || (isEs ? 'Nuevo' : 'New')}
                          </span>
                        )}
                        {streak >= 4 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-[10px] font-bold tracking-wider border border-amber-200/80 dark:border-amber-800/80 shrink-0 flex items-center gap-0.5">
                            🔥 4+
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ml-2",
                      isPresent 
                        ? "bg-emerald-500 text-white scale-110" 
                        : "bg-slate-50 dark:bg-slate-700 text-slate-300 dark:text-slate-400"
                    )}>
                      {isPresent ? <Check className="w-5 h-5" /> : <X className="w-4 h-4" />}
                    </div>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Undo Toast (4 seconds) */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            role="status"
            aria-live="polite"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-medium border border-slate-700 whitespace-nowrap max-w-[90vw]"
          >
            <span>
              {toast.action === 'present'
                ? (t.markedPresentUndo
                    ? t.markedPresentUndo.replace('{name}', toast.memberName).split('—')[0].trim()
                    : `Marked ${toast.memberName} present`)
                : (t.markedAbsentUndo
                    ? t.markedAbsentUndo.replace('{name}', toast.memberName).split('—')[0].trim()
                    : `Marked ${toast.memberName} absent`)}
            </span>
            <span className="text-slate-400">—</span>
            <button
              type="button"
              onClick={handleUndo}
              aria-label="Undo"
              className="text-amber-400 hover:text-amber-300 font-bold underline transition-colors"
            >
              {t.undo || (isEs ? 'Deshacer' : 'Undo')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
