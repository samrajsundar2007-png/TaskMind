import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Tag, Clock, Repeat, Plus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { Priority } from '../../types';
import { useAuth } from '../../context/AuthContext';
import * as taskService from '../../services/tasks';
import * as chatService from '../../services/chat';

interface TaskCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TaskCreateModal: React.FC<TaskCreateModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<'natural' | 'manual'>('natural');
  const [naturalText, setNaturalText] = useState('');

  // Manual fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('med');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number | ''>('');
  const [recurrence, setRecurrence] = useState('');

  const chatMutation = useMutation({
    mutationFn: (message: string) =>
      chatService.sendChatMessage({
        message,
        user_id: user?.id,
        session_id: `session_${user?.id || 1}`,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
      setNaturalText('');
      onClose();
    },
  });

  const manualCreateMutation = useMutation({
    mutationFn: (payload: taskService.TaskCreatePayload) =>
      taskService.createTask(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
      resetManualForm();
      onClose();
    },
  });

  const resetManualForm = () => {
    setTitle('');
    setDescription('');
    setPriority('med');
    setCategory('');
    setDueDate('');
    setEstimatedMinutes('');
    setRecurrence('');
  };

  const handleNaturalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalText.trim()) return;
    chatMutation.mutate(naturalText.trim());
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !user) return;
    manualCreateMutation.mutate({
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      category: category.trim() || null,
      due_at_utc: dueDate ? new Date(dueDate).toISOString() : null,
      estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      recurrence_rule: recurrence.trim() || null,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Remember a New Task">
      {/* Mode Switcher */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        <button
          type="button"
          onClick={() => setMode('natural')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'natural'
              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <Sparkles size={14} className={mode === 'natural' ? 'text-indigo-600' : ''} />
          <span>AI Natural Input</span>
        </button>
        <button
          type="button"
          onClick={() => setMode('manual')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'manual'
              ? 'bg-white text-indigo-700 shadow-2xs font-bold'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <span>Manual Fields</span>
        </button>
      </div>

      {mode === 'natural' ? (
        <form onSubmit={handleNaturalSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5 select-none">
              What would you like to remember?
            </label>
            <textarea
              autoFocus
              rows={3}
              value={naturalText}
              onChange={(e) => setNaturalText(e.target.value)}
              placeholder="e.g. 'Call accountant tomorrow at 3pm urgent in Finance' or 'Drink water every 2 hours'"
              className="w-full bg-white text-gray-900 border border-gray-200 rounded-2xl p-3.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-gray-300 transition-colors leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap text-2xs text-gray-400">
            <span>Try:</span>
            <button
              type="button"
              onClick={() => setNaturalText('Submit quarterly tax return tomorrow 5pm priority high category Work')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              Tax return tomorrow 5pm
            </button>
            <button
              type="button"
              onClick={() => setNaturalText('Buy groceries this Saturday in Personal')}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
            >
              Groceries Saturday
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<Sparkles size={16} />}
              isLoading={chatMutation.isPending}
              disabled={!naturalText.trim()}
            >
              Add Task
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <Input
            autoFocus
            label="Title *"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Schedule team retrospective"
            required
          />

          <div>
            <label className="text-xs font-semibold text-gray-700 block mb-1.5 select-none">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or details..."
              className="w-full bg-white text-gray-900 border border-gray-200 rounded-xl p-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5 select-none">
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
              placeholder="e.g. Work, Health"
              icon={<Tag size={14} />}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1.5 select-none">
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
              label="Estimated Duration (Mins)"
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value ? Number(e.target.value) : '')}
              placeholder="e.g. 30"
              icon={<Clock size={14} />}
            />
          </div>

          <Input
            label="Recurrence Rule (Optional)"
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            placeholder="e.g. FREQ=DAILY or every Monday"
            icon={<Repeat size={14} />}
          />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<Plus size={16} />}
              isLoading={manualCreateMutation.isPending}
              disabled={!title.trim()}
            >
              Create Task
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};
