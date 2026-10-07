import React, { useState } from 'react';
import { ShieldOff, Key, AlertTriangle, X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import * as authService from '../../services/auth';

interface TwoFactorDisableModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  onSuccess: () => void;
}

export const TwoFactorDisableModal: React.FC<TwoFactorDisableModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [isDisabling, setIsDisabling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setErrorMsg('Please enter your 6-digit code or backup code.');
      return;
    }

    setIsDisabling(true);
    setErrorMsg(null);

    try {
      const res = await authService.disable2FA(userId, code.trim());
      if (res.success) {
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to disable 2FA. Code is invalid.');
    } finally {
      setIsDisabling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <ShieldOff size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-none">Disable Google Authenticator</h3>
              <p className="text-xs text-gray-500 mt-1">Confirm security verification</p>
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
          <p className="text-xs text-gray-600 leading-relaxed">
            Enter the 6-digit code from Google Authenticator to confirm turning off 2FA on your account.
          </p>

          <Input
            label="6-Digit Verification Code"
            type="text"
            maxLength={8}
            placeholder="e.g. 123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
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

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button type="button" variant="outline" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="md"
              isLoading={isDisabling}
              disabled={!code.trim()}
            >
              Disable 2FA
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
