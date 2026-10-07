export type Priority = 'low' | 'med' | 'high';
export type TaskStatus = 'pending' | 'done' | 'snoozed' | 'cancelled';

export interface User {
  id: number;
  name: string;
  telegram_chat_id: string | null;
  timezone: string;
  is_totp_enabled?: boolean;
  has_completed_onboarding?: boolean;
  created_at: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  otpauth_uri: string;
  qr_code_base64: string;
}

export interface TwoFactorEnableResponse {
  success: boolean;
  message: string;
  backup_codes: string[];
}

export interface TwoFactorDisableResponse {
  success: boolean;
  message: string;
}


export interface Reminder {
  id: number;
  task_id: number;
  remind_at_utc: string;
  channel: string;
  sent: boolean;
  attempt_no: number;
}

export interface TaskEvent {
  id: number;
  task_id: number;
  event: string;
  meta_json: Record<string, any> | null;
  created_at: string;
}

export interface Task {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  due_at_utc: string | null;
  priority: Priority;
  category: string | null;
  status: TaskStatus;
  recurrence_rule: string | null;
  estimated_minutes: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface TaskDetail extends Task {
  reminders: Reminder[];
  events: TaskEvent[];
}

export interface TaskListResponse {
  total: number;
  items: Task[];
  limit: number;
  offset: number;
}

export interface TaskSummary {
  total: number;
  pending: number;
  done: number;
  snoozed: number;
  cancelled: number;
  high_priority: number;
  overdue: number;
  due_today: number;
}

export interface ChatToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: {
    success: boolean;
    message: string;
    data?: any;
    requires_confirmation?: boolean;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  tool_calls?: ChatToolCall[];
  requires_confirmation?: boolean;
}

export interface DailyBriefing {
  user_name: string;
  date: string;
  formatted_date: string;
  overdue_count: number;
  today_count: number;
  workload: {
    date: string;
    total_estimated_minutes: number;
    total_estimated_hours: number;
    total_tasks: number;
    high_priority_tasks: number;
    is_overloaded: boolean;
    warning_message: string | null;
    suggested_actions: string[];
  };
  briefing_text: string;
}

export interface WeeklyReview {
  total_completed: number;
  on_time_rate: number;
  snooze_count: number;
  pending_rollover: number;
  categories: Record<string, number>;
  review_text: string;
}

export interface WorkloadAnalysis {
  date: string;
  total_estimated_minutes: number;
  total_estimated_hours: number;
  total_tasks: number;
  high_priority_tasks: number;
  is_overloaded: boolean;
  warning_message: string | null;
  suggested_actions: string[];
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  locale: string;
}

export interface VoiceChatResponse {
  transcript: string;
  reply: string;
  spoken_text: string;
  audio_base64: string;
  tool_calls: ChatToolCall[];
  requires_confirmation: boolean;
  session_id: string;
}
