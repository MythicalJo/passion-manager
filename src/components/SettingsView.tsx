import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Trash2, Globe, ShieldAlert, Cloud, Bug, LogIn, LogOut, UserCheck, Moon, Sun, FileText } from 'lucide-react';
import { signInLeader, signOutLeader, subscribeToAuth, getLastSyncDate, getLastError } from '../lib/gists';
import { User } from 'firebase/auth';
import { Member, AttendanceRecord } from '../types';
import { Language, translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsViewProps {
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  onImport: (data: { members: Member[]; attendanceRecords: AttendanceRecord[]; gpsGroups?: string[] }) => void;
  onClearAll: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
  isDark: boolean;
  onToggleDark: () => void;
}

const CLEAR_PHRASE = 'change da world';

export const SettingsView: React.FC<SettingsViewProps> = ({
  members,
  attendanceRecords,
  onImport,
  onClearAll,
  language,
  onLanguageChange,
  isDark,
  onToggleDark,
}) => {
  const t = translations[language];
  const isEs = language === 'es';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clearStep, setClearStep] = useState<0 | 1 | 2 | 3 | 4 | 5>(0); // 0 = closed, 1-5 = steps
  const [clearPhrase, setClearPhrase] = useState('');
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Firebase Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [debugDate, setDebugDate] = useState(getLastSyncDate());
  const [debugError, setDebugError] = useState(getLastError());

  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      const interval = setInterval(() => {
        setDebugDate(getLastSyncDate());
        setDebugError(getLastError());
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInLeader(email, password);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setAuthError(err?.message || (isEs ? 'Error al iniciar sesión' : 'Failed to sign in. Please check credentials.'));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutLeader();
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const handleExport = () => {
    const localGpsGroupsStr = localStorage.getItem('yg_gps_groups');
    const gpsGroups = localGpsGroupsStr ? JSON.parse(localGpsGroupsStr) : [];
    const data = {
      members,
      attendanceRecords,
      gpsGroups,
      exportedAt: new Date().toISOString(),
      version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.38.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passion-manager-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    // Build attendance count map
    const attendanceCount: Record<string, number> = {};
    attendanceRecords.forEach(record => {
      record.presentMemberIds.forEach(id => {
        attendanceCount[id] = (attendanceCount[id] || 0) + 1;
      });
    });

    const header = ['Name', 'Phone', 'Instagram', 'Birthday', 'GPS Group', 'Evangelizado', 'Total Attendance'];
    const rows = members.map(m => {
      const cleanHandle = (() => {
        if (!m.instagram) return '';
        let h = m.instagram.trim();
        h = h.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/?/i, '');
        h = h.split('?')[0].split('#')[0];
        h = h.replace(/^@+/, '').replace(/\/+$/, '').trim();
        return h;
      })();

      const escCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
      return [
        escCsv(m.name),
        escCsv(m.phone || ''),
        escCsv(cleanHandle ? `@${cleanHandle}` : ''),
        escCsv(m.birthday || ''),
        escCsv(m.isGpsMember && m.gpsName ? m.gpsName : ''),
        escCsv((m.isEvangelized || m.evangelizado) ? (isEs ? 'Sí' : 'Yes') : (isEs ? 'No' : 'No')),
        String(attendanceCount[m.id] || 0),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\n'); // BOM for Excel UTF-8
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `passion-manager-members-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.members && Array.isArray(data.members) && data.attendanceRecords && Array.isArray(data.attendanceRecords)) {
          onImport({
            members: data.members,
            attendanceRecords: data.attendanceRecords,
            gpsGroups: Array.isArray(data.gpsGroups) ? data.gpsGroups : undefined
          });
          setImportStatus('success');
          setTimeout(() => setImportStatus('idle'), 3000);
        } else {
          throw new Error('Invalid format');
        }
      } catch (error) {
        setImportStatus('error');
        setTimeout(() => setImportStatus('idle'), 3000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const closeClearModal = () => {
    setClearStep(0);
    setClearPhrase('');
  };

  const stepTitles = [
    '', // unused (index 0)
    t.clearStep1Title,
    t.clearStep2Title,
    t.clearStep3Title,
    t.clearStep4Title,
    t.clearStep5Title,
  ];

  const stepDescs = [
    '',
    t.clearStep1Desc,
    t.clearStep2Desc,
    t.clearStep3Desc,
    t.clearStep4Desc,
    t.clearStep5Desc,
  ];

  const stepIcons = ['', '🤔', '😬', '😨', '🚨', '💀'];

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden pr-1 md:pr-2 space-y-6 md:space-y-8 relative">

      {/* 5-Step Clear All Modal */}
      <AnimatePresence>
        {clearStep > 0 && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              key={clearStep}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              {/* Step indicator */}
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {t.stepOf.replace('{step}', String(clearStep))}
                </span>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map(s => (
                    <div
                      key={s}
                      className={`h-1.5 rounded-full transition-all ${
                        s < clearStep ? 'w-4 bg-rose-400' :
                        s === clearStep ? 'w-6 bg-rose-600' :
                        'w-4 bg-slate-200 dark:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="text-4xl mb-4 text-center">{stepIcons[clearStep]}</div>

              <h3 className={`text-xl font-black text-center mb-3 ${clearStep >= 4 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>
                {stepTitles[clearStep]}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm text-center mb-6 leading-relaxed">
                {stepDescs[clearStep]}
              </p>

              {clearStep === 5 && (
                <div className="mb-6">
                  <code className="block text-center text-sm font-black text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 py-2 px-4 rounded-xl mb-3 border border-rose-200 dark:border-rose-900 tracking-wider">
                    {CLEAR_PHRASE}
                  </code>
                  <input
                    type="text"
                    value={clearPhrase}
                    onChange={e => setClearPhrase(e.target.value)}
                    placeholder={t.clearStep5Placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium text-sm focus:ring-2 focus:ring-rose-400/30 focus:border-rose-500 outline-none transition-all"
                    autoFocus
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={closeClearModal}
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-sm"
                >
                  {t.cancel}
                </button>

                {clearStep < 5 ? (
                  <button
                    onClick={() => setClearStep((clearStep + 1) as 1|2|3|4|5)}
                    className="flex-1 px-4 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-200 dark:shadow-rose-900 text-sm"
                  >
                    {t.continueBtn} →
                  </button>
                ) : (
                  <button
                    disabled={clearPhrase !== CLEAR_PHRASE}
                    onClick={() => {
                      onClearAll();
                      closeClearModal();
                    }}
                    className="flex-1 px-4 py-3 rounded-xl bg-rose-700 text-white font-black hover:bg-rose-800 transition-colors shadow-lg shadow-rose-300 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    {t.clearStep5Button}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="shrink-0 px-1">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mb-1 md:mb-2">{t.settings}</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm">{t.communityDesc}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 pb-8">

        {/* Appearance (Dark Mode) Section */}
        <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4 md:mb-5">
            <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-xl">
              {isDark ? <Moon className="w-4 h-4 md:w-5 md:h-5 text-indigo-400" /> : <Sun className="w-4 h-4 md:w-5 md:h-5 text-amber-500" />}
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">{t.appearance}</h3>
          </div>

          <button
            onClick={onToggleDark}
            className="flex items-center justify-between w-full sm:w-auto sm:min-w-[220px] gap-4 px-5 py-3.5 rounded-2xl border-2 transition-all font-bold text-sm border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 group"
          >
            <span className="text-slate-700 dark:text-slate-200">
              {isDark ? t.darkMode : t.lightMode}
            </span>
            {/* Toggle pill */}
            <div className={`relative w-12 h-6 rounded-full transition-colors ${isDark ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${isDark ? 'left-7' : 'left-1'}`} />
            </div>
          </button>
        </div>

        {/* Language Section */}
        <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950 rounded-xl">
              <Globe className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">{t.language}</h3>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <button
              onClick={() => onLanguageChange('en')}
              className={`flex-1 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl border-2 transition-all font-bold text-sm md:text-base ${
                language === 'en' 
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-600' 
                  : 'border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
              }`}
            >
              {t.english}
            </button>
            <button
              onClick={() => onLanguageChange('es')}
              className={`flex-1 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl border-2 transition-all font-bold text-sm md:text-base ${
                language === 'es' 
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-600' 
                  : 'border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
              }`}
            >
              {t.spanish}
            </button>
          </div>
        </div>

        {/* Cloud Sync Section */}
        <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 md:p-8">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${currentUser ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${currentUser ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
              {currentUser ? t.cloudConnected : t.cloudDisconnected}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-xl">
              <Cloud className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">{t.cloudSync}</h3>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-md">
            {isEs 
              ? 'Sincronización en tiempo real con Firebase Firestore. Inicia sesión como líder para mantener múltiples dispositivos actualizados instantáneamente.'
              : 'Real-time synchronization with Firebase Firestore. Sign in as a leader to keep all devices updated instantaneously.'
            }
          </p>
          
          {currentUser ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-400 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 uppercase tracking-wider font-bold">
                    {isEs ? 'Líder Conectado' : 'Leader Signed In'}
                  </p>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{currentUser.email}</p>
                </div>
              </div>
              
              <div className="p-4 bg-slate-800 dark:bg-slate-950 rounded-xl flex flex-col gap-2 shadow-inner">
                <div className="flex items-center gap-2 mb-1">
                  <Bug className="w-4 h-4 text-emerald-400" />
                  <p className="text-xs text-emerald-400 uppercase tracking-wider font-bold">Sync Status</p>
                </div>
                <p className="text-xs text-slate-300 font-mono">
                  Document: <span className="text-emerald-300">groups/main/data/state</span>
                </p>
                <p className="text-xs text-slate-300 font-mono">
                  Last Sync: <span className="text-white">{debugDate}</span>
                </p>
                <p className="text-xs text-slate-300 font-mono flex flex-col gap-1">
                  Status: <span className={debugError === 'None' ? 'text-emerald-400' : 'text-rose-400'}>{debugError === 'None' ? 'Active Real-Time Sync' : debugError}</span>
                </p>
              </div>

              <button
                onClick={handleSignOut}
                className="flex items-center justify-center gap-2 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 font-bold hover:bg-rose-100 dark:hover:bg-rose-900 transition-all text-sm md:text-base border border-rose-200 dark:border-rose-900"
              >
                <LogOut className="w-4 h-4" />
                <span>{isEs ? 'Cerrar Sesión' : 'Sign Out'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="flex flex-col gap-3 max-w-md">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {isEs ? 'Correo Electrónico del Líder' : 'Leader Email'}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setAuthError(null);
                  }}
                  placeholder="leader@passion.org"
                  className="w-full p-3.5 text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 placeholder-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {isEs ? 'Contraseña' : 'Password'}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setAuthError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full p-3.5 text-sm bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 placeholder-slate-400 text-slate-800 dark:text-slate-100 focus:outline-none focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {authError && (
                <p className="text-rose-500 text-xs font-bold px-1 bg-rose-50 dark:bg-rose-950 py-2 rounded-lg border border-rose-100 dark:border-rose-900">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSigningIn}
                className="mt-2 flex items-center justify-center gap-2 py-3 md:py-3.5 px-6 rounded-xl md:rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-200 dark:shadow-blue-900 text-sm md:text-base self-start"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSigningIn ? '...' : (isEs ? 'Iniciar Sesión' : 'Sign In')}</span>
              </button>
            </form>
          )}
        </div>

        {/* Data Management Section */}
        <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950 rounded-xl">
              <Download className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">{t.importExport}</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            {/* JSON Export */}
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl bg-slate-900 dark:bg-slate-700 text-white font-bold hover:bg-slate-800 dark:hover:bg-slate-600 transition-all shadow-lg shadow-slate-200 dark:shadow-slate-900 text-sm md:text-base"
            >
              <Download className="w-4 h-4 md:w-5 md:h-5" />
              {t.exportData}
            </button>

            {/* CSV Export */}
            <button
              onClick={handleExportCsv}
              className="flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition-all shadow-lg shadow-emerald-200 dark:shadow-emerald-900 text-sm md:text-base"
            >
              <FileText className="w-4 h-4 md:w-5 md:h-5" />
              {t.exportCsv}
            </button>
            
            {/* JSON Import */}
            <div className="relative">
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl border-2 font-bold transition-all text-sm md:text-base ${
                  importStatus === 'success' ? 'border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950' :
                  importStatus === 'error' ? 'border-rose-500 text-rose-600 bg-rose-50 dark:bg-rose-950' :
                  'border-slate-900 dark:border-slate-600 text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Upload className="w-4 h-4 md:w-5 md:h-5" />
                {importStatus === 'success' ? t.importSuccess : importStatus === 'error' ? t.importError : t.importData}
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImport}
              accept=".json"
              className="hidden"
            />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-rose-50 dark:bg-rose-950/40 rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-rose-100 dark:border-rose-900">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="p-2 bg-rose-100 dark:bg-rose-900 rounded-xl">
              <ShieldAlert className="w-4 h-4 md:w-5 md:h-5 text-rose-600 dark:text-rose-400" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-rose-800 dark:text-rose-300">{t.dangerZone}</h3>
          </div>
          
          <button
            onClick={() => setClearStep(1)}
            className="flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 dark:shadow-rose-900 w-full sm:w-auto text-sm md:text-base"
          >
            <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
            {t.clearAllData}
          </button>
        </div>
      </div>
      
      <div className="text-center mt-8 pb-4">
        <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Passion Manager v{__APP_VERSION__}</p>
      </div>
    </div>
  );
};
