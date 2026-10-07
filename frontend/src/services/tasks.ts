import { apiClient } from './api';
import type { Task, TaskDetail, TaskListResponse, TaskSummary, TaskStatus, Priority } from '../types';

export interface TaskQueryParams {
  user_id?: number;
  status?: TaskStatus;
  priority?: Priority;
  category?: string;
  search?: string;
  due_after?: string;
  due_before?: string;
  offset?: number;
  limit?: number;
}

export interface TaskCreatePayload {
  user_id: number;
  title: string;
  description?: string | null;
  due_at_utc?: string | null;
  priority?: Priority;
  category?: string | null;
  recurrence_rule?: string | null;
  estimated_minutes?: number | null;
  remind_at_utc?: string | null;
}

export interface TaskUpdatePayload {
  title?: string;
  description?: string | null;
  due_at_utc?: string | null;
  priority?: Priority;
  category?: string | null;
  status?: TaskStatus;
  recurrence_rule?: string | null;
  estimated_minutes?: number | null;
}

export async function getTasks(params: TaskQueryParams = {}): Promise<TaskListResponse> {
  const res = await apiClient.get<TaskListResponse>('/tasks/', { params });
  return res.data;
}

export async function getTask(taskId: number): Promise<TaskDetail> {
  const res = await apiClient.get<TaskDetail>(`/tasks/${taskId}`);
  return res.data;
}

export async function createTask(payload: TaskCreatePayload): Promise<Task> {
  const res = await apiClient.post<Task>('/tasks/', payload);
  return res.data;
}

export async function updateTask(taskId: number, payload: TaskUpdatePayload): Promise<Task> {
  const res = await apiClient.put<Task>(`/tasks/${taskId}`, payload);
  return res.data;
}

export async function completeTask(taskId: number): Promise<Task> {
  const res = await apiClient.post<Task>(`/tasks/${taskId}/complete`);
  return res.data;
}

export async function snoozeTask(
  taskId: number,
  options: { snooze_minutes?: number; snooze_until?: string }
): Promise<Task> {
  const res = await apiClient.post<Task>(`/tasks/${taskId}/snooze`, options);
  return res.data;
}

export async function deleteTask(taskId: number): Promise<{ success: boolean; id: number }> {
  const res = await apiClient.delete(`/tasks/${taskId}`);
  return res.data;
}

export async function getTaskSummary(userId?: number): Promise<TaskSummary> {
  const res = await apiClient.get<TaskSummary>('/tasks/summary', {
    params: userId ? { user_id: userId } : {},
  });
  return res.data;
}
