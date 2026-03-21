import React, { useState, useMemo } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval,
  parseISO
} from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Gift } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language, translations } from '../translations';
import { AttendanceRecord, Member } from '../types';

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  language: Language;
  attendanceRecords: AttendanceRecord[];
  members: Member[];
}

export const Calendar: React.FC<CalendarProps> = ({ selectedDate, onDateSelect, language, attendanceRecords, members }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const locale = language === 'es' ? es : enUS;

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = useMemo(() => eachDayOfInterval({
    start: startDate,
    end: endDate,
  }), [startDate, endDate]);

  const serviceDates = useMemo(() => {
    return new Set(attendanceRecords
      .filter(record => record.presentMemberIds.length > 0)
      .map(record => record.date)
    );
  }, [attendanceRecords]);

  const weekDays = useMemo(() => language === 'es' 
    ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], [language]);

  const birthdayMembers = useMemo(() => members.filter(m => !m.isArchived && m.birthday), [members]);

  const membersWithBirthdayToday = useMemo(() => {
    const selectedDateStr = format(selectedDate, 'MM-dd');
    return birthdayMembers.filter(m => m.birthday?.slice(5, 10) === selectedDateStr);
  }, [birthdayMembers, selectedDate]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-800 capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-slate-400 uppercase tracking-wider py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = isSameMonth(day, monthStart);
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasService = serviceDates.has(dateStr);
          const hasBirthday = birthdayMembers.some(m => m.birthday?.slice(5, 10) === format(day, 'MM-dd'));
          
          return (
            <button
              key={idx}
              onClick={() => onDateSelect(day)}
              className={cn(
                "h-10 w-full flex flex-col items-center justify-center rounded-lg text-sm transition-all relative overflow-hidden",
                !isCurrentMonth && "text-slate-300",
                isCurrentMonth && !isSelected && "text-slate-600 hover:bg-slate-50",
                isSelected && "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-100",
                !isSelected && isToday && "ring-2 ring-inset ring-indigo-300 text-indigo-700 font-bold",
                hasService && !isSelected && "bg-indigo-50 text-indigo-700 font-medium"
              )}
            >
              <div className="absolute top-1 right-1 flex gap-0.5">
                  {hasBirthday && <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-sm" />}
              </div>
              <span>{format(day, 'd')}</span>
              {hasService && (
                <div className={cn(
                  "absolute bottom-1.5 w-1 h-1 rounded-full",
                  isSelected ? "bg-white" : "bg-indigo-400"
                )} />
              )}
            </button>
          );
        })}
      </div>

      {membersWithBirthdayToday.length > 0 && (
        <div className="mt-4 p-3 bg-rose-50 rounded-xl border border-rose-100">
           <p className="text-xs font-bold text-rose-600 mb-1 flex items-center gap-1">
             <Gift className="w-3 h-3" /> 
             {language === 'es' ? 'Cumpleaños en este día' : 'Birthdays on this date'}
           </p>
           <div className="flex flex-wrap gap-2">
             {membersWithBirthdayToday.map(m => (
               <span key={m.id} className="text-sm font-medium text-rose-800 bg-white px-2 py-0.5 rounded-lg border border-rose-100">
                 {m.name}
               </span>
             ))}
           </div>
        </div>
      )}
    </div>
  );
};
