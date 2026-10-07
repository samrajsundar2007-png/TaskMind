import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy,
  Target,
  Flame,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import type { TaskSummary, WeeklyReview } from '../../types';
import * as taskService from '../../services/tasks';
import * as smartService from '../../services/smart';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';

export const StatsView: React.FC = () => {
  const { user } = useAuth();

  const { data: summary } = useQuery<TaskSummary>({
    queryKey: ['taskSummary', user?.id],
    queryFn: () => taskService.getTaskSummary(user?.id),
  });

  const { data: weeklyReview, isLoading: isReviewLoading } = useQuery<WeeklyReview>({
    queryKey: ['weeklyReview', user?.id],
    queryFn: () => smartService.getWeeklyReview(user?.id),
  });

  const onTimeRate = weeklyReview?.on_time_rate ?? 100;
  const totalCompleted = summary?.done ?? 0;
  const totalPending = summary?.pending ?? 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak */}
        <Card className="flex items-center gap-3.5 bg-linear-to-br from-amber-50/50 to-white border-amber-200/60">
          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-200 shrink-0">
            <Flame size={24} />
          </div>
          <div>
            <p className="text-2xs font-bold text-amber-700 uppercase tracking-wider">Productivity Streak</p>
            <h3 className="text-xl font-extrabold text-gray-900 mt-0.5">5 Days</h3>
          </div>
        </Card>

        {/* On-Time Rate */}
        <Card className="flex items-center gap-3.5 bg-linear-to-br from-indigo-50/50 to-white border-indigo-200/60">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-sm shadow-indigo-200 shrink-0">
            <Target size={24} />
          </div>
          <div>
            <p className="text-2xs font-bold text-indigo-700 uppercase tracking-wider">On-Time Rate</p>
            <h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{onTimeRate}%</h3>
          </div>
        </Card>

        {/* Completed */}
        <Card className="flex items-center gap-3.5 bg-linear-to-br from-emerald-50/50 to-white border-emerald-200/60">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shadow-emerald-200 shrink-0">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-2xs font-bold text-emerald-700 uppercase tracking-wider">Completed</p>
            <h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{totalCompleted} Tasks</h3>
          </div>
        </Card>

        {/* In Backlog */}
        <Card className="flex items-center gap-3.5 bg-linear-to-br from-gray-50 to-white border-gray-200">
          <div className="w-12 h-12 rounded-2xl bg-gray-800 text-white flex items-center justify-center shadow-sm shrink-0">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-2xs font-bold text-gray-600 uppercase tracking-wider">Pending</p>
            <h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{totalPending} Tasks</h3>
          </div>
        </Card>
      </div>

      {/* Main Breakdown & Weekly Review */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Productivity Review Card */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-3 border-b border-gray-100 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Trophy size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">Weekly Intelligence Review</h3>
              <p className="text-2xs text-gray-500 font-medium">7-Day Performance & AI Insights</p>
            </div>
          </div>

          {isReviewLoading ? (
            <div className="h-32 bg-gray-100/60 rounded-2xl animate-pulse" />
          ) : weeklyReview ? (
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 text-xs sm:text-sm text-gray-800 whitespace-pre-line leading-relaxed font-mono">
                {weeklyReview.review_text}
              </div>

              {/* Progress bars for Categories */}
              {weeklyReview.categories && Object.keys(weeklyReview.categories).length > 0 && (
                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Task Distribution by Category
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(weeklyReview.categories).map(([cat, count]) => {
                      const pct = Math.min(100, Math.round((count / Math.max(1, weeklyReview.total_completed)) * 100));
                      return (
                        <div key={cat} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                            <span>{cat}</span>
                            <span>{count} ({pct}%)</span>
                          </div>
                          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Focus Meter / Tip Widget */}
        <div className="space-y-6">
          <div className="bg-linear-to-br from-indigo-900 to-indigo-950 text-white rounded-3xl p-6 shadow-md flex flex-col justify-between">
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles size={16} />
              <span>AI Execution Rule</span>
            </div>
            <p className="text-sm font-medium text-indigo-100 my-4 leading-relaxed">
              "TaskMind never relies on LLM hallucination for timing. All your reminders are executed with deterministic precision via APScheduler."
            </p>
            <div className="text-3xs text-indigo-300 font-mono">
              Status: 100% Deterministic Engine
            </div>
          </div>

          <Card className="space-y-3">
            <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp size={16} className="text-indigo-600" />
              <span>Execution Summary</span>
            </h4>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>Overdue items</span>
                <span className="font-bold text-red-600">{summary?.overdue ?? 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>Due Today</span>
                <span className="font-bold text-gray-900">{summary?.due_today ?? 0}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span>High Priority Active</span>
                <span className="font-bold text-amber-700">{summary?.high_priority ?? 0}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Snoozed items</span>
                <span className="font-bold text-purple-700">{summary?.snoozed ?? 0}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
