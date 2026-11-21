import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserPlus, Trash2, User, Edit2, X, Check, Calendar as CalendarIcon, Heart, MapPin, Utensils, Phone, Compass, ChevronDown, Search, CheckCircle2, Archive, ArchiveRestore, Shield, Instagram, MessageCircle, UserCheck } from 'lucide-react';
import { Member } from '../types';
import { Language, translations } from '../translations';
import { motion, AnimatePresence } from 'motion/react';
import { differenceInYears, parseISO, format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { cn } from '../lib/utils';

export const cleanInstagramHandle = (input?: string): string | undefined => {
  if (!input) return undefined;
  let handle = input.trim();
  if (!handle) return undefined;
  handle = handle.replace(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/?/i, '');
  handle = handle.split('?')[0].split('#')[0];
  handle = handle.replace(/^@+/, '').replace(/\/+$/, '').trim();
  return handle || undefined;
};

const getWhatsAppUrl = (phone?: string): string | undefined => {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : undefined;
};

const EMPTY_FORM_DATA = {
  name: '',
  birthday: '',
  likes: '',
  likedFood: '',
  address: '',
  phone: '',
  instagram: '',
  invitedBy: '',
  isGpsMember: false,
  gpsName: '',
  occupation: 'none' as 'none' | 'studying' | 'working' | 'both',
  occupationTime: 'none' as 'morning' | 'night' | 'both' | 'none',
  isEvangelized: false,
  isStaff: false,
  ministry: ''
};

interface MemberListProps {
  members: Member[];
  gpsGroups?: string[];
  onAddMember: (data: { 
    name: string; 
    birthday?: string; 
    likes?: string; 
    likedFood?: string; 
    address?: string; 
    phone?: string;
    instagram?: string;
    invitedBy?: string;
    isGpsMember?: boolean;
    gpsName?: string;
    occupation?: 'none' | 'studying' | 'working' | 'both';
    occupationTime?: 'morning' | 'night' | 'both' | 'none';
    isEvangelized?: boolean;
    isStaff?: boolean;
    ministry?: string;
    isArchived?: boolean;
  }) => void;
  onUpdateMember: (member: Member) => void;
  onBatchUpdateMembers: (updates: Partial<Member>[]) => void;
  onBatchDeleteMembers?: (ids: string[]) => void;
  onDeleteMember: (id: string) => void;
  language: Language;
}

export const MemberList: React.FC<MemberListProps> = ({ members, gpsGroups = [], onAddMember, onUpdateMember, onBatchUpdateMembers, onBatchDeleteMembers, onDeleteMember, language }) => {
  const t = translations[language];
  const locale = language === 'es' ? es : enUS;
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [memberToArchive, setMemberToArchive] = useState<Member | null>(null);
  const [bulkConfirmAction, setBulkConfirmAction] = useState<'archive' | 'unarchive' | 'delete' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Archive & Batch Mode States
  const [showArchived, setShowArchived] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Long-press refs (~500ms) to enter selection mode without interfering with scroll
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const pressStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressStartPosRef.current = null;
  };

  useEffect(() => {
    return () => clearLongPress();
  }, []);

  // Lock background scroll whenever any modal/overlay is open
  const hasOpenModal = Boolean(memberToDelete || memberToArchive || bulkConfirmAction);
  useEffect(() => {
    if (!hasOpenModal) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [hasOpenModal]);

  // Only scroll to top form when creating a new member (inline editing stays right where the user is)
  useEffect(() => {
    if (isAdding) {
      const timer = setTimeout(() => {
        if (formRef.current) {
          formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isAdding]);

  const [formData, setFormData] = useState(EMPTY_FORM_DATA);

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

  const startLongPress = (memberId: string, clientX: number, clientY: number, target: EventTarget | null) => {
    if (isBatchMode || editingId === memberId) return;
    if ((target as HTMLElement | null)?.closest('button, a, input, select, textarea, label')) return;
    clearLongPress();
    longPressTriggeredRef.current = false;
    pressStartPosRef.current = { x: clientX, y: clientY };
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      setIsAdding(false);
      setEditingId(null);
      setExpandedId(null);
      setIsBatchMode(true);
      setSelectedIds(new Set([memberId]));
      longPressTimerRef.current = null;
    }, 500);
  };

  const handlePointerMove = (clientX: number, clientY: number) => {
    if (!pressStartPosRef.current) return;
    const dx = Math.abs(clientX - pressStartPosRef.current.x);
    const dy = Math.abs(clientY - pressStartPosRef.current.y);
    if (dx > 10 || dy > 10) {
      clearLongPress();
    }
  };

  const filteredAndSortedMembers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    const filtered = members.filter(m => {
      const matchesArchive = showArchived ? m.isArchived === true : !m.isArchived;
      if (!matchesArchive) return false;
      return m.name.toLowerCase().includes(query) ||
        (m.phone && m.phone.includes(query)) ||
        (m.instagram && m.instagram.toLowerCase().includes(query)) ||
        (m.gpsName && m.gpsName.toLowerCase().includes(query)) ||
        (m.invitedBy && m.invitedBy.toLowerCase().includes(query));
    });

    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, searchQuery, showArchived]);

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

  const isDuplicateName = useMemo(() => {
    const name = formData.name.trim().toLowerCase();
    if (!name) return false;
    return members.some(m => m.name.toLowerCase() === name && m.id !== editingId);
  }, [formData.name, members, editingId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim() && !isDuplicateName) {
      const cleanHandle = cleanInstagramHandle(formData.instagram);
      const cleanInvitedBy = formData.invitedBy.trim() || undefined;
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
            instagram: cleanHandle,
            invitedBy: cleanInvitedBy,
            isGpsMember: formData.isGpsMember,
            gpsName: formData.isGpsMember ? formData.gpsName : undefined,
            occupation: formData.occupation,
            occupationTime: formData.occupation !== 'none' ? formData.occupationTime : 'none',
            isEvangelized: formData.isEvangelized,
            evangelizado: formData.isEvangelized,
            evangelizadoDate: formData.isEvangelized
              ? (member.evangelizadoDate || format(new Date(), 'yyyy-MM-dd'))
              : undefined,
            isStaff: formData.isStaff,
            ministry: formData.isStaff ? formData.ministry : '',
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
          instagram: cleanHandle,
          invitedBy: cleanInvitedBy,
          isGpsMember: formData.isGpsMember,
          gpsName: formData.isGpsMember ? formData.gpsName : undefined,
          occupation: formData.occupation,
          occupationTime: formData.occupation !== 'none' ? formData.occupationTime : 'none',
          isEvangelized: formData.isEvangelized,
          isStaff: formData.isStaff,
          ministry: formData.isStaff ? formData.ministry : '',
          isArchived: false,
        });
        setIsAdding(false);
      }
      setFormData(EMPTY_FORM_DATA);
    }
  };

  const startEdit = (e: React.MouseEvent, member: Member) => {
    e.stopPropagation();
    setIsAdding(false);
    setEditingId(member.id);
    setExpandedId(member.id);
    setFormData({
      name: member.name,
      birthday: member.birthday || '',
      likes: member.likes || '',
      likedFood: member.likedFood || '',
      address: member.address || '',
      phone: member.phone || '',
      instagram: member.instagram || '',
      invitedBy: member.invitedBy || '',
      isGpsMember: member.isGpsMember || false,
      gpsName: member.gpsName || '',
      occupation: member.occupation || 'none',
      occupationTime: member.occupationTime || 'none',
      isEvangelized: Boolean(member.isEvangelized || member.evangelizado),
      isStaff: member.isStaff || false,
      ministry: member.ministry || ''
    });
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMemberToDelete(id);
  };

  const confirmDelete = () => {
    if (memberToDelete) {
      onDeleteMember(memberToDelete);
      setMemberToDelete(null);
      if (selectedIds.has(memberToDelete)) {
        const next = new Set(selectedIds);
        next.delete(memberToDelete);
        setSelectedIds(next);
      }
    }
  };

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const confirmBulkAction = () => {
    if (!bulkConfirmAction || selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (bulkConfirmAction === 'delete') {
      if (onBatchDeleteMembers) {
        onBatchDeleteMembers(ids);
      } else {
        ids.forEach(id => onDeleteMember(id));
      }
    } else {
      const updates = ids.map(id => ({
        id,
        isArchived: bulkConfirmAction === 'archive'
      }));
      onBatchUpdateMembers(updates);
    }
    setBulkConfirmAction(null);
    setIsBatchMode(false);
    setSelectedIds(new Set());
  };

  const cancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(EMPTY_FORM_DATA);
  };

  const renderFormFields = (mode: 'add' | 'edit') => (
    <>
      {mode === 'edit' && (
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Edit2 className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{t.updateMember}</span>
          </div>
          <button
            type="button"
            onClick={cancel}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-lg transition-colors"
            aria-label={t.cancel}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.name}</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={cn(
              "w-full px-4 py-2 rounded-xl border transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none",
              isDuplicateName 
                ? "border-red-500 text-red-600 focus:ring-red-500/20 focus:border-red-500" 
                : "border-slate-200 dark:border-slate-700"
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
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.instagram}</label>
          <input
            type="text"
            placeholder={t.instagramPlaceholder}
            value={formData.instagram}
            onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.invitedBy}</label>
          <input
            type="text"
            placeholder={t.invitedByPlaceholder}
            value={formData.invitedBy}
            onChange={(e) => setFormData({ ...formData, invitedBy: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.birthday}</label>
          <input
            type="date"
            value={formData.birthday}
            onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.likes}</label>
          <input
            type="text"
            placeholder={t.likesPlaceholder}
            value={formData.likes}
            onChange={(e) => setFormData({ ...formData, likes: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.likedFood}</label>
          <input
            type="text"
            placeholder={t.foodPlaceholder}
            value={formData.likedFood}
            onChange={(e) => setFormData({ ...formData, likedFood: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.address}</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
          />
        </div>
        
        <div className="space-y-3 md:col-span-2 pt-2">
          <label className="flex items-center gap-3 cursor-pointer group w-fit">
            <div className="relative">
              <input
                type="checkbox"
                checked={formData.isGpsMember}
                onChange={(e) => setFormData({ ...formData, isGpsMember: e.target.checked })}
                className="sr-only"
              />
              <div className={`w-10 h-5 rounded-full transition-colors ${formData.isGpsMember ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-700'}`} />
              <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${formData.isGpsMember ? 'translate-x-5' : ''}`} />
            </div>
            <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{t.gpsMember}</span>
          </label>

          {formData.isGpsMember && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.gpsName}</label>
              <select
                required={formData.isGpsMember}
                value={formData.gpsName}
                onChange={(e) => setFormData({ ...formData, gpsName: e.target.value })}
                className="w-full px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 outline-none"
              >
                <option value="">{t.selectGpsGroup}</option>
                {gpsGroups.map((grp) => (
                  <option key={grp} value={grp}>{grp}</option>
                ))}
                {formData.gpsName && !gpsGroups.includes(formData.gpsName) && (
                  <option value={formData.gpsName}>{formData.gpsName}</option>
                )}
              </select>
            </div>
          )}
        </div>

        <div className="space-y-4 md:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-700">
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
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border",
                      formData.occupation === opt 
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-indigo-950" 
                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-200 dark:hover:border-indigo-800"
                    )}
                  >
                    {t[opt as keyof typeof t] || opt}
                  </button>
                ))}
              </div>

              {formData.occupation !== 'none' && (
                <div className="space-y-2 pt-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.schedule}</label>
                  <div className="flex flex-wrap gap-2">
                    {(['morning', 'night', 'both'] as const).map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFormData({ ...formData, occupationTime: opt })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors border",
                          formData.occupationTime === opt 
                            ? "bg-indigo-500 border-indigo-500 text-white" 
                            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-indigo-100 dark:hover:border-indigo-800"
                        )}
                      >
                        {t[opt as keyof typeof t] || opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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
                  <div className={`w-10 h-5 rounded-full transition-colors ${formData.isEvangelized ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${formData.isEvangelized ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{t.evangelized}</span>
              </label>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.staff}</label>
              <label className="flex items-center gap-3 cursor-pointer group w-fit">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={formData.isStaff}
                    onChange={(e) => setFormData({ ...formData, isStaff: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors ${formData.isStaff ? 'bg-purple-500' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${formData.isStaff ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">{t.staff}</span>
              </label>
            </div>

            {formData.isStaff && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">{t.ministry}</label>
                <input
                  type="text"
                  value={formData.ministry}
                  onChange={(e) => setFormData({ ...formData, ministry: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors font-medium text-slate-600 dark:text-slate-200 bg-white dark:bg-slate-800 outline-none"
                  placeholder={t.ministryPlaceholder}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={cancel}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors font-medium text-sm"
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          disabled={isDuplicateName}
          className={cn(
            "px-5 py-2 rounded-xl transition-colors flex items-center gap-2 font-medium text-sm shadow-lg",
            isDuplicateName 
              ? "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none" 
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100 dark:shadow-indigo-950"
          )}
        >
          {mode === 'edit' ? <Check className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {mode === 'edit' ? t.updateMember : t.addMember}
        </button>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full relative">
      {/* Single Delete Confirmation Modal */}
      <AnimatePresence>
        {memberToDelete && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="w-16 h-16 bg-red-50 dark:bg-red-950/60 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-2">{t.delete}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-center mb-8 leading-relaxed">
                {t.confirmDelete}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  className="flex-1 px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors shadow-lg shadow-red-100 dark:shadow-red-950"
                >
                  {t.delete}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Single Archive / Unarchive Confirmation Modal */}
      <AnimatePresence>
        {memberToArchive && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800"
            >
              <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/60 rounded-2xl flex items-center justify-center mb-6 mx-auto">
                {showArchived ? <ArchiveRestore className="w-8 h-8 text-amber-500" /> : <Archive className="w-8 h-8 text-amber-500" />}
              </div>
              <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-2">{showArchived ? t.unarchive : t.archive}</h3>
              <p className="text-slate-500 dark:text-slate-400 text-center mb-8 leading-relaxed">
                {showArchived ? t.confirmRestore : t.confirmArchive}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setMemberToArchive(null)}
                  className="flex-1 px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateMember({ ...memberToArchive, isArchived: !showArchived });
                    setMemberToArchive(null);
                  }}
                  className="flex-1 px-6 py-3 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition-colors shadow-lg shadow-amber-100 dark:shadow-amber-950"
                >
                  {showArchived ? t.unarchive : t.archive}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Archive / Unarchive / Delete Confirmation Modal */}
      <AnimatePresence>
        {bulkConfirmAction && (() => {
          const isDelete = bulkConfirmAction === 'delete';
          const isArchive = bulkConfirmAction === 'archive';
          const countStr = String(selectedIds.size);
          const title = isDelete
            ? t.confirmBulkDeleteTitle
            : isArchive
              ? t.confirmBulkArchiveTitle
              : t.confirmBulkUnarchiveTitle;
          const desc = (isDelete
            ? t.confirmBulkDeleteDesc
            : isArchive
              ? t.confirmBulkArchiveDesc
              : t.confirmBulkUnarchiveDesc
          ).replace('{count}', countStr);
          const confirmLabel = isDelete ? t.delete : isArchive ? t.archive : t.unarchive;

          return (
            <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overscroll-contain">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-slate-100 dark:border-slate-800"
              >
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center mb-6 mx-auto",
                  isDelete ? "bg-red-50 dark:bg-red-950/60" : "bg-amber-50 dark:bg-amber-950/60"
                )}>
                  {isDelete ? (
                    <Trash2 className="w-8 h-8 text-red-500" />
                  ) : isArchive ? (
                    <Archive className="w-8 h-8 text-amber-500" />
                  ) : (
                    <ArchiveRestore className="w-8 h-8 text-amber-500" />
                  )}
                </div>
                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 text-center mb-2">
                  {title} ({selectedIds.size})
                </h3>
                <p className="text-slate-500 dark:text-slate-400 text-center mb-8 leading-relaxed text-sm">
                  {desc}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setBulkConfirmAction(null)}
                    className="flex-1 px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="button"
                    onClick={confirmBulkAction}
                    className={cn(
                      "flex-1 px-6 py-3 rounded-xl text-white font-bold transition-colors shadow-lg",
                      isDelete
                        ? "bg-red-500 hover:bg-red-600 shadow-red-100 dark:shadow-red-950"
                        : "bg-amber-500 hover:bg-amber-600 shadow-amber-100 dark:shadow-amber-950"
                    )}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{t.members}</h2>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t.search}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 text-sm outline-none"
              />
            </div>
            
            <div className="flex items-center justify-between gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => { setShowArchived(!showArchived); setIsBatchMode(false); setSelectedIds(new Set()); setEditingId(null); }}
                className={`flex-1 sm:flex-none flex items-center justify-center py-2.5 px-3 sm:py-2 rounded-xl border transition-colors ${showArchived ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                title={showArchived ? t.hideArchived : t.showArchived}
              >
                {showArchived ? <ArchiveRestore className="w-5 h-5 sm:w-4 sm:h-4" /> : <Archive className="w-5 h-5 sm:w-4 sm:h-4" />}
                <span className="hidden sm:inline ml-2 font-bold text-sm text-nowrap">{showArchived ? t.hideArchived : t.showArchived}</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  const nextMode = !isBatchMode;
                  setIsBatchMode(nextMode);
                  setSelectedIds(new Set());
                  if (nextMode) {
                    setEditingId(null);
                    setIsAdding(false);
                  }
                }}
                className={`flex-1 sm:flex-none flex items-center justify-center py-2.5 px-3 sm:py-2 rounded-xl border transition-colors ${isBatchMode ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                title={t.selectMembers}
              >
                <CheckCircle2 className="w-5 h-5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline ml-2 font-bold text-sm text-nowrap">{t.selectMembers}</span>
              </button>

              {!isAdding && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setFormData(EMPTY_FORM_DATA);
                    setIsAdding(true);
                    setIsBatchMode(false);
                  }}
                  className="flex-1 sm:flex-none bg-indigo-600 text-white py-2.5 px-3 sm:px-4 sm:py-2 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 font-medium shrink-0"
                  title={t.newMember}
                >
                  <UserPlus className="w-5 h-5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline font-bold text-sm whitespace-nowrap">{t.newMember}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* New Member Creation Form (Top) - Edit form renders inline inside each card */}
        <AnimatePresence>
          {isAdding && (
            <motion.form
              ref={formRef}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 mb-6 overflow-hidden"
            >
              {renderFormFields('add')}
            </motion.form>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <div
          ref={scrollContainerRef}
          className={cn(
            "flex-1 space-y-6 scroll-smooth no-scrollbar pb-24",
            hasOpenModal ? "overflow-hidden" : "overflow-y-auto"
          )}
        >
          {filteredAndSortedMembers.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <User className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>{t.noMembers}</p>
            </div>
          ) : (
            alphabet.map((letter) => (
              <div 
                key={letter}
                className="space-y-3"
              >
                <div className="sticky top-0 z-10 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm py-2">
                  <h3 className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest border-b border-indigo-100 dark:border-indigo-900/50 pb-1">
                    {letter}
                  </h3>
                </div>
                <div className="space-y-3">
                  {groupedMembers[letter].map((member) => {
                    const age = calculateAge(member.birthday);
                    const isEditing = editingId === member.id;
                    const isExpanded = expandedId === member.id && !isBatchMode && !isEditing;
                    const isSelected = selectedIds.has(member.id);
                    const whatsAppUrl = getWhatsAppUrl(member.phone);
                    const cleanHandle = cleanInstagramHandle(member.instagram);
                    const isEvang = Boolean(member.isEvangelized || member.evangelizado);
                    
                    return (
                      <div
                        id={`member-card-${member.id}`}
                        key={member.id}
                        onTouchStart={(e) => {
                          const touch = e.touches[0];
                          if (touch) startLongPress(member.id, touch.clientX, touch.clientY, e.target);
                        }}
                        onTouchMove={(e) => {
                          const touch = e.touches[0];
                          if (touch) handlePointerMove(touch.clientX, touch.clientY);
                        }}
                        onTouchEnd={clearLongPress}
                        onTouchCancel={clearLongPress}
                        onMouseDown={(e) => {
                          if (e.button === 0) startLongPress(member.id, e.clientX, e.clientY, e.target);
                        }}
                        onMouseMove={(e) => {
                          if (pressStartPosRef.current) handlePointerMove(e.clientX, e.clientY);
                        }}
                        onMouseUp={clearLongPress}
                        onMouseLeave={clearLongPress}
                        onClick={() => {
                          if (longPressTriggeredRef.current) {
                            longPressTriggeredRef.current = false;
                            return;
                          }
                          if (isEditing) return;
                          if (isBatchMode) {
                            toggleSelection(member.id);
                          } else {
                            toggleExpand(member.id);
                          }
                        }}
                        className={cn(
                          "group bg-white dark:bg-slate-900 rounded-2xl border transition-[border-color,box-shadow,background-color] duration-200 overflow-hidden",
                          isEditing
                            ? "p-4 sm:p-5 border-indigo-300 dark:border-indigo-700 shadow-lg ring-2 ring-indigo-500/15 bg-slate-50/70 dark:bg-slate-900"
                            : cn(
                                "p-3.5 sm:p-4 cursor-pointer select-none",
                                isExpanded
                                  ? "border-indigo-200 dark:border-indigo-800 shadow-md ring-1 ring-indigo-500/10"
                                  : "border-slate-100 dark:border-slate-800 shadow-sm hover:border-indigo-100 dark:hover:border-indigo-900/50 hover:shadow-md",
                                isSelected && "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/30"
                              )
                        )}
                      >
                        {isEditing ? (
                          <form
                            onSubmit={handleSubmit}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {renderFormFields('edit')}
                          </form>
                        ) : (
                          <>
                            <div className="flex items-start sm:items-center justify-between w-full gap-2 min-w-0">
                              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                                {isBatchMode && (
                                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 dark:border-slate-600'}`}>
                                    {isSelected && <Check className="w-4 h-4 text-white" />}
                                  </div>
                                )}
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-base shadow-inner shrink-0">
                                  {member.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                    <p className="font-bold text-base text-slate-800 dark:text-slate-100 break-words">{member.name}</p>
                                    {member.isStaff && (
                                      <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[10px] font-black uppercase tracking-wider shrink-0 mt-0.5 sm:mt-0">
                                        {t.staff}
                                      </span>
                                    )}
                                    {age !== null && (
                                      <span className="px-2 py-0.5 bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-sm shrink-0 mt-0.5 sm:mt-0">
                                        {age}
                                      </span>
                                    )}
                                  </div>
                                  {!isExpanded && (
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-slate-400 dark:text-slate-400 min-w-0">
                                      {member.phone && (
                                        <div className="flex items-center gap-1 shrink-0">
                                          <Phone className="w-2.5 h-2.5 shrink-0" />
                                          {member.phone}
                                        </div>
                                      )}
                                      {cleanHandle && (
                                        <a
                                          href={`https://instagram.com/${cleanHandle}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="flex items-center gap-1 shrink-0 text-pink-600 dark:text-pink-400 hover:text-pink-700 dark:hover:text-pink-300 hover:underline"
                                          title={`@${cleanHandle}`}
                                        >
                                          <Instagram className="w-2.5 h-2.5 shrink-0" />
                                          <span>@{cleanHandle}</span>
                                        </a>
                                      )}
                                      {member.isGpsMember && member.gpsName && (
                                        <div className="flex items-center gap-1 min-w-0">
                                          <Compass className="w-2.5 h-2.5 shrink-0" />
                                          <span className="truncate">{member.gpsName}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {!isBatchMode && (
                                <div className="flex items-center gap-1 shrink-0 mt-0.5 sm:mt-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setMemberToArchive(member);
                                    }}
                                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                                    title={showArchived ? t.unarchive : t.archive}
                                  >
                                    {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => startEdit(e, member)}
                                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl transition-colors"
                                    title={t.edit}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDelete(e, member.id)}
                                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/60 rounded-xl transition-colors"
                                    title={t.delete}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                  <div className={`p-1 text-slate-300 dark:text-slate-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                                    <ChevronDown className="w-4 h-4" />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Smooth CSS Grid-Rows Expand/Collapse Panel (Zero Layout Stutter) */}
                            <div
                              aria-hidden={!isExpanded}
                              className={cn(
                                "grid transition-[grid-template-rows,opacity] duration-200 ease-out",
                                isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
                              )}
                            >
                              <div className="overflow-hidden">
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 select-text">
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

                                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
                                    {member.phone && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
                                          <Phone className="w-4 h-4 text-emerald-500" />
                                        </div>
                                        <div className="space-y-1 min-w-0">
                                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.phone}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-tight">{member.phone}</p>
                                          {whatsAppUrl && (
                                            <a
                                              href={whatsAppUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              onClick={(e) => e.stopPropagation()}
                                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/70 dark:border-emerald-800/60 text-xs font-bold transition-colors mt-1"
                                            >
                                              <MessageCircle className="w-3.5 h-3.5" />
                                              <span>WhatsApp</span>
                                            </a>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {cleanHandle && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-950/60 flex items-center justify-center shrink-0">
                                          <Instagram className="w-4 h-4 text-pink-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.instagram}</p>
                                          <a
                                            href={`https://instagram.com/${cleanHandle}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-sm text-pink-600 dark:text-pink-400 hover:text-pink-800 dark:hover:text-pink-300 hover:underline font-medium leading-tight flex items-center gap-1"
                                          >
                                            @{cleanHandle}
                                          </a>
                                        </div>
                                      </div>
                                    )}
                                    {member.invitedBy && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center shrink-0">
                                          <UserCheck className="w-4 h-4 text-sky-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.invitedBy}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-tight">{member.invitedBy}</p>
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex items-start gap-3">
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${member.isGpsMember && member.gpsName ? 'bg-indigo-50 dark:bg-indigo-950/60' : 'bg-slate-50 dark:bg-slate-800'}`}>
                                        <Compass className={`w-4 h-4 ${member.isGpsMember && member.gpsName ? 'text-indigo-500' : 'text-slate-400'}`} />
                                      </div>
                                      <div className="space-y-0.5">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">GPS</p>
                                        <p className={`text-sm font-medium leading-tight ${member.isGpsMember && member.gpsName ? 'text-slate-600 dark:text-slate-300' : 'text-slate-400'}`}>
                                          {member.isGpsMember && member.gpsName ? member.gpsName : t.notInGps}
                                        </p>
                                      </div>
                                    </div>
                                    {member.isStaff && member.ministry && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center shrink-0">
                                          <Shield className="w-4 h-4 text-purple-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.ministry}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-tight">{member.ministry}</p>
                                        </div>
                                      </div>
                                    )}
                                    {member.likes && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center shrink-0">
                                          <Heart className="w-4 h-4 text-rose-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.likes.split(' / ')[0]}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-tight">{member.likes}</p>
                                        </div>
                                      </div>
                                    )}
                                    {member.likedFood && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
                                          <Utensils className="w-4 h-4 text-amber-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.likedFood}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-tight">{member.likedFood}</p>
                                        </div>
                                      </div>
                                    )}
                                    {member.address && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                          <MapPin className="w-4 h-4 text-slate-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.address}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-tight">{member.address}</p>
                                        </div>
                                      </div>
                                    )}
                                    {member.occupation && member.occupation !== 'none' && (
                                      <div className="flex items-start gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center shrink-0">
                                          <User className="w-4 h-4 text-blue-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                          <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.occupation}</p>
                                          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium leading-tight">
                                            {t[member.occupation as keyof typeof t]} 
                                            {member.occupationTime && member.occupationTime !== 'none' && ` (${t[member.occupationTime as keyof typeof t]})`}
                                          </p>
                                        </div>
                                      </div>
                                    )}
                                    <div className="flex items-start gap-3">
                                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isEvang ? 'bg-emerald-50 dark:bg-emerald-950/60' : 'bg-slate-50 dark:bg-slate-800'}`}>
                                        <CheckCircle2 className={`w-4 h-4 ${isEvang ? 'text-emerald-500' : 'text-slate-400'}`} />
                                      </div>
                                      <div className="space-y-0.5">
                                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.evangelized}</p>
                                        <p className={`text-sm font-bold leading-tight ${isEvang ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
                                          {isEvang ? t.yes : t.no}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating Bulk Selection Bar (Portaled & Centered) */}
      {typeof document !== 'undefined' && createPortal(
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[150] w-max max-w-[94vw] pointer-events-none">
          <AnimatePresence>
            {isBatchMode && (
              <motion.div
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 80 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto bg-slate-900 dark:bg-slate-800 text-white px-4 sm:px-6 py-3.5 rounded-full shadow-2xl border border-slate-700 flex items-center justify-between gap-3 sm:gap-5 whitespace-nowrap"
              >
                <span className="font-bold text-xs sm:text-sm">
                  {t.selectedCount.replace('{count}', String(selectedIds.size))}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setIsBatchMode(false); setSelectedIds(new Set()); }}
                    className="p-2 sm:px-3.5 sm:py-2 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-full text-slate-300 transition-colors text-xs sm:text-sm font-medium"
                    title={t.cancel}
                  >
                    <X className="w-4 h-4 sm:hidden" />
                    <span className="hidden sm:inline">{t.cancel}</span>
                  </button>
                  <button 
                    type="button"
                    disabled={selectedIds.size === 0}
                    onClick={() => setBulkConfirmAction(showArchived ? 'unarchive' : 'archive')}
                    className="px-3.5 sm:px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:bg-slate-700 disabled:text-slate-500 rounded-full font-bold transition-colors text-xs sm:text-sm flex items-center gap-1.5"
                    title={showArchived ? t.unarchive : t.archive}
                  >
                    {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                    <span className="hidden sm:inline">{showArchived ? t.unarchive : t.archive}</span>
                  </button>
                  <button 
                    type="button"
                    disabled={selectedIds.size === 0}
                    onClick={() => setBulkConfirmAction('delete')}
                    className="px-3.5 sm:px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 rounded-full font-bold transition-colors text-xs sm:text-sm flex items-center gap-1.5"
                    title={t.delete}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">{t.delete}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>,
        document.body
      )}

    </div>
  );
};
