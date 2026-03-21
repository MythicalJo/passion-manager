import React from 'react';
import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { Check, X, Users, Calendar as CalendarIcon, Search } from 'lucide-react';
import { Member, AttendanceRecord } from '../types';
import { Language, translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface AttendanceTrackerProps {
  selectedDate: Date;
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  onToggleAttendance: (date: string, memberId: string) => void;
  language: Language;
}

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  selectedDate,
  members,
  attendanceRecords,
  onToggleAttendance,
  language,
}) => {
  const t = translations[language];
  const locale = language === 'es' ? es : enUS;
  const [searchQuery, setSearchQuery] = React.useState('');
  
  const dateKey = format(selectedDate, 'yyyy-MM-dd');
  const record = attendanceRecords.find((r) => r.date === dateKey);
  const presentIds = record?.presentMemberIds || [];

  const filteredMembers = React.useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return members
      .filter(m => !m.isArchived && m.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, searchQuery]);

  const stats = {
    total: members.filter(m => !m.isArchived).length,
    present: presentIds.length,
    absent: members.filter(m => !m.isArchived).length - presentIds.length,
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{t.attendance}</h2>
          <div className="flex items-center gap-2 text-slate-500 mt-1">
            <CalendarIcon className="w-4 h-4" />
            <span className="text-sm font-medium capitalize">{format(selectedDate, 'EEEE, MMMM do, yyyy', { locale })}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white text-sm"
            />
          </div>
          <div className="flex gap-4 shrink-0">
            <div className="text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.present}</p>
              <p className="text-xl font-bold text-emerald-600">{stats.present}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.absent}</p>
              <p className="text-xl font-bold text-slate-400">{stats.absent}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2">
        <div className="space-y-3">
          {members.filter(m => !m.isArchived).length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t.addMembersPrompt}</p>
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t.noMembers}</p>
            </div>
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
