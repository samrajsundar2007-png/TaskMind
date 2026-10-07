import { apiClient } from './api';
import type { ChatToolCall } from '../types';

export interface ChatRequestPayload {
  message: string;
  session_id?: string;
  user_id?: number;
}

export interface ChatResponsePayload {
  reply: string;
  tool_calls: ChatToolCall[];
  requires_confirmation: boolean;
  session_id: string;
}

export async function sendChatMessage(payload: ChatRequestPayload): Promise<ChatResponsePayload> {
  const res = await apiClient.post<ChatResponsePayload>('/chat/', payload);
  return res.data;
}
