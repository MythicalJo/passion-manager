import React, { useState } from 'react';
import { Users, TrendingUp, AlertCircle, Calendar, CheckCircle2, Compass, X, XCircle } from 'lucide-react';
import { Member, AttendanceRecord } from '../types';
import { Language, translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { format, subMonths, startOfMonth, isAfter, parseISO } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface CommunityViewProps {
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  language: Language;
}

export const CommunityView: React.FC<CommunityViewProps> = ({ members, attendanceRecords, language }) => {
  const t = translations[language];
  const locale = language === 'es' ? es : enUS;
  const [expandedStat, setExpandedStat] = useState<'evangelism' | 'gps' | null>(null);

  // Sort records by date descending
  const sortedRecords = [...attendanceRecords].sort((a, b) => b.date.localeCompare(a.date));
  
  // Last 3 services (dates where attendance was taken)
  const lastThreeServices = sortedRecords.slice(0, 3);
  
  // Find members who haven't attended in the last 3 services
  const missingMembers = members.filter(member => {
    // Exclude archived members
    if (member.isArchived) return false;
    
    // Check if member has ANY attendance recorded ever
    const hasAttendedEver = attendanceRecords.some(r => r.presentMemberIds.includes(member.id));
    if (!hasAttendedEver) return false; // New members with 0 attendance aren't "missing"

    // If there are no services yet, they aren't "missing"
    if (lastThreeServices.length === 0) return false;
    
    // Check if member is present in ANY of the last 3 services
    const attendedAny = lastThreeServices.some(record => 
      record.presentMemberIds.includes(member.id)
    );
    
    return !attendedAny;
  });

  // Growth Logic: Attendance this month vs last month
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));

  const thisMonthAttendance = attendanceRecords.filter(r => isAfter(parseISO(r.date), thisMonthStart));
  const lastMonthAttendance = attendanceRecords.filter(r => {
    const date = parseISO(r.date);
    return isAfter(date, lastMonthStart) && !isAfter(date, thisMonthStart);
  });

  const getUniqueAttendees = (records: AttendanceRecord[]) => {
    const ids = new Set<string>();
    records.forEach(r => r.presentMemberIds.forEach(id => ids.add(id)));
    return ids.size;
  };

  const activeThisMonth = getUniqueAttendees(thisMonthAttendance);
  const activeLastMonth = getUniqueAttendees(lastMonthAttendance);
  const growth = activeThisMonth - activeLastMonth;

  const gpsMembersCount = members.filter(m => m.isGpsMember && !m.isArchived).length;
  const evangelizedMembersCount = members.filter(m => m.isEvangelized && !m.isArchived).length;
  const activeMembers = members.filter(m => !m.isArchived);
  const totalActiveReach = activeMembers.length;

  const renderStatModal = () => {
    if (!expandedStat) return null;

    const title = expandedStat === 'gps' ? t.gpsStats : t.evangelizedStats;
    const completedMembers = activeMembers.filter(m => expandedStat === 'gps' ? m.isGpsMember : m.isEvangelized);
    const missingMembersList = activeMembers.filter(m => expandedStat === 'gps' ? !m.isGpsMember : !m.isEvangelized);

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-[2rem] max-w-md w-full shadow-2xl border border-slate-100 flex flex-col max-h-[80vh] overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", expandedStat === 'gps' ? "bg-indigo-100 text-indigo-600" : "bg-emerald-100 text-emerald-600")}>
                {expandedStat === 'gps' ? <Compass className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
              </div>
              <h3 className="text-xl font-black text-slate-800">{title}</h3>
            </div>
            <button
              onClick={() => setExpandedStat(null)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto space-y-8 flex-1">
            {/* Completed Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">{t.completed} ({completedMembers.length})</h4>
              </div>
              <div className="space-y-2">
                {completedMembers.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No members found.</p>
                ) : (
                  completedMembers.map(m => (
                    <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50 gap-1">
                      <span className="font-bold text-slate-700">{m.name}</span>
                      {expandedStat === 'gps' && m.gpsName && (
                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md max-w-full truncate">{m.gpsName}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Missing Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <XCircle className="w-5 h-5 text-rose-500" />
                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest">{t.missing} ({missingMembersList.length})</h4>
              </div>
              <div className="space-y-2">
                {missingMembersList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No members found.</p>
                ) : (
                  missingMembersList.map(m => (
                    <div key={m.id} className="font-medium text-slate-600 p-3 bg-rose-50/50 rounded-xl border border-rose-100/50 flex items-center justify-between">
                      {m.name}
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-widest px-2">{t.atRisk}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-8 relative">
      <AnimatePresence>
        {renderStatModal()}
      </AnimatePresence>

      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-2">{t.communityInsights}</h2>
        <p className="text-slate-500">{t.communityDesc}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-white/10 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest opacity-80">{t.activeGrowth}</span>
            </div>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-5xl font-black mb-1">{activeThisMonth}</p>
                <p className="text-indigo-100 text-sm font-medium">{t.activeThisMonth}</p>
              </div>
              <div className="text-right">
                <div className={cn(
                  "inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold mb-2",
                  growth >= 0 ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-400/20 text-rose-300"
                )}>
                  {growth >= 0 ? '+' : ''}{growth}
                </div>
                <p className="text-indigo-100 text-xs font-medium">{t.vsLastMonth}</p>
              </div>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-slate-50 rounded-lg">
              <Users className="w-5 h-5 text-slate-400" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.totalReach}</span>
          </div>
          <div>
            <p className="text-5xl font-black text-slate-900 mb-1">{totalActiveReach}</p>
            <p className="text-slate-400 text-sm font-medium">{t.registeredMembers}</p>
          </div>
        </div>
      </div>

      {/* GPS and Evangelization Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <button 
          onClick={() => setExpandedStat('gps')}
          className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4 hover:border-indigo-300 hover:shadow-md transition-all text-left outline-none group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
            <Compass className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">{t.gpsStats}</p>
            <p className="text-xl font-black text-slate-800">
              {gpsMembersCount}/{totalActiveReach} <span className="text-xs font-medium text-slate-400 lowercase">{t.attendGps}</span>
            </p>
          </div>
        </button>

        <button 
          onClick={() => setExpandedStat('evangelism')}
          className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4 hover:border-emerald-300 hover:shadow-md transition-all text-left outline-none group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 transition-colors">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">{t.evangelizedStats}</p>
            <p className="text-xl font-black text-slate-800">
              {evangelizedMembersCount}/{totalActiveReach} <span className="text-xs font-medium text-slate-400 lowercase">{t.areEvangelized}</span>
            </p>
          </div>
        </button>
      </div>

      {/* Missing Members Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-800">{t.needsConnection}</h3>
          </div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {t.missedLast3}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {missingMembers.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-3xl p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <p className="text-emerald-900 font-bold">{t.everyoneConnected}</p>
              <p className="text-emerald-600 text-sm">{t.allAttended}</p>
            </div>
          ) : (
            missingMembers.map(member => (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:border-amber-100 transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 font-bold">
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">{member.name}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {t.joined} {format(parseISO(member.joinDate), 'MMM yyyy', { locale })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="px-4 py-2 bg-amber-50 rounded-2xl">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{t.atRisk}</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
