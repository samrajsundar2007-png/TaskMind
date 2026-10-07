import React from 'react';
import { Sparkles, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import type { Task } from '../../types';
import { TaskCard } from './TaskCard';
import { Button } from '../ui/Button';

interface TaskListProps {
  tasks: Task[];
  onComplete: (taskId: number) => void;
  onSnooze: (taskId: number, options: { snooze_minutes?: number; snooze_until?: string }) => void;
  onDelete: (taskId: number) => void;
  onSelectTask: (task: Task) => void;
  onOpenNewTaskModal: () => void;
  isLoading?: boolean;
}

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onComplete,
  onSnooze,
  onDelete,
  onSelectTask,
  onOpenNewTaskModal,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="space-y-3 py-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-100/80 rounded-2xl animate-pulse border border-gray-200" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 px-4 bg-white border border-gray-200/80 rounded-3xl mt-4">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto mb-4 shadow-2xs">
          <Sparkles size={24} />
        </div>
        <h3 className="text-base font-bold text-gray-900">All clear! No tasks found</h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1.5 leading-relaxed">
          You're all caught up. Chat with the AI or click below to remember something new.
        </p>
        <Button
          onClick={onOpenNewTaskModal}
          variant="primary"
          size="md"
          className="mt-5 shadow-xs"
        >
          Add a Task
        </Button>
      </div>
    );
  }

  // Categorize tasks for pleasant visual hierarchy
  const now = new Date();
  const overdue: Task[] = [];
  const today: Task[] = [];
  const upcoming: Task[] = [];
  const completed: Task[] = [];

  tasks.forEach((t) => {
    if (t.status === 'done') {
      completed.push(t);
      return;
    }

    if (!t.due_at_utc) {
      upcoming.push(t);
      return;
    }

    const due = new Date(t.due_at_utc);
    const isToday = due.toDateString() === now.toDateString();

    if (due < now && !isToday) {
      overdue.push(t);
    } else if (isToday) {
      today.push(t);
    } else {
      upcoming.push(t);
    }
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Overdue Section */}
      {overdue.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-red-600 uppercase tracking-wider">
            <AlertCircle size={14} />
            <span>Overdue ({overdue.length})</span>
          </div>
          <div className="space-y-2.5">
            {overdue.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                onSnooze={onSnooze}
                onDelete={onDelete}
                onClick={onSelectTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* Today Section */}
      {today.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider">
            <Calendar size={14} className="text-indigo-600" />
            <span>Today ({today.length})</span>
          </div>
          <div className="space-y-2.5">
            {today.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                onSnooze={onSnooze}
                onDelete={onDelete}
                onClick={onSelectTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming / Someday Section */}
      {upcoming.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
            <span>Upcoming / Later ({upcoming.length})</span>
          </div>
          <div className="space-y-2.5">
            {upcoming.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                onSnooze={onSnooze}
                onDelete={onDelete}
                onClick={onSelectTask}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Section */}
      {completed.length > 0 && (
        <div className="space-y-2.5 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 uppercase tracking-wider">
            <CheckCircle2 size={14} />
            <span>Completed ({completed.length})</span>
          </div>
          <div className="space-y-2.5">
            {completed.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                onSnooze={onSnooze}
                onDelete={onDelete}
                onClick={onSelectTask}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
