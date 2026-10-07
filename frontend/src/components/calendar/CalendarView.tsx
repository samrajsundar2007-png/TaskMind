import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
} from 'lucide-react';
import type { Task } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface CalendarViewProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  onOpenNewTaskModal: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  tasks,
  onSelectTask,
  onOpenNewTaskModal,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startingDayIndex = firstDayOfMonth.getDay(); // 0 = Sunday
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDay(now);
  };

  // Map tasks to dates
  const getTasksForDate = (date: Date) => {
    const dateStr = date.toDateString();
    return tasks.filter((t) => {
      if (!t.due_at_utc) return false;
      const due = new Date(t.due_at_utc);
      return due.toDateString() === dateStr;
    });
  };

  const selectedDayTasks = getTasksForDate(selectedDay);

  // Generate calendar grid days
  const calendarDays = [];
  // Leading empty days
  for (let i = 0; i < startingDayIndex; i++) {
    calendarDays.push(null);
  }
  // Days of month
  for (let d = 1; d <= totalDaysInMonth; d++) {
    calendarDays.push(new Date(year, month, d));
  }

  const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
  const isTodayDate = (d: Date) => isSameDay(d, new Date());

  return (
    <div className="space-y-6">
      {/* Calendar Header Bar */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-3xl p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <CalendarIcon size={20} />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {monthNames[month]} {year}
            </h2>
            <p className="text-2xs text-gray-500 font-medium">Monthly Task Schedule</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button onClick={handleToday} variant="outline" size="sm">
            Today
          </Button>
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 transition-colors cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
            aria-label="Next month"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Main Grid + Day Task Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Monthly Matrix */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-5 shadow-2xs">
          {/* Weekday headers */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty_${idx}`} className="h-20 sm:h-24 bg-gray-50/50 rounded-2xl" />;
              }

              const dayTasks = getTasksForDate(day);
              const isSelected = isSameDay(day, selectedDay);
              const isCurrent = isTodayDate(day);

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`h-20 sm:h-24 p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-600 ring-2 ring-indigo-100 bg-indigo-50/30'
                      : isCurrent
                      ? 'border-indigo-200 bg-indigo-50/10 hover:border-indigo-300'
                      : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                        isCurrent
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : isSelected
                          ? 'text-indigo-700 font-extrabold'
                          : 'text-gray-700'
                      }`}
                    >
                      {day.getDate()}
                    </span>

                    {dayTasks.length > 0 && (
                      <span className="text-3xs font-bold text-gray-400">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Task dots */}
                  <div className="flex items-center gap-1 flex-wrap overflow-hidden">
                    {dayTasks.slice(0, 3).map((t) => (
                      <span
                        key={t.id}
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          t.priority === 'high'
                            ? 'bg-red-500'
                            : t.priority === 'med'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        title={t.title}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="text-3xs font-bold text-gray-400">
                        +{dayTasks.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Agenda Sidebar */}
        <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div>
              <h3 className="text-sm font-bold text-gray-900">
                {selectedDay.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </h3>
              <p className="text-2xs text-gray-500 font-medium">
                {selectedDayTasks.length} task(s) scheduled
              </p>
            </div>
            <Button
              onClick={onOpenNewTaskModal}
              variant="outline"
              size="sm"
              icon={<Plus size={14} />}
            >
              Add
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {selectedDayTasks.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-xs text-gray-400">No tasks due on this date.</p>
              </div>
            ) : (
              selectedDayTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="p-3 bg-gray-50/80 hover:bg-indigo-50/40 border border-gray-200 rounded-2xl transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <Badge priority={t.priority} size="sm" />
                    <span className="text-2xs text-gray-400 font-medium">
                      {t.due_at_utc ? new Date(t.due_at_utc).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <h4 className="text-xs font-semibold text-gray-900 truncate">{t.title}</h4>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
