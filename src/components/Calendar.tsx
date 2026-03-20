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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { Language } from '../translations';
import { AttendanceRecord } from '../types';

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  language: Language;
  attendanceRecords: AttendanceRecord[];
}

export const Calendar: React.FC<CalendarProps> = ({ selectedDate, onDateSelect, language, attendanceRecords }) => {
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
          const isCurrentMonth = isSameMonth(day, monthStart);
          const dateStr = format(day, 'yyyy-MM-dd');
          const hasService = serviceDates.has(dateStr);
          
          return (
            <button
              key={idx}
              onClick={() => onDateSelect(day)}
              className={cn(
                "h-10 w-full flex flex-col items-center justify-center rounded-lg text-sm transition-all relative",
                !isCurrentMonth && "text-slate-300",
                isCurrentMonth && !isSelected && "text-slate-600 hover:bg-slate-50",
                isSelected && "bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-100",
                hasService && !isSelected && "bg-indigo-50 text-indigo-700 font-medium"
              )}
            >
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
    </div>
  );
};
