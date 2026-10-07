import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Clock,
  Repeat,
  MoreVertical,
  Calendar,
  Check,
  Trash2,
  Hourglass,
  Tag,
} from 'lucide-react';
import type { Task } from '../../types';
import { Badge } from '../ui/Badge';

interface TaskCardProps {
  task: Task;
  onComplete: (taskId: number) => void;
  onSnooze: (taskId: number, options: { snooze_minutes?: number; snooze_until?: string }) => void;
  onDelete: (taskId: number) => void;
  onClick: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onComplete,
  onSnooze,
  onDelete,
  onClick,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const formatDue = (dueUtc: string | null) => {
    if (!dueUtc) return null;
    const dt = new Date(dueUtc);
    const now = new Date();
    const isToday = dt.toDateString() === now.toDateString();
    const isPast = dt < now;

    const timeStr = dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isToday) {
      return { text: `Today at ${timeStr}`, isPast };
    }

    const dateStr = dt.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return { text: `${dateStr} at ${timeStr}`, isPast };
  };

  const dueInfo = formatDue(task.due_at_utc);
  const isDone = task.status === 'done';

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDone) {
      // Trigger festive celebratory confetti micro-animation
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#4F46E5', '#10B981', '#F59E0B'],
      });
      onComplete(task.id);
    }
  };

  return (
    <div
      onClick={() => onClick(task)}
      className={`group relative bg-white border rounded-2xl p-4 transition-all duration-150 cursor-pointer shadow-2xs hover:shadow-sm ${
        isDone
          ? 'border-gray-200/60 bg-gray-50/40 opacity-70'
          : dueInfo?.isPast
          ? 'border-red-200/80 hover:border-red-300'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3.5">
        {/* Completion Checkbox */}
        <button
          type="button"
          onClick={handleCheckboxClick}
          className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all duration-150 shrink-0 cursor-pointer ${
            isDone
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'border-gray-300 hover:border-indigo-600 bg-white'
          }`}
          aria-label={isDone ? 'Mark as incomplete' : 'Mark as complete'}
        >
          {isDone && <Check size={14} className="stroke-[3]" />}
        </button>

        {/* Task Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge priority={task.priority} size="sm" />

            {task.category && (
              <span className="inline-flex items-center gap-1 text-3xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                <Tag size={10} />
                <span>{task.category}</span>
              </span>
            )}

            {task.recurrence_rule && (
              <span className="inline-flex items-center gap-1 text-3xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                <Repeat size={10} />
                <span>Recurring</span>
              </span>
            )}

            {task.status === 'snoozed' && (
              <Badge status="snoozed" size="sm" />
            )}
          </div>

          <h3
            className={`text-sm font-semibold text-gray-900 leading-snug break-words ${
              isDone ? 'line-through text-gray-400 font-normal' : ''
            }`}
          >
            {task.title}
          </h3>

          {task.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Footer Metadata */}
          <div className="flex items-center gap-3 mt-2.5 text-xs text-gray-500 flex-wrap">
            {dueInfo && (
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  !isDone && dueInfo.isPast ? 'text-red-600 font-semibold' : 'text-gray-500'
                }`}
              >
                <Clock size={12} />
                <span>{dueInfo.text}</span>
              </span>
            )}

            {task.estimated_minutes && (
              <span className="inline-flex items-center gap-1 text-gray-400">
                <span>⏱️ {task.estimated_minutes}m</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Menu Trigger */}
        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            aria-label="More options"
          >
            <MoreVertical size={16} />
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setIsMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1.5 text-xs">
                {!isDone && (
                  <>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onSnooze(task.id, { snooze_minutes: 60 });
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 cursor-pointer"
                    >
                      <Hourglass size={14} />
                      <span>Snooze 1 Hour</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        onSnooze(task.id, { snooze_minutes: 1440 });
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 cursor-pointer"
                    >
                      <Calendar size={14} />
                      <span>Snooze to Tomorrow</span>
                    </button>
                    <div className="h-px bg-gray-100 my-1" />
                  </>
                )}
                <button
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDelete(task.id);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete Task</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
