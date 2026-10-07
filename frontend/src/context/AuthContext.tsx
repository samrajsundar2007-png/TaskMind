import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import * as authService from '../services/auth';

export interface LoginResult {
  requires2FA: boolean;
  userId?: number;
  userName?: string;
  pre_auth_token?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (name: string, timezone?: string) => Promise<LoginResult>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  updateUserField: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('taskmind_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const initAuth = async () => {
    setIsLoading(true);
    try {
      const storedToken = localStorage.getItem('taskmind_token');
      if (storedToken) {
        const profile = await authService.getMe();
        setUser(profile);
      } else {
        // Auto-login as default guest user for instant seamless experience
        const defaultName = 'Guest User';
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const res = await authService.loginOrGuest(defaultName, tz);
        if (res.access_token) {
          localStorage.setItem('taskmind_token', res.access_token);
          setToken(res.access_token);
        }
        if (res.user) {
          setUser(res.user);
        }
      }
    } catch (err) {
      console.error('Failed to initialize auth:', err);
      // Fallback guest login
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        const res = await authService.loginOrGuest('Guest User', tz);
        if (res.access_token) {
          localStorage.setItem('taskmind_token', res.access_token);
          setToken(res.access_token);
        }
        if (res.user) {
          setUser(res.user);
        }
      } catch (e) {
        console.error('Secondary guest fallback error:', e);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (name: string, timezone?: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const res = await authService.loginOrGuest(name, tz);

      if (res.requires_2fa && res.user) {
        return {
          requires2FA: true,
          userId: res.user.id,
          userName: res.user.name,
          pre_auth_token: res.pre_auth_token,
        };
      }

      if (res.access_token) {
        localStorage.setItem('taskmind_token', res.access_token);
        setToken(res.access_token);
      }
      if (res.user) {
        setUser(res.user);
      }
      return { requires2FA: false, userId: res.user?.id, userName: res.user?.name };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('taskmind_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const profile = await authService.getMe();
      setUser(profile);
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  };

  const updateUserField = async (data: Partial<User>) => {
    if (!user) return;
    try {
      const updated = await authService.updateUser(user.id, data);
      setUser(updated);
    } catch (err) {
      console.error('Failed to update user profile:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshUser,
        updateUserField,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

