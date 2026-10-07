import { apiClient } from './api';
import type { DailyBriefing, WeeklyReview, WorkloadAnalysis } from '../types';

export async function getDailyBriefing(userId?: number): Promise<DailyBriefing> {
  const res = await apiClient.get<DailyBriefing>('/smart/daily-briefing', {
    params: userId ? { user_id: userId } : {},
  });
  return res.data;
}

export async function getWeeklyReview(userId?: number): Promise<WeeklyReview> {
  const res = await apiClient.get<WeeklyReview>('/smart/weekly-review', {
    params: userId ? { user_id: userId } : {},
  });
  return res.data;
}

export async function getWorkloadAnalysis(dateStr?: string, userId?: number): Promise<WorkloadAnalysis> {
  const res = await apiClient.get<WorkloadAnalysis>('/smart/workload', {
    params: {
      ...(dateStr ? { date_str: dateStr } : {}),
      ...(userId ? { user_id: userId } : {}),
    },
  });
  return res.data;
}
