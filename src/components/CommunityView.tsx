import React, { useState, useMemo } from 'react';
import { 
  Users, TrendingUp, AlertCircle, Calendar, CheckCircle2, Compass, X, XCircle, 
  Shield, Baby, GraduationCap, Instagram, Gift, Plus, Trash2, BarChart2, Sparkles, UserPlus 
} from 'lucide-react';
import { Member, AttendanceRecord } from '../types';
import { Language, translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { format, subMonths, startOfMonth, isAfter, parseISO, differenceInYears, differenceInDays } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { cn } from '../lib/utils';

const cleanInstagramHandle = (input?: string): string | undefined => {
  if (!input) return undefined;
  let handle = input.trim();
  if (!handle) return undefined;
  handle = handle.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/?/i, '');
  handle = handle.split('?')[0].split('#')[0];
  handle = handle.replace(/^@+/, '').replace(/\/+$/, '').trim();
  return handle || undefined;
};

type Timeframe = '2W' | '1M' | '3M' | '6M' | '1Y';

interface CommunityViewProps {
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  gpsGroups?: string[];
  onAddGpsGroup?: (name: string) => void;
  onDeleteGpsGroup?: (name: string) => void;
  onUpdateMember?: (member: Member) => void;
  language: Language;
}

export const CommunityView: React.FC<CommunityViewProps> = ({ 
  members, 
  attendanceRecords, 
  gpsGroups = [], 
  onAddGpsGroup, 
  onDeleteGpsGroup, 
  onUpdateMember, 
  language 
}) => {
  const t = translations[language];
  const locale = language === 'es' ? es : enUS;

  const [subTab, setSubTab] = useState<'insights' | 'gps'>('insights');
  const [expandedStat, setExpandedStat] = useState<'evangelism' | 'gps' | 'staff' | 'adults' | 'teens' | null>(null);

  // Growth chart states
  const [showChart, setShowChart] = useState(false);
  const [chartTimeframe, setChartTimeframe] = useState<Timeframe>('1M');

  // Interactive Evangelizado & GPS states
  const [memberToEvangelize, setMemberToEvangelize] = useState<Member | null>(null);
  const [memberToAssignGps, setMemberToAssignGps] = useState<Member | null>(null);
  const [selectedGpsToAssign, setSelectedGpsToAssign] = useState<string>('');

  // GPS group management in subtab
  const [newGroupName, setNewGroupName] = useState('');
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  const calculateAge = (birthday?: string) => {
    if (!birthday) return null;
    try {
      return differenceInYears(new Date(), parseISO(birthday));
    } catch { return null; }
  };

  const now = new Date();

  // Upcoming Birthdays Calculation: Current month or next 14 days
  const upcomingBirthdays = useMemo(() => {
    const today = new Date();
    return members
      .filter(m => !m.isArchived && m.birthday)
      .map(m => {
        try {
          const bday = parseISO(m.birthday!);
          let nextBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
          if (differenceInDays(nextBday, today) < 0 && bday.getMonth() !== today.getMonth()) {
            nextBday = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
          }
          const daysUntil = differenceInDays(nextBday, today);
          const isThisMonth = bday.getMonth() === today.getMonth();
          const isNext14Days = daysUntil >= 0 && daysUntil <= 14;
          return {
            member: m,
            bday,
            nextBday,
            daysUntil,
            isThisMonth,
            isNext14Days,
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null && (item.isThisMonth || item.isNext14Days))
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [members]);

  // Sort records by date descending
  const sortedRecords = useMemo(() => {
    return [...attendanceRecords].sort((a, b) => b.date.localeCompare(a.date));
  }, [attendanceRecords]);
  
  // Find members who haven't attended in the last 2 weeks (14 days)
  // Never-Attended Rule: Members with 0 total attendance records are NEVER flagged as at-risk
  // (only flag members who have attended at least 1 meeting previously AND whose last attended date was 14+ days ago)
  const missingMembers = members.filter(member => {
    if (member.isArchived) return false;
    const attendedRecords = attendanceRecords.filter(r => r.presentMemberIds.includes(member.id));
    if (attendedRecords.length === 0) return false;

    const sortedAttended = [...attendedRecords].sort((a, b) => b.date.localeCompare(a.date));
    const lastAttendedDate = sortedAttended[0].date;

    try {
      const daysSinceLastAttended = differenceInDays(now, parseISO(lastAttendedDate));
      return daysSinceLastAttended >= 14;
    } catch {
      return false;
    }
  });

  // Growth Logic: Attendance this month vs last month
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

  const activeMembers = members.filter(m => !m.isArchived);
  const totalActiveReach = activeMembers.length;

  const gpsMembersCount = activeMembers.filter(m => m.isGpsMember).length;
  const evangelizedMembersCount = activeMembers.filter(m => m.isEvangelized || m.evangelizado).length;
  const staffCount = activeMembers.filter(m => m.isStaff).length;
  
  const adultMembers = activeMembers.filter(m => {
    const age = calculateAge(m.birthday);
    return age !== null && age >= 18;
  });
  
  const teenMembers = activeMembers.filter(m => {
    const age = calculateAge(m.birthday);
    return age !== null && age <= 17;
  });

  // Growth chart calculations
  const chartData = useMemo(() => {
    const daysMap: Record<Timeframe, number> = {
      '2W': 14,
      '1M': 30,
      '3M': 90,
      '6M': 180,
      '1Y': 365,
    };
    const daysLimit = daysMap[chartTimeframe];
    const filtered = sortedRecords
      .filter(r => {
        try {
          const days = differenceInDays(now, parseISO(r.date));
          return days >= 0 && days <= daysLimit;
        } catch { return false; }
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return filtered.map(r => ({
      date: r.date,
      count: r.presentMemberIds.length,
    }));
  }, [sortedRecords, chartTimeframe]);

  const handleAddGroupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGroupName.trim();
    if (!trimmed) return;
    onAddGpsGroup?.(trimmed);
    setNewGroupName('');
  };

  const renderStatModal = () => {
    if (!expandedStat) return null;

    let title = '';
    let completedMembers: Member[] = [];
    let missingMembersList: Member[] = [];
    let Icon = CheckCircle2;
    let iconTheme = '';
    let isDemographicModal = false;

    if (expandedStat === 'gps') {
      title = t.gpsStats;
      completedMembers = activeMembers.filter(m => m.isGpsMember);
      missingMembersList = activeMembers.filter(m => !m.isGpsMember);
      Icon = Compass;
      iconTheme = 'bg-indigo-100 text-indigo-600';
    } else if (expandedStat === 'evangelism') {
      title = t.evangelizedStats;
      completedMembers = activeMembers.filter(m => m.isEvangelized || m.evangelizado);
      missingMembersList = activeMembers.filter(m => !m.isEvangelized && !m.evangelizado);
      Icon = CheckCircle2;
      iconTheme = 'bg-emerald-100 text-emerald-600';
    } else if (expandedStat === 'staff') {
      title = t.staffStats;
      completedMembers = activeMembers.filter(m => m.isStaff);
      Icon = Shield;
      iconTheme = 'bg-purple-100 text-purple-600';
      isDemographicModal = true;
    } else if (expandedStat === 'adults') {
      title = t.adultStats;
      completedMembers = adultMembers;
      Icon = GraduationCap;
      iconTheme = 'bg-blue-100 text-blue-600';
      isDemographicModal = true;
    } else if (expandedStat === 'teens') {
      title = t.teenStats;
      completedMembers = teenMembers;
      Icon = Baby;
      iconTheme = 'bg-pink-100 text-pink-600';
      isDemographicModal = true;
    }

    if (!isDemographicModal || expandedStat === 'staff') {
      completedMembers = [...completedMembers].sort((a, b) => {
        if (expandedStat === 'gps') {
          const mainCompare = (a.gpsName || '').localeCompare(b.gpsName || '');
          if (mainCompare !== 0) return mainCompare;
        } else if (expandedStat === 'staff') {
          const ministryA = (a.ministry || 'Unknown').toLowerCase();
          const ministryB = (b.ministry || 'Unknown').toLowerCase();
          const mainCompare = ministryA.localeCompare(ministryB);
          if (mainCompare !== 0) return mainCompare;
        }
        return a.name.localeCompare(b.name);
      });
    }

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-slate-900 rounded-[2rem] max-w-md w-full shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[80vh] overflow-hidden"
        >
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-800/80">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconTheme)}>
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">{title}</h3>
            </div>
            <button
              onClick={() => setExpandedStat(null)}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto space-y-8 flex-1">
            {/* Completed Section */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                {isDemographicModal ? <Users className="w-5 h-5 text-indigo-500" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                  {isDemographicModal ? `${completedMembers.length} ${t.members}` : `${t.completed} (${completedMembers.length})`}
                </h4>
              </div>
              <div className="space-y-2">
                {completedMembers.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No members found.</p>
                ) : (
                  completedMembers.map(m => (
                    <div 
                      key={m.id} 
                      onClick={() => {
                        if (expandedStat === 'gps') {
                          setSelectedGpsToAssign(m.gpsName || (gpsGroups[0] || ''));
                          setMemberToAssignGps(m);
                        }
                      }}
                      className={cn(
                        "flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border gap-1 transition-all",
                        expandedStat === 'gps' && "cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm",
                        isDemographicModal ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" : "bg-emerald-50/50 dark:bg-emerald-950/40 border-emerald-100/50 dark:border-emerald-900/40"
                      )}
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-200">{m.name}</span>
                      {expandedStat === 'gps' && m.gpsName && (
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-1 rounded-md max-w-full truncate">
                          {m.gpsName}
                        </span>
                      )}
                      {expandedStat === 'staff' && m.ministry && (
                        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-1 rounded-md max-w-full truncate">
                          {m.ministry}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Missing Section */}
            {!isDemographicModal && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <XCircle className="w-5 h-5 text-rose-500" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-widest">
                    {t.missing} ({missingMembersList.length})
                  </h4>
                </div>
                <div className="space-y-2">
                  {missingMembersList.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No members found.</p>
                  ) : (
                    missingMembersList.map(m => (
                      <div 
                        key={m.id} 
                        onClick={() => {
                          if (expandedStat === 'evangelism') {
                            setMemberToEvangelize(m);
                          } else if (expandedStat === 'gps') {
                            setSelectedGpsToAssign(gpsGroups[0] || '');
                            setMemberToAssignGps(m);
                          }
                        }}
                        className="font-medium text-slate-600 dark:text-slate-300 p-3 bg-rose-50/50 dark:bg-rose-950/30 hover:bg-rose-100/60 dark:hover:bg-rose-900/40 rounded-xl border border-rose-100/50 dark:border-rose-900/40 flex items-center justify-between cursor-pointer transition-colors"
                        title={expandedStat === 'evangelism' ? t.markEvangelizado : t.assignToGps}
                      >
                        <span className="font-bold text-slate-700 dark:text-slate-200">{m.name}</span>
                        {expandedStat === 'evangelism' && (
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-1 rounded-lg">
                            + {t.markEvangelizado}
                          </span>
                        )}
                        {expandedStat === 'gps' && (
                          <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-950 px-2.5 py-1 rounded-lg">
                            + {t.assignToGps}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-6 relative">
      <AnimatePresence>
        {renderStatModal()}
      </AnimatePresence>

      {/* Confirmation Modal: Mark as Evangelizado */}
      <AnimatePresence>
        {memberToEvangelize && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">{t.confirmEvangelizadoTitle}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t.confirmEvangelizadoDesc.replace('{name}', memberToEvangelize.name)}
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMemberToEvangelize(null)}
                  className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateMember?.({
                      ...memberToEvangelize,
                      isEvangelized: true,
                      evangelizado: true,
                    });
                    setMemberToEvangelize(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-md hover:bg-emerald-700 transition-colors"
                >
                  {t.markEvangelizado}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal: Assign GPS Group */}
      <AnimatePresence>
        {memberToAssignGps && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <Compass className="w-6 h-6" />
              </div>
              <div className="text-center">
                <h4 className="text-lg font-black text-slate-800 dark:text-slate-100">{t.assignGpsTitle}</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t.assignGpsDesc.replace('{name}', memberToAssignGps.name)}
                </p>
              </div>

              {gpsGroups.length === 0 ? (
                <div className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 p-3 rounded-2xl border border-amber-200 dark:border-amber-900">
                  {t.noGpsGroups}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.gpsName}</label>
                  <select
                    value={selectedGpsToAssign}
                    onChange={(e) => setSelectedGpsToAssign(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-indigo-500/20 outline-none"
                  >
                    <option value="">{t.selectGpsGroup}</option>
                    {gpsGroups.map(grp => (
                      <option key={grp} value={grp}>{grp}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2">
                {memberToAssignGps.isGpsMember ? (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateMember?.({
                        ...memberToAssignGps,
                        isGpsMember: false,
                        gpsName: undefined,
                      });
                      setMemberToAssignGps(null);
                    }}
                    className="px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 font-bold text-xs transition-colors"
                  >
                    {t.removeFromGps}
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMemberToAssignGps(null)}
                    className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    disabled={!selectedGpsToAssign}
                    onClick={() => {
                      if (selectedGpsToAssign) {
                        onUpdateMember?.({
                          ...memberToAssignGps,
                          isGpsMember: true,
                          gpsName: selectedGpsToAssign,
                        });
                        setMemberToAssignGps(null);
                      }
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                  >
                    {t.assign}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Header & Sub-Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-1">{t.communityInsights}</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t.communityDesc}</p>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-fit">
          <button
            type="button"
            onClick={() => setSubTab('insights')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all",
              subTab === 'insights' 
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            {t.gpsOverview}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('gps')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5",
              subTab === 'gps' 
                ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm" 
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            )}
          >
            <Compass className="w-3.5 h-3.5" />
            {t.gpsGroupsTitle}
            {gpsGroups.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-[10px] text-indigo-600 dark:text-indigo-400">
                {gpsGroups.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {subTab === 'gps' ? (
        /* GPS Management Sub-Tab */
        <div className="space-y-6">
          {/* Add GPS Group Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-500" />
              {t.manageGpsGroups}
            </h3>
            <form onSubmit={handleAddGroupSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={t.newGpsPlaceholder}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none text-sm font-medium"
              />
              <button
                type="submit"
                disabled={!newGroupName.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-indigo-100 dark:shadow-indigo-950 flex items-center justify-center gap-2 transition-colors shrink-0"
              >
                <Plus className="w-4 h-4" />
                {t.addGroup}
              </button>
            </form>
          </div>

          {/* Registered GPS Groups Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {gpsGroups.length === 0 ? (
              <div className="md:col-span-2 bg-slate-50 dark:bg-slate-900 rounded-3xl p-8 border border-slate-200/60 dark:border-slate-800 text-center text-slate-400">
                <Compass className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="font-bold text-slate-600 dark:text-slate-300">{t.noGpsGroups}</p>
              </div>
            ) : (
              gpsGroups.map(group => {
                const groupMembers = activeMembers.filter(m => m.isGpsMember && m.gpsName === group);
                return (
                  <div key={group} className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                            <Compass className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">{group}</h4>
                            <p className="text-xs text-slate-400">
                              {groupMembers.length} {t.membersCount}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t.deleteGroupConfirm.replace('{name}', group))) {
                              onDeleteGpsGroup?.(group);
                            }
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors"
                          title={t.delete}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {groupMembers.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-2">No members in this GPS group yet.</p>
                        ) : (
                          groupMembers.map(m => {
                            const cleanHandle = cleanInstagramHandle(m.instagram);
                            return (
                              <div key={m.id} className="flex items-center justify-between p-2.5 bg-slate-50/60 dark:bg-slate-800/60 rounded-xl text-xs">
                                <span className="font-bold text-slate-700 dark:text-slate-200">{m.name}</span>
                                <div className="flex items-center gap-2">
                                  {cleanHandle && (
                                    <a
                                      href={`https://instagram.com/${cleanHandle}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1 font-medium"
                                    >
                                      <Instagram className="w-3 h-3" />
                                      @{cleanHandle}
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedGpsToAssign(group);
                                      setMemberToAssignGps(m);
                                    }}
                                    className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline px-1"
                                  >
                                    {t.edit}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Unassigned Members Section */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                {t.unassignedGps}
              </span>
              <span className="text-xs font-bold text-slate-400">
                {activeMembers.filter(m => !m.isGpsMember || !m.gpsName).length} {t.membersCount}
              </span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeMembers.filter(m => !m.isGpsMember || !m.gpsName).length === 0 ? (
                <div className="col-span-full text-center py-4 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  ✓ {t.everyoneConnected}
                </div>
              ) : (
                activeMembers
                  .filter(m => !m.isGpsMember || !m.gpsName)
                  .map(m => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate mr-2">{m.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedGpsToAssign(gpsGroups[0] || '');
                          setMemberToAssignGps(m);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 font-bold text-[10px] shrink-0 transition-colors"
                      >
                        + {t.assign}
                      </button>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Regular Insights Overview */
        <>
          {/* Upcoming Birthdays Banner */}
          <div className="bg-gradient-to-r from-amber-50 via-rose-50 to-indigo-50 dark:from-amber-950/40 dark:via-rose-950/30 dark:to-indigo-950/40 border border-amber-200/60 dark:border-amber-900/60 rounded-3xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <Gift className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight">
                  {t.upcomingBirthdays}
                </h3>
              </div>
              <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                {t.birthdaysThisMonth}
              </span>
            </div>

            {upcomingBirthdays.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 italic py-1">{t.noUpcomingBirthdays}</p>
            ) : (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {upcomingBirthdays.map(({ member, nextBday, daysUntil }) => {
                  const isToday = daysUntil === 0;
                  return (
                    <div
                      key={member.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-2xl shrink-0 border transition-all text-xs",
                        isToday 
                          ? "bg-amber-400 text-amber-950 border-amber-500 shadow-md font-bold animate-pulse" 
                          : "bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 border-amber-100 dark:border-amber-900/50 shadow-sm"
                      )}
                    >
                      <span className="font-bold">{member.name}</span>
                      <span className="text-[10px] opacity-75 font-medium">
                        {format(nextBday, 'MMM d', { locale })}
                      </span>
                      {isToday ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-white text-amber-900 text-[9px] font-black uppercase">
                          🎉 {language === 'es' ? '¡Hoy!' : 'Today!'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded-md">
                          {daysUntil}d
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Growth Card with Toggleable Growth Chart */}
            <div className="bg-indigo-600 rounded-[2.5rem] p-7 text-white shadow-xl shadow-indigo-100 dark:shadow-indigo-950 relative overflow-hidden flex flex-col justify-between">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-white/10 rounded-lg">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest opacity-80">{t.activeGrowth}</span>
                  </div>

                  {/* Toggle Growth Chart Button */}
                  <button
                    type="button"
                    onClick={() => setShowChart(!showChart)}
                    className="text-xs bg-white/15 hover:bg-white/25 text-white font-bold px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 backdrop-blur-sm cursor-pointer"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    {showChart ? t.hideChart : t.showChart}
                  </button>
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

                {/* Inline Growth Chart */}
                <AnimatePresence>
                  {showChart && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mt-6 pt-5 border-t border-white/15"
                    >
                      {/* Timeframe Pills */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
                          {t.growthChart}
                        </span>
                        <div className="flex items-center gap-1 bg-white/10 p-1 rounded-xl">
                          {(['2W', '1M', '3M', '6M', '1Y'] as Timeframe[]).map(tf => (
                            <button
                              key={tf}
                              type="button"
                              onClick={() => setChartTimeframe(tf)}
                              className={cn(
                                "px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all",
                                chartTimeframe === tf 
                                  ? "bg-white text-indigo-700 shadow-sm" 
                                  : "text-indigo-100 hover:text-white"
                              )}
                            >
                              {tf === '2W' ? t.twoWeeks : tf === '1M' ? t.oneMonth : tf === '3M' ? t.threeMonths : tf === '6M' ? t.sixMonths : t.oneYear}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* SVG Chart Rendering */}
                      {chartData.length === 0 ? (
                        <p className="text-xs text-indigo-200 italic py-4 text-center">{t.noChartData}</p>
                      ) : (
                        <div className="w-full pt-1">
                          {(() => {
                            const width = 340;
                            const height = 90;
                            const padding = 14;
                            const counts = chartData.map(d => d.count);
                            const maxCount = Math.max(...counts, 1);
                            const minCount = 0;
                            const range = maxCount - minCount || 1;

                            const points = chartData.map((d, index) => {
                              const x = chartData.length === 1 
                                ? width / 2 
                                : padding + (index / (chartData.length - 1)) * (width - 2 * padding);
                              const y = height - padding - ((d.count - minCount) / range) * (height - 2 * padding);
                              return { x, y, ...d };
                            });

                            const linePath = points.length === 1
                              ? `M ${points[0].x - 20} ${points[0].y} L ${points[0].x + 20} ${points[0].y}`
                              : points.reduce((acc, p, i) => i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`, '');

                            const areaPath = points.length === 1
                              ? ''
                              : `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

                            return (
                              <div className="relative">
                                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-24 overflow-visible">
                                  <defs>
                                    <linearGradient id="growthAreaGradient" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0.0" />
                                    </linearGradient>
                                  </defs>
                                  {areaPath && (
                                    <path d={areaPath} fill="url(#growthAreaGradient)" />
                                  )}
                                  <path d={linePath} fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                  {points.map((p, idx) => (
                                    <g key={idx}>
                                      <circle cx={p.x} cy={p.y} r="3.5" fill="#ffffff" />
                                      <title>{`${p.date}: ${p.count} ${t.present}`}</title>
                                    </g>
                                  ))}
                                </svg>
                                <div className="flex justify-between items-center text-[9px] font-bold text-indigo-200 mt-1 px-1">
                                  <span>{chartData[0].date}</span>
                                  <span>{chartData[chartData.length - 1].date} ({chartData[chartData.length - 1].count} {t.present})</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl pointer-events-none" />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-6">
                <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Users className="w-5 h-5 text-slate-400" />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.totalReach}</span>
              </div>
              <div>
                <p className="text-5xl font-black text-slate-900 dark:text-slate-100 mb-1">{totalActiveReach}</p>
                <p className="text-slate-400 text-sm font-medium">{t.registeredMembers}</p>
              </div>
            </div>
          </div>

          {/* GPS and Evangelization Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <button 
              type="button"
              onClick={() => setExpandedStat('gps')}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all text-left outline-none group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60 transition-colors">
                <Compass className="w-6 h-6 text-indigo-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">{t.gpsStats}</p>
                <p className="text-xl font-black text-slate-800 dark:text-slate-100">
                  {gpsMembersCount}/{totalActiveReach} <span className="text-xs font-medium text-slate-400 lowercase">{t.attendGps}</span>
                </p>
              </div>
            </button>

            <button 
              type="button"
              onClick={() => setExpandedStat('evangelism')}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all text-left outline-none group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center shrink-0 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/60 transition-colors">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-xs font-black text-slate-300 dark:text-slate-500 uppercase tracking-widest mb-1">{t.evangelizedStats}</p>
                <p className="text-xl font-black text-slate-800 dark:text-slate-100">
                  {evangelizedMembersCount}/{totalActiveReach} <span className="text-xs font-medium text-slate-400 lowercase">{t.areEvangelized}</span>
                </p>
              </div>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <button 
              type="button"
              onClick={() => setExpandedStat('staff')}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center sm:flex-col gap-4 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all text-left sm:text-center outline-none group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center shrink-0 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/60 transition-colors">
                <Shield className="w-6 h-6 text-purple-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-1">{staffCount}</p>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.staffStats}</p>
              </div>
            </button>

            <button 
              type="button"
              onClick={() => setExpandedStat('adults')}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center sm:flex-col gap-4 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all text-left sm:text-center outline-none group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center shrink-0 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/60 transition-colors">
                <GraduationCap className="w-6 h-6 text-blue-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-1">{adultMembers.length}</p>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.adultStats}</p>
              </div>
            </button>

            <button 
              type="button"
              onClick={() => setExpandedStat('teens')}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center sm:flex-col gap-4 hover:border-pink-300 dark:hover:border-pink-700 hover:shadow-md transition-all text-left sm:text-center outline-none group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-2xl bg-pink-50 dark:bg-pink-950/60 flex items-center justify-center shrink-0 group-hover:bg-pink-100 dark:group-hover:bg-pink-900/60 transition-colors">
                <Baby className="w-6 h-6 text-pink-500 group-hover:scale-110 transition-transform" />
              </div>
              <div>
                <p className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-1">{teenMembers.length}</p>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t.teenStats}</p>
              </div>
            </button>
          </div>

          {/* Missing Members Section */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.needsConnection}</h3>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                {t.missedLast2Weeks || t.missedLast3}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
              {missingMembers.length === 0 ? (
                <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 rounded-3xl p-8 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="text-emerald-900 dark:text-emerald-200 font-bold">{t.everyoneConnected}</p>
                  <p className="text-emerald-600 dark:text-emerald-400 text-sm">{t.allAttended2Weeks || t.allAttended}</p>
                </div>
              ) : (
                missingMembers.map(member => {
                  const cleanHandle = cleanInstagramHandle(member.instagram);
                  return (
                    <motion.div
                      key={member.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center justify-between p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:border-amber-100 dark:hover:border-amber-900/50 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 font-bold">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-100">{member.name}</p>
                          <div className="flex flex-wrap items-center gap-3 mt-0.5">
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {t.joined} {format(parseISO(member.joinDate), 'MMM yyyy', { locale })}
                            </span>
                            {cleanHandle && (
                              <a
                                href={`https://instagram.com/${cleanHandle}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 hover:underline flex items-center gap-1 font-medium"
                              >
                                <Instagram className="w-3 h-3" />
                                @{cleanHandle}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/60 rounded-2xl">
                        <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest">{t.atRisk}</span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
