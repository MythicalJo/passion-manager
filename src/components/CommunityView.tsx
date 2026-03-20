import React from 'react';
import { Users, TrendingUp, AlertCircle, Calendar, CheckCircle2, Compass } from 'lucide-react';
import { Member, AttendanceRecord } from '../types';
import { Language, translations } from '../translations';
import { motion } from 'motion/react';
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

  // Sort records by date descending
  const sortedRecords = [...attendanceRecords].sort((a, b) => b.date.localeCompare(a.date));
  
  // Last 3 services (dates where attendance was taken)
  const lastThreeServices = sortedRecords.slice(0, 3);
  
  // Find members who haven't attended in the last 3 services
  const missingMembers = members.filter(member => {
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

  const gpsMembersCount = members.filter(m => m.isGpsMember).length;
  const evangelizedMembersCount = members.filter(m => m.isEvangelized).length;

  return (
    <div className="flex flex-col h-full space-y-8">
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
            <p className="text-5xl font-black text-slate-900 mb-1">{members.length}</p>
            <p className="text-slate-400 text-sm font-medium">{t.registeredMembers}</p>
          </div>
        </div>
      </div>

      {/* GPS and Evangelization Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Compass className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">{t.gpsStats}</p>
            <p className="text-xl font-black text-slate-800">
              {gpsMembersCount}/{members.length} <span className="text-xs font-medium text-slate-400 lowercase">{t.attendGps}</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">{t.evangelizedStats}</p>
            <p className="text-xl font-black text-slate-800">
              {evangelizedMembersCount}/{members.length} <span className="text-xs font-medium text-slate-400 lowercase">{t.areEvangelized}</span>
            </p>
          </div>
        </div>
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
