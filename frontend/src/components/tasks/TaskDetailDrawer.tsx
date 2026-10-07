import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock,
  Tag,
  Repeat,
  Trash2,
  CheckCircle2,
  Bell,
  Activity,
  Save,
} from 'lucide-react';
import type { Priority, TaskDetail } from '../../types';
import * as taskService from '../../services/tasks';
import { Drawer } from '../ui/Drawer';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';

interface TaskDetailDrawerProps {
  taskId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  taskId,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();

  const { data: task, isLoading } = useQuery<TaskDetail>({
    queryKey: ['task', taskId],
    queryFn: () => taskService.getTask(taskId!),
    enabled: isOpen && taskId !== null,
  });

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('med');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurrence, setRecurrence] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | ''>('');

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setPriority(task.priority || 'med');
      setCategory(task.category || '');
      setDueDate(task.due_at_utc ? new Date(task.due_at_utc).toISOString().slice(0, 16) : '');
      setRecurrence(task.recurrence_rule || '');
      setEstimatedMinutes(task.estimated_minutes || '');
    }
  }, [task]);

  const updateMutation = useMutation({
    mutationFn: (payload: taskService.TaskUpdatePayload) =>
      taskService.updateTask(taskId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => taskService.completeTask(taskId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => taskService.deleteTask(taskId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
      onClose();
    },
  });

  const handleSave = () => {
    if (!title.trim()) return;
    updateMutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      category: category.trim() || null,
      due_at_utc: dueDate ? new Date(dueDate).toISOString() : null,
      recurrence_rule: recurrence.trim() || null,
      estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
    });
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={task ? `Task #${task.id}` : 'Task Details'}>
      {isLoading || !task ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-gray-100 rounded-xl" />
          <div className="h-24 bg-gray-100 rounded-xl" />
          <div className="h-10 bg-gray-100 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Quick Action Top Bar */}
          <div className="flex items-center justify-between gap-2 p-3 bg-gray-50 border border-gray-200 rounded-2xl">
            <div className="flex items-center gap-2">
              <Badge status={task.status} />
              <Badge priority={task.priority} />
            </div>

            <div className="flex items-center gap-2">
              {task.status !== 'done' && (
                <Button
                  onClick={() => completeMutation.mutate()}
                  variant="outline"
                  size="sm"
                  className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  icon={<CheckCircle2 size={15} />}
                  isLoading={completeMutation.isPending}
                >
                  Done
                </Button>
              )}
              <Button
                onClick={() => {
                  if (window.confirm('Are you sure you want to delete this task?')) {
                    deleteMutation.mutate();
                  }
                }}
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 min-w-[36px] min-h-[36px] p-2"
                aria-label="Delete task"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
            />

            <div>
              <label className="text-xs font-semibold text-gray-700 select-none block mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Add more details, links, or notes..."
                className="w-full bg-white text-gray-900 border border-gray-200 rounded-xl p-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-gray-300 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 select-none block mb-1.5">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="low">🟢 Low</option>
                  <option value="med">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                </select>
              </div>

              <Input
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Work, Personal"
                icon={<Tag size={14} />}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 select-none block mb-1.5">
                  Due Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <Input
                label="Estimated (Mins)"
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value ? Number(e.target.value) : '')}
                placeholder="e.g. 30"
                icon={<Clock size={14} />}
              />
            </div>

            <Input
              label="Recurrence Rule"
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value)}
              placeholder="e.g. FREQ=DAILY or every Monday"
              icon={<Repeat size={14} />}
            />

            <Button
              onClick={handleSave}
              variant="primary"
              className="w-full mt-2"
              icon={<Save size={16} />}
              isLoading={updateMutation.isPending}
            >
              Save Changes
            </Button>
          </div>

          {/* Attached Reminders */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Bell size={14} className="text-indigo-600" />
              <span>Scheduled Reminders</span>
            </h4>
            {task.reminders && task.reminders.length > 0 ? (
              <div className="space-y-2">
                {task.reminders.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-gray-400" />
                      <span className="font-medium text-gray-800">
                        {new Date(r.remind_at_utc).toLocaleString()}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-3xs font-semibold ${
                        r.sent
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {r.sent ? 'Sent' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No active reminders scheduled.</p>
            )}
          </div>

          {/* Task Audit Event Timeline */}
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Activity size={14} className="text-indigo-600" />
              <span>Activity History</span>
            </h4>
            {task.events && task.events.length > 0 ? (
              <div className="space-y-2 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {task.events.map((ev) => (
                  <div key={ev.id} className="relative pl-6 text-xs">
                    <div className="absolute left-1 top-1.5 w-2.5 h-2.5 rounded-full bg-indigo-500 -translate-x-1/2 border-2 border-white shadow-2xs" />
                    <p className="font-semibold text-gray-800 capitalize">{ev.event.replace('_', ' ')}</p>
                    <p className="text-2xs text-gray-400">
                      {new Date(ev.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No activity logged yet.</p>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
};
