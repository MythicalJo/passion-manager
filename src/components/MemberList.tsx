import React, { useState, useMemo, useRef } from 'react';
import { UserPlus, Trash2, User, Edit2, X, Check, Calendar as CalendarIcon, Heart, MapPin, Utensils, Phone, Compass, ChevronDown, Search, CheckCircle2 } from 'lucide-react';
import { Member } from '../types';
import { Language, translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { differenceInYears, parseISO, format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { cn } from '../lib/utils';

interface MemberListProps {
  members: Member[];
  onAddMember: (data: { 
    name: string; 
    birthday?: string; 
    likes?: string; 
    likedFood?: string; 
    address?: string; 
    phone?: string;
    isGpsMember?: boolean;
    gpsName?: string;
    occupation?: 'none' | 'studying' | 'working' | 'both';
    occupationTime?: 'morning' | 'night' | 'both' | 'none';
    isEvangelized?: boolean;
  }) => void;
  onUpdateMember: (member: Member) => void;
  onDeleteMember: (id: string) => void;
  language: Language;
}

export const MemberList: React.FC<MemberListProps> = ({ members, onAddMember, onUpdateMember, onDeleteMember, language }) => {
  const t = translations[language];
  const locale = language === 'es' ? es : enUS;
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sectionRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Scroll to form when adding or editing
  React.useEffect(() => {
    if (isAdding || editingId) {
      // Small delay to ensure the form is rendered and animation started
      const timer = setTimeout(() => {
        if (formRef.current) {
          formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAdding, editingId]);

  const [formData, setFormData] = useState({
    name: '',
    birthday: '',
    likes: '',
    likedFood: '',
    address: '',
    phone: '',
    isGpsMember: false,
    gpsName: '',
    occupation: 'none' as 'none' | 'studying' | 'working' | 'both',
    occupationTime: 'none' as 'morning' | 'night' | 'both' | 'none',
    isEvangelized: false
  });

  const calculateAge = useMemo(() => (birthday?: string) => {
    if (!birthday) return null;
    try {
      return differenceInYears(new Date(), parseISO(birthday));
    } catch (e) {
      return null;
    }
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const filteredAndSortedMembers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = members.filter(m => 
      m.name.toLowerCase().includes(query) ||
      (m.phone && m.phone.includes(query)) ||
      (m.gpsName && m.gpsName.toLowerCase().includes(query))
    );

    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, searchQuery]);

  const groupedMembers = useMemo(() => {
    const groups: { [key: string]: Member[] } = {};
    filteredAndSortedMembers.forEach(member => {
      const firstLetter = member.name.charAt(0).toUpperCase();
      if (!groups[firstLetter]) groups[firstLetter] = [];
      groups[firstLetter].push(member);
    });
    return groups;
  }, [filteredAndSortedMembers]);

  const alphabet = useMemo(() => {
    return Object.keys(groupedMembers).sort();
  }, [groupedMembers]);

  const scrollToLetter = (letter: string) => {
    const element = sectionRefs.current[letter];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const isDuplicateName = useMemo(() => {
    const name = formData.name.trim().toLowerCase();
    if (!name) return false;
    return members.some(m => m.name.toLowerCase() === name && m.id !== editingId);
  }, [formData.name, members, editingId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim() && !isDuplicateName) {
      if (editingId) {
        const member = members.find(m => m.id === editingId);
        if (member) {
          onUpdateMember({
            ...member,
            name: formData.name,
            birthday: formData.birthday || undefined,
            likes: formData.likes || undefined,
            likedFood: formData.likedFood || undefined,
            address: formData.address || undefined,
            phone: formData.phone || undefined,
            isGpsMember: formData.isGpsMember,
            gpsName: formData.isGpsMember ? formData.gpsName : undefined,
            occupation: formData.occupation,
            occupationTime: formData.occupation !== 'none' ? formData.occupationTime : 'none',
            isEvangelized: formData.isEvangelized,
          });
        }
        setEditingId(null);
      } else {
        onAddMember({
          name: formData.name,
          birthday: formData.birthday || undefined,
          likes: formData.likes || undefined,
          likedFood: formData.likedFood || undefined,
          address: formData.address || undefined,
          phone: formData.phone || undefined,
          isGpsMember: formData.isGpsMember,
          gpsName: formData.isGpsMember ? formData.gpsName : undefined,
          occupation: formData.occupation,
          occupationTime: formData.occupation !== 'none' ? formData.occupationTime : 'none',
          isEvangelized: formData.isEvangelized,
        });
        setIsAdding(false);
      }
      setFormData({ 
        name: '', 
        birthday: '', 
        likes: '', 
        likedFood: '', 
        address: '', 
        phone: '', 
        isGpsMember: false, 
        gpsName: '',
        occupation: 'none',
        occupationTime: 'none',
        isEvangelized: false
      });
    }
  };

  const startEdit = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation();
    setEditingId(member.id);
    setFormData({
      name: member.name,
      birthday: member.birthday || '',
      likes: member.likes || '',
      likedFood: member.likedFood || '',
      address: member.address || '',
      phone: member.phone || '',
      isGpsMember: member.isGpsMember || false,
      gpsName: member.gpsName || '',
      occupation: member.occupation || 'none',
      occupationTime: member.occupationTime || 'none',
      isEvangelized: member.isEvangelized || false
    });
    setIsAdding(false);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMemberToDelete(id);
  };

  const confirmDelete = () => {
    if (memberToDelete) {
      onDeleteMember(memberToDelete);
      setMemberToDelete(null);
    }
  };

  const cancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ 
      name: '', 
      birthday: '', 
      likes: '', 
      likedFood: '', 
      address: '', 
      phone: '', 
      isGpsMember: false, 
      gpsName: '',
      occupation: 'none',
      occupationTime: 'none',
      isEvangelized: false
    });
  };

  return (
    <div className="flex flex-col h-full relative">
      <AnimatePresence>
        {memberToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800 text-center mb-2">{t.delete}</h3>
              <p className="text-slate-500 text-center mb-8 leading-relaxed">
                {t.confirmDelete}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setMemberToDelete(null)}
                  className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-100"
                >
                  {t.delete}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-slate-800">{t.members}</h2>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white text-sm"
              />
            </div>
            {!isAdding && !editingId && (
              <button
                onClick={() => setIsAdding(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 font-medium shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">{t.newMember}</span>
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {(isAdding || editingId) && (
            <motion.form
              ref={formRef}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              onSubmit={handleSubmit}
              className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6 overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.name}</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={cn(
                      "w-full px-4 py-2 rounded-xl border transition-all bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500",
                      isDuplicateName 
                        ? "border-red-500 text-red-600 focus:ring-red-500/20 focus:border-red-500" 
                        : "border-slate-200"
                    )}
                  />
                  {isDuplicateName && (
                    <p className="text-[10px] font-bold text-red-500 mt-1 uppercase tracking-wider">
                      {t.nameAlreadyExists}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.phone}</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.birthday}</label>
                  <input
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.likes}</label>
                  <input
                    type="text"
                    placeholder={t.likesPlaceholder}
                    value={formData.likes}
                    onChange={(e) => setFormData({ ...formData, likes: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.likedFood}</label>
                  <input
                    type="text"
                    placeholder={t.foodPlaceholder}
                    value={formData.likedFood}
                    onChange={(e) => setFormData({ ...formData, likedFood: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.address}</label>
                  <input
                    type="text"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                  />
                </div>
                
                <div className="space-y-3 md:col-span-2 pt-2">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={formData.isGpsMember}
                        onChange={(e) => setFormData({ ...formData, isGpsMember: e.target.checked })}
                        className="sr-only"
                      />
                      <div className={`w-10 h-5 rounded-full transition-colors ${formData.isGpsMember ? 'bg-indigo-600' : 'bg-slate-200'}`} />
                      <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${formData.isGpsMember ? 'translate-x-5' : ''}`} />
                    </div>
                    <span className="text-sm font-bold text-slate-600">{t.gpsMember}</span>
                  </label>

                  <AnimatePresence>
                    {formData.isGpsMember && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.gpsName}</label>
                          <input
                            type="text"
                            required={formData.isGpsMember}
                            value={formData.gpsName}
                            onChange={(e) => setFormData({ ...formData, gpsName: e.target.value })}
                            placeholder={t.gpsPlaceholder}
                            className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all bg-white"
                          />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="space-y-4 md:col-span-2 pt-2 border-t border-slate-200">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.occupation}</label>
                      <div className="flex flex-wrap gap-2">
                        {(['none', 'studying', 'working', 'both'] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFormData({ ...formData, occupation: opt })}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                              formData.occupation === opt 
                                ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" 
                                : "bg-white border-slate-200 text-slate-500 hover:border-indigo-200"
                            )}
                          >
                            {t[opt as keyof typeof t] || opt}
                          </button>
                        ))}
                      </div>

                      <AnimatePresence>
                        {formData.occupation !== 'none' && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="space-y-2 pt-2">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.schedule}</label>
                              <div className="flex flex-wrap gap-2">
                                {(['morning', 'night', 'both'] as const).map((opt) => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, occupationTime: opt })}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                                      formData.occupationTime === opt 
                                        ? "bg-indigo-500 border-indigo-500 text-white" 
                                        : "bg-white border-slate-200 text-slate-400 hover:border-indigo-100"
                                    )}
                                  >
                                    {t[opt as keyof typeof t] || opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.evangelized}</label>
                      <label className="flex items-center gap-3 cursor-pointer group w-fit">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={formData.isEvangelized}
                            onChange={(e) => setFormData({ ...formData, isEvangelized: e.target.checked })}
                            className="sr-only"
                          />
                          <div className={`w-10 h-5 rounded-full transition-colors ${formData.isEvangelized ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                          <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${formData.isEvangelized ? 'translate-x-5' : ''}`} />
                        </div>
                        <span className="text-sm font-bold text-slate-600">{t.evangelized}</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancel}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors font-medium"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isDuplicateName}
                  className={cn(
                    "px-6 py-2 rounded-xl transition-all flex items-center gap-2 font-medium shadow-lg",
                    isDuplicateName 
                      ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" 
                      : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100"
                  )}
                >
                  {editingId ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {editingId ? t.updateMember : t.addMember}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto pr-10 space-y-6 scroll-smooth no-scrollbar">
          <AnimatePresence mode="popLayout">
            {filteredAndSortedMembers.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>{t.noMembers}</p>
              </div>
            ) : (
              alphabet.map((letter) => (
                <div 
                  key={letter} 
                  ref={el => sectionRefs.current[letter] = el}
                  className="space-y-3"
                >
                  <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm py-2">
                    <h3 className="text-sm font-black text-indigo-600 uppercase tracking-widest border-b border-indigo-100 pb-1">
                      {letter}
                    </h3>
                  </div>
                  <div className="space-y-3">
                    {groupedMembers[letter].map((member) => {
                      const age = calculateAge(member.birthday);
                      const isExpanded = expandedId === member.id;
                      return (
                        <motion.div
                          key={member.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          onClick={() => toggleExpand(member.id)}
                          className={`group bg-white rounded-2xl border transition-all cursor-pointer overflow-hidden ${isExpanded ? 'p-6 border-indigo-200 shadow-lg ring-1 ring-indigo-500/5' : 'p-3 border-slate-100 shadow-sm hover:border-indigo-100 hover:shadow-md'}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold shadow-inner transition-all ${isExpanded ? 'w-14 h-14 text-xl' : 'w-10 h-10 text-base'}`}>
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <p className={`font-bold text-slate-800 transition-all ${isExpanded ? 'text-lg' : 'text-base'}`}>{member.name}</p>
                                  {age !== null && (
                                    <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-sm">
                                      {age} {t.yrs}
                                    </span>
                                  )}
                                </div>
                                {!isExpanded && (
                                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                                    {member.phone && (
                                      <div className="flex items-center gap-1">
                                        <Phone className="w-2.5 h-2.5" />
                                        {member.phone}
                                      </div>
                                    )}
                                    {member.isGpsMember && member.gpsName && (
                                      <div className="flex items-center gap-1">
                                        <Compass className="w-2.5 h-2.5" />
                                        {member.gpsName}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => startEdit(e, member)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                                title={t.edit}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => handleDelete(e, member.id)}
                                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                title={t.delete}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <div className={`p-1 text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                <ChevronDown className="w-4 h-4" />
                              </div>
                            </div>
                          </div>

                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="mt-4 pt-4 border-t border-slate-50">
                                  <div className="flex flex-wrap gap-x-5 gap-y-1 mb-4">
                                    {member.birthday && (
                                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                        <CalendarIcon className="w-3.5 h-3.5" />
                                        {format(parseISO(member.birthday), 'MMM d, yyyy', { locale })}
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                      <User className="w-3.5 h-3.5" />
                                      {t.joined} {format(parseISO(member.joinDate), 'MMM yyyy', { locale })}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                                    {member.phone && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                          <Phone className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t.phone}</p>
                                          <p className="text-sm text-slate-600 font-medium leading-tight">{member.phone}</p>
                                        </div>
                                      </div>
                                    )}
                                    {member.isGpsMember && member.gpsName && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                                          <Compass className="w-4 h-4 text-indigo-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">GPS</p>
                                          <p className="text-sm text-slate-600 font-medium leading-tight">{member.gpsName}</p>
                                        </div>
                                      </div>
                                    )}
                                    {member.likes && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                                          <Heart className="w-4 h-4 text-rose-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t.likes.split(' / ')[0]}</p>
                                          <p className="text-sm text-slate-600 font-medium leading-tight">{member.likes}</p>
                                        </div>
                                      </div>
                                    )}
                                    {member.likedFood && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                          <Utensils className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t.likedFood}</p>
                                          <p className="text-sm text-slate-600 font-medium leading-tight">{member.likedFood}</p>
                                        </div>
                                      </div>
                                    )}
                                    {member.address && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
                                          <MapPin className="w-4 h-4 text-slate-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t.address}</p>
                                          <p className="text-sm text-slate-600 font-medium leading-tight">{member.address}</p>
                                        </div>
                                      </div>
                                    )}
                                    {member.occupation && member.occupation !== 'none' && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                          <User className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t.occupation}</p>
                                          <p className="text-sm text-slate-600 font-medium leading-tight">
                                            {t[member.occupation as keyof typeof t]} 
                                            {member.occupationTime && member.occupationTime !== 'none' && ` (${t[member.occupationTime as keyof typeof t]})`}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    {member.isEvangelized && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t.evangelized}</p>
                                          <p className="text-sm text-emerald-600 font-bold leading-tight">{t.evangelized}</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </AnimatePresence>
        </div>

        {/* Alphabet Sidebar */}
        {alphabet.length > 0 && (
          <div className="absolute right-0 top-0 bottom-0 w-10 flex flex-col items-center justify-center z-30 bg-white/40 backdrop-blur-[2px] border-l border-slate-100/50">
            <div className="flex flex-col items-center gap-1 overflow-y-auto max-h-[80%] py-4 no-scrollbar">
              {alphabet.map(letter => (
                <button
                  key={letter}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    scrollToLetter(letter);
                  }}
                  className="text-[11px] font-black text-slate-400 hover:text-indigo-600 active:text-indigo-700 transition-all w-full py-1.5 px-2 flex items-center justify-center active:scale-150 touch-none"
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
