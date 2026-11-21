import React, { useRef, useState, useEffect } from 'react';
import { Download, Upload, Trash2, Globe, ShieldAlert, Cloud, Bug, LogIn, LogOut, UserCheck } from 'lucide-react';
import { signInLeader, signOutLeader, subscribeToAuth, getLastSyncDate, getLastError } from '../lib/gists';
import { User } from 'firebase/auth';
import { Member, AttendanceRecord } from '../types';
import { Language, translations } from '../translations';
import { motion } from 'motion/react';

interface SettingsViewProps {
  members: Member[];
  attendanceRecords: AttendanceRecord[];
  onImport: (data: { members: Member[]; attendanceRecords: AttendanceRecord[] }) => void;
  onClearAll: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  members,
  attendanceRecords,
  onImport,
  onClearAll,
  language,
  onLanguageChange,
}) => {
  const t = translations[language];
  const isEs = language === 'es';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
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
    const data = {
      members,
      attendanceRecords,
      exportedAt: new Date().toISOString(),
      version: '2.0'
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
            attendanceRecords: data.attendanceRecords
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

  return (
    <div className="flex flex-col h-full overflow-y-auto overflow-x-hidden pr-1 md:pr-2 space-y-6 md:space-y-8 relative">
      {/* Custom Confirmation Modal */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100"
          >
            <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
            </div>
            <h3 className="text-xl font-black text-slate-800 text-center mb-2">{t.dangerZone}</h3>
            <p className="text-slate-500 text-center mb-8 leading-relaxed">
              {t.confirmClear}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmClear(false)}
                className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
              >
                {t.cancel}
              </button>
              <button
                onClick={() => {
                  onClearAll();
                  setShowConfirmClear(false);
                }}
                className="flex-1 px-6 py-3 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-colors shadow-lg shadow-rose-100"
              >
                {t.delete}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="shrink-0 px-1">
        <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mb-1 md:mb-2">{t.settings}</h2>
        <p className="text-slate-500 text-sm">{t.communityDesc}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 pb-8">
        {/* Language Section */}
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Globe className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800">{t.language}</h3>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
            <button
              onClick={() => onLanguageChange('en')}
              className={`flex-1 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl border-2 transition-all font-bold text-sm md:text-base ${
                language === 'en' 
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                  : 'border-slate-100 text-slate-400 hover:border-slate-200'
              }`}
            >
              {t.english}
            </button>
            <button
              onClick={() => onLanguageChange('es')}
              className={`flex-1 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl border-2 transition-all font-bold text-sm md:text-base ${
                language === 'es' 
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600' 
                  : 'border-slate-100 text-slate-400 hover:border-slate-200'
              }`}
            >
              {t.spanish}
            </button>
          </div>
        </div>

        {/* Cloud Sync Section - Firebase Realtime Firestore & Auth */}
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 md:p-8">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${currentUser ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${currentUser ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
              {currentUser ? t.cloudConnected : t.cloudDisconnected}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Cloud className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800">{t.cloudSync}</h3>
          </div>
          <p className="text-slate-500 text-sm mb-6 max-w-md">
            {isEs 
              ? 'Sincronización en tiempo real con Firebase Firestore. Inicia sesión como líder para mantener múltiples dispositivos actualizados instantáneamente.'
              : 'Real-time synchronization with Firebase Firestore. Sign in as a leader to keep all devices updated instantaneously.'
            }
          </p>
          
          {currentUser ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-100 rounded-xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-emerald-700 uppercase tracking-wider font-bold">
                    {isEs ? 'Líder Conectado' : 'Leader Signed In'}
                  </p>
                  <p className="text-sm font-bold text-slate-800">{currentUser.email}</p>
                </div>
              </div>
              
              <div className="p-4 bg-slate-800 rounded-xl flex flex-col gap-2 shadow-inner">
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
                className="flex items-center justify-center gap-2 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 transition-all text-sm md:text-base border border-rose-200"
              >
                <LogOut className="w-4 h-4" />
                <span>{isEs ? 'Cerrar Sesión' : 'Sign Out'}</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSignIn} className="flex flex-col gap-3 max-w-md">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
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
                  className="w-full p-3.5 text-sm bg-slate-50 rounded-xl border border-slate-200 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
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
                  className="w-full p-3.5 text-sm bg-slate-50 rounded-xl border border-slate-200 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {authError && (
                <p className="text-rose-500 text-xs font-bold px-1 bg-rose-50 py-2 rounded-lg border border-rose-100">
                  {authError}
                </p>
              )}

              <button
                type="submit"
                disabled={isSigningIn}
                className="mt-2 flex items-center justify-center gap-2 py-3 md:py-3.5 px-6 rounded-xl md:rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-200 text-sm md:text-base self-start"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSigningIn ? '...' : (isEs ? 'Iniciar Sesión' : 'Sign In')}</span>
              </button>
            </form>
          )}
        </div>

        {/* Data Management Section */}
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Download className="w-4 h-4 md:w-5 md:h-5 text-emerald-600" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800">{t.importExport}</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 text-sm md:text-base"
            >
              <Download className="w-4 h-4 md:w-5 md:h-5" />
              {t.exportData}
            </button>
            
            <div className="relative">
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl border-2 font-bold transition-all text-sm md:text-base ${
                  importStatus === 'success' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' :
                  importStatus === 'error' ? 'border-rose-500 text-rose-600 bg-rose-50' :
                  'border-slate-900 text-slate-900 hover:bg-slate-50'
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
        <div className="bg-rose-50 rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-rose-100">
          <div className="flex items-center gap-3 mb-4 md:mb-6">
            <div className="p-2 bg-rose-100 rounded-xl">
              <ShieldAlert className="w-4 h-4 md:w-5 md:h-5 text-rose-600" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-rose-800">{t.dangerZone}</h3>
          </div>
          
          <button
            onClick={() => setShowConfirmClear(true)}
            className="flex items-center justify-center gap-2 md:gap-3 py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl bg-rose-600 text-white font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 w-full sm:w-auto text-sm md:text-base"
          >
            <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
            {t.clearAllData}
          </button>
        </div>
      </div>
      
      <div className="text-center mt-8 pb-4">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Passion Manager v2.0.0</p>
      </div>
    </div>
  );
};
