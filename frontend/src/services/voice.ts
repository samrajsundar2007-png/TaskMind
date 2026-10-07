import { apiClient } from './api';
import type { VoiceChatResponse, VoiceOption } from '../types';

export async function transcribeAudio(audioBlob: Blob): Promise<{ transcript: string }> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');

  const res = await apiClient.post<{ transcript: string }>('/voice/transcribe', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function synthesizeSpeech(
  text: string,
  voice?: string,
  rate?: string
): Promise<Blob> {
  const res = await apiClient.post(
    '/voice/synthesize',
    { text, voice, rate: rate || '+0%' },
    { responseType: 'blob' }
  );
  return res.data;
}

export async function sendVoiceChat(
  audioBlob: Blob,
  userId?: number,
  sessionId?: string,
  voice?: string
): Promise<VoiceChatResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'voice_command.webm');
  if (userId) formData.append('user_id', String(userId));
  if (sessionId) formData.append('session_id', sessionId);
  if (voice) formData.append('voice', voice);

  const res = await apiClient.post<VoiceChatResponse>('/voice/chat', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function getVoices(): Promise<VoiceOption[]> {
  const res = await apiClient.get<VoiceOption[]>('/voice/voices');
  return res.data;
}
