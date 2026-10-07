import { apiClient } from './api';
import type {
  User,
  TwoFactorSetupResponse,
  TwoFactorEnableResponse,
  TwoFactorDisableResponse,
} from '../types';

export interface LoginResponse {
  access_token?: string;
  token_type?: string;
  requires_2fa: boolean;
  pre_auth_token?: string;
  user?: User;
}

export async function loginOrGuest(
  name: string,
  timezone?: string,
  telegram_chat_id?: string
): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/login', {
    name,
    timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    telegram_chat_id,
  });
  return res.data;
}

export async function verify2FALogin(userId: number, code: string): Promise<LoginResponse> {
  const res = await apiClient.post<LoginResponse>('/auth/2fa/verify-login', {
    user_id: userId,
    code,
  });
  return res.data;
}

export async function setup2FA(): Promise<TwoFactorSetupResponse> {
  const res = await apiClient.post<TwoFactorSetupResponse>('/auth/2fa/setup');
  return res.data;
}

export async function enable2FA(userId: number, code: string): Promise<TwoFactorEnableResponse> {
  const res = await apiClient.post<TwoFactorEnableResponse>('/auth/2fa/enable', {
    user_id: userId,
    code,
  });
  return res.data;
}

export async function disable2FA(userId: number, code: string): Promise<TwoFactorDisableResponse> {
  const res = await apiClient.post<TwoFactorDisableResponse>('/auth/2fa/disable', {
    user_id: userId,
    code,
  });
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await apiClient.get<User>('/auth/me');
  return res.data;
}

export async function updateUser(userId: number, data: Partial<User>): Promise<User> {
  const res = await apiClient.put<User>(`/users/${userId}`, data);
  return res.data;
}

export async function completeOnboarding(userId: number): Promise<User> {
  return updateUser(userId, { has_completed_onboarding: true });
}

