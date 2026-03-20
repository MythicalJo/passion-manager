import React, { useRef } from 'react';
import { Download, Upload, Trash2, Globe, ShieldAlert, Cloud } from 'lucide-react';
import { saveFirebaseConfig, clearFirebaseConfig, getFirebaseConfig, initFirebase } from '../lib/firebase';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmClear, setShowConfirmClear] = React.useState(false);
  const [importStatus, setImportStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [firebaseConfig, setFirebaseConfig] = React.useState('');
  const [isConnected, setIsConnected] = React.useState(!!getFirebaseConfig());
  const [configError, setConfigError] = React.useState(false);

  const handleConnectCloud = () => {
    if (saveFirebaseConfig(firebaseConfig)) {
      if (initFirebase()) {
        setIsConnected(true);
        setConfigError(false);
        window.location.reload();
      } else {
        setConfigError(true);
        clearFirebaseConfig();
      }
    } else {
      setConfigError(true);
    }
  };

  const handleDisconnectCloud = () => {
    clearFirebaseConfig();
    setIsConnected(false);
    setFirebaseConfig('');
    window.location.reload();
  };

  const handleExport = () => {
    const data = {
      members,
      attendanceRecords,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `youth-group-data-${new Date().toISOString().split('T')[0]}.json`;
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

        {/* Cloud Sync Section */}
        <div className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] p-5 md:p-8 border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 md:p-8">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${isConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`}></div>
              {isConnected ? t.cloudConnected : t.cloudDisconnected}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-50 rounded-xl">
              <Cloud className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
            </div>
            <h3 className="text-base md:text-lg font-bold text-slate-800">{t.cloudSync}</h3>
          </div>
          <p className="text-slate-500 text-sm mb-6 max-w-md">{t.cloudSyncDesc}</p>
          
          {isConnected ? (
            <button
              onClick={handleDisconnectCloud}
              className="py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl bg-rose-50 text-rose-600 font-bold hover:bg-rose-100 transition-all text-sm md:text-base border border-rose-200"
            >
              {t.disconnect}
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <textarea
                value={firebaseConfig}
                onChange={(e) => {
                  setFirebaseConfig(e.target.value);
                  setConfigError(false);
                }}
                placeholder={`{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "...",\n  ...\n}`}
                className={`w-full h-32 p-4 text-sm font-mono bg-slate-50 rounded-xl border-2 transition-colors resize-none placeholder-slate-300 focus:outline-none focus:bg-white ${
                  configError ? 'border-rose-300 text-rose-900 focus:border-rose-500' : 'border-slate-100 text-slate-700 focus:border-blue-500'
                }`}
              />
              {configError && <p className="text-rose-500 text-xs font-bold px-1">{t.invalidConfig}</p>}
              <button
                onClick={handleConnectCloud}
                className="py-3 md:py-4 px-4 md:px-6 rounded-xl md:rounded-2xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 text-sm md:text-base self-start"
              >
                {t.connect}
              </button>
            </div>
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
    </div>
  );
};
