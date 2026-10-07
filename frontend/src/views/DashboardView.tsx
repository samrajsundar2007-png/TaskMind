import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import { Sun, ChevronDown, ChevronUp } from 'lucide-react';
import type { Task, TaskStatus, Priority, DailyBriefing } from '../types';
import * as taskService from '../services/tasks';
import * as smartService from '../services/smart';
import { useAuth } from '../context/AuthContext';
import { TaskFilterBar } from '../components/tasks/TaskFilterBar';
import { TaskList } from '../components/tasks/TaskList';
import { TaskDetailDrawer } from '../components/tasks/TaskDetailDrawer';
import { ChatPanel } from '../components/chat/ChatPanel';
import type { LayoutContextType } from '../components/layout/AppLayout';

export const DashboardView: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { searchQuery, openNewTaskModal } = useOutletContext<LayoutContextType>();

  // Filter States
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | 'all'>('pending');
  const [selectedPriority, setSelectedPriority] = useState<Priority | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isBriefingDismissed, setIsBriefingDismissed] = useState(false);
  const [isBriefingExpanded, setIsBriefingExpanded] = useState(false);

  // Queries
  const { data: tasksData, isLoading: isTasksLoading } = useQuery({
    queryKey: [
      'tasks',
      user?.id,
      selectedStatus,
      selectedPriority,
      selectedCategory,
      searchQuery,
    ],
    queryFn: () =>
      taskService.getTasks({
        user_id: user?.id,
        status: selectedStatus === 'all' ? undefined : selectedStatus,
        priority: selectedPriority === 'all' ? undefined : selectedPriority,
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        search: searchQuery.trim() || undefined,
        limit: 100,
      }),
  });

  const { data: dailyBriefing } = useQuery<DailyBriefing>({
    queryKey: ['dailyBriefing', user?.id],
    queryFn: () => smartService.getDailyBriefing(user?.id),
    staleTime: 1000 * 60 * 15, // 15 mins
  });

  const tasks: Task[] = tasksData?.items || [];

  // Extract unique categories from tasks
  const allCategories: string[] = Array.from(
    new Set(
      tasks
        .map((t: Task) => t.category)
        .filter((c: string | null): c is string => Boolean(c))
    )
  );

  // Mutations
  const completeMutation = useMutation({
    mutationFn: (taskId: number) => taskService.completeTask(taskId),
    onSuccess: () => {
      // Fire confetti celebration!
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
      queryClient.invalidateQueries({ queryKey: ['weeklyReview'] });
    },
  });

  const snoozeMutation = useMutation({
    mutationFn: ({
      taskId,
      options,
    }: {
      taskId: number;
      options: { snooze_minutes?: number; snooze_until?: string };
    }) => taskService.snoozeTask(taskId, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId: number) => taskService.deleteTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
      if (selectedTask) setSelectedTask(null);
    },
  });

  return (
    <div className="h-full">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full items-start">
        {/* Left / Main Column: Tasks, Filters, Briefing (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Daily Morning Briefing Widget */}
          {!isBriefingDismissed && dailyBriefing && (
            <div className="bg-linear-to-br from-indigo-50/90 via-purple-50/40 to-white border border-indigo-100/90 rounded-3xl p-5 shadow-2xs transition-all relative overflow-hidden">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-2xs shrink-0">
                    <Sun size={20} className="text-amber-200" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      Daily Intelligence Briefing
                      <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                        {dailyBriefing.today_count} due today
                      </span>
                    </h2>
                    <p className="text-2xs text-gray-500 font-medium">
                      Generated based on your scheduled commitments
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsBriefingExpanded(!isBriefingExpanded)}
                    className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                    aria-label={isBriefingExpanded ? 'Collapse briefing' : 'Expand briefing'}
                  >
                    {isBriefingExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <button
                    onClick={() => setIsBriefingDismissed(true)}
                    className="text-2xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              </div>

              {/* Briefing text */}
              <div className="mt-3.5 text-xs text-gray-800 whitespace-pre-line leading-relaxed bg-white/70 rounded-2xl p-3.5 border border-indigo-100/60 font-mono">
                {dailyBriefing.briefing_text}
              </div>

              {/* Overdue alert in briefing */}
              {dailyBriefing.overdue_count > 0 && (
                <div className="mt-2.5 flex items-center gap-2 text-xs font-semibold text-red-700 bg-red-50/80 border border-red-200/60 rounded-xl px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  <span>You have {dailyBriefing.overdue_count} overdue task(s) requiring attention.</span>
                </div>
              )}
            </div>
          )}

          {/* Filter Bar */}
          <div className="bg-white border border-gray-200/80 rounded-3xl p-4 shadow-2xs">
            <TaskFilterBar
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
              selectedPriority={selectedPriority}
              onPriorityChange={setSelectedPriority}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              categories={allCategories}
            />
          </div>

          {/* Task List */}
          <TaskList
            tasks={tasks}
            isLoading={isTasksLoading}
            onComplete={(id) => completeMutation.mutate(id)}
            onSnooze={(id, opts) => snoozeMutation.mutate({ taskId: id, options: opts })}
            onDelete={(id) => deleteMutation.mutate(id)}
            onSelectTask={(task) => setSelectedTask(task)}
            onOpenNewTaskModal={openNewTaskModal}
          />
        </div>

        {/* Right Column: Embedded Chat Assistant (5 cols on lg, sticky on laptop) */}
        <div className="hidden lg:block lg:col-span-5 h-[calc(100vh-8.5rem)] sticky top-20">
          <ChatPanel />
        </div>
      </div>

      {/* Task Details Drawer */}
      <TaskDetailDrawer
        taskId={selectedTask ? selectedTask.id : null}
        isOpen={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
};
