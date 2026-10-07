import React, { useState } from 'react';
import { ShieldCheck, Key, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import * as authService from '../../services/auth';

interface TwoFactorVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  userName: string;
  onSuccess: (token: string, user: any) => void;
}

export const TwoFactorVerifyModal: React.FC<TwoFactorVerifyModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Please enter your 6-digit authenticator code or recovery code.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await authService.verify2FALogin(userId, code.trim());
      if (res.access_token && res.user) {
        localStorage.setItem('taskmind_token', res.access_token);
        onSuccess(res.access_token, res.user);
        onClose();
      } else {
        setErrorMsg('Authentication failed. Please check your code.');
      }
    } catch (err: any) {
      setErrorMsg(
        err?.response?.data?.detail || 'Invalid code or backup recovery code. Please try again.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-none">Two-Factor Authentication</h3>
              <p className="text-xs text-gray-500 mt-1">Logging in as <span className="font-semibold text-gray-800">{userName}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-gray-600">
            {useBackupCode
              ? 'Enter one of your 8-character single-use emergency backup recovery codes.'
              : 'Open Google Authenticator or your 2FA app to view your 6-digit security code.'}
          </p>

          <Input
            label={useBackupCode ? 'Emergency Backup Recovery Code' : '6-Digit Security Code'}
            type="text"
            maxLength={useBackupCode ? 12 : 6}
            placeholder={useBackupCode ? 'e.g. A1B2C3D4' : 'e.g. 123456'}
            value={code}
            onChange={(e) => setCode(useBackupCode ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
            icon={<Key size={16} />}
            required
            autoFocus
          />

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0 text-red-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setUseBackupCode(!useBackupCode);
                setCode('');
                setErrorMsg(null);
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
            >
              {useBackupCode ? 'Use 6-digit Authenticator code' : 'Use emergency backup code'}
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isVerifying}
              disabled={!code.trim()}
              icon={<ArrowRight size={16} />}
            >
              Verify & Sign In
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
