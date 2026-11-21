import React, { useState, useMemo, useCallback } from 'react';
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
  const locale = language === 'es' ? es : enUS;
  const [searchQuery, setSearchQuery] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'present' | 'absent2Weeks'>('all');
  const [internalDate, setInternalDate] = useState<Date | null>(null);
  const [localMembers, setLocalMembers] = useState<Member[]>([]);

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

  const isAbsentTwoPlusWeeks = useCallback((member: Member) => {
    if (member.isArchived) return false;
    const now = new Date();

    if (member.joinDate) {
      try {
        const daysSinceJoin = differenceInDays(now, parseISO(member.joinDate));
        if (daysSinceJoin < 14) return false;
      } catch {
        // ignore
      }
    }

    const sortedRecords = [...attendanceRecords].sort((a, b) => b.date.localeCompare(a.date));
    const servicesLast14Days = sortedRecords.filter(r => {
      try {
        const days = differenceInDays(now, parseISO(r.date));
        return days >= 0 && days <= 14;
      } catch {
        return false;
      }
    });

    const targetServices = servicesLast14Days.length > 0 
      ? servicesLast14Days 
      : sortedRecords.slice(0, 2);

    if (targetServices.length === 0) return false;

    const attendedAny = targetServices.some(rec => {
      if (rec.date === dateKey) {
        return presentIds.includes(member.id);
      }
      return rec.presentMemberIds.includes(member.id);
    });

    return !attendedAny;
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

  return (
    <div className="flex flex-col h-full">
      {/* Header and Compact Horizontal Date Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t.attendance}</h2>
          <div className="flex items-center gap-2 text-slate-500 mt-1">
            <CalendarIcon className="w-4 h-4" />
            <span className="text-sm font-medium capitalize">{format(effectiveDate, 'EEEE, MMMM do, yyyy', { locale })}</span>
          </div>
        </div>

        {/* Compact Horizontal Date Bar & Monthly Calendar Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={handlePrevDay}
              aria-label="Previous"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white transition-all shadow-sm"
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
                  : "text-slate-600 hover:text-slate-900 hover:bg-white"
              )}
            >
              <span>Today</span>
            </button>
            <button
              type="button"
              onClick={handleNextDay}
              aria-label="Next"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white transition-all shadow-sm"
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
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm" 
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
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
        <div className="sticky top-0 z-20 bg-white pt-1 pb-4 border-b border-slate-100 mb-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white text-sm"
              />
            </div>

            <div className="flex items-center gap-4 justify-end shrink-0">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.present}</p>
                <p className="text-lg font-bold text-emerald-600">{stats.present}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.absent}</p>
                <p className="text-lg font-bold text-slate-400">{stats.absent}</p>
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
                      ? "bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-200"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
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
              <div className="text-center py-10 px-4 bg-slate-50/70 border border-dashed border-slate-200 rounded-2xl space-y-4">
                <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center mx-auto text-indigo-500">
                  <UserPlus className="w-6 h-6" />
                </div>
                <p className="text-sm text-slate-500">{t.noMembers}</p>
                <button
                  type="button"
                  onClick={handleQuickAdd}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Quick Add '{searchQuery.trim()}' & Mark Present</span>
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
                return (
                  <motion.button
                    key={member.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onToggleAttendance(dateKey, member.id)}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200",
                      isPresent 
                        ? "bg-emerald-50 border-emerald-100 shadow-sm" 
                        : "bg-white border-slate-100 hover:border-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors",
                        isPresent ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                      )}>
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <span className={cn(
                        "font-semibold transition-colors",
                        isPresent ? "text-emerald-900" : "text-slate-700"
                      )}>
                        {member.name}
                      </span>
                    </div>
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                      isPresent 
                        ? "bg-emerald-500 text-white scale-110" 
                        : "bg-slate-50 text-slate-300"
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
    </div>
  );
};