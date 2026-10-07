import React, { useState } from 'react';
import { User as UserIcon, LogIn, Sparkles, X, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { useAuth } from '../../context/AuthContext';
import { TwoFactorVerifyModal } from './TwoFactorVerifyModal';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login, refreshUser } = useAuth();
  const [userName, setUserName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 2FA Challenge state
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<{
    isOpen: boolean;
    userId: number;
    userName: string;
  }>({
    isOpen: false,
    userId: 0,
    userName: '',
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userName.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const result = await login(userName.trim());
      if (result.requires2FA && result.userId) {
        setTwoFactorChallenge({
          isOpen: true,
          userId: result.userId,
          userName: result.userName || userName.trim(),
        });
      } else {
        await refreshUser();
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Failed to sign in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASuccess = async () => {
    setTwoFactorChallenge((prev) => ({ ...prev, isOpen: false }));
    await refreshUser();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs animate-in fade-in">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95">
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                <LogIn size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 leading-none">Sign In / Switch Account</h3>
                <p className="text-xs text-gray-500 mt-1">Access your personalized AI tasks & reminders</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <Input
              label="Username or Name"
              type="text"
              placeholder="e.g. Alice, John, or Guest"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              icon={<UserIcon size={16} />}
              required
              autoFocus
            />

            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <ShieldAlert size={16} className="shrink-0 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <p className="text-2xs text-gray-400 leading-relaxed">
              If this account has Google Authenticator 2FA enabled, you will be prompted for your 6-digit TOTP security code on the next screen.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <Button type="button" variant="outline" size="md" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                disabled={!userName.trim()}
                icon={<Sparkles size={16} />}
              >
                Sign In
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* 2FA Challenge Modal */}
      <TwoFactorVerifyModal
        isOpen={twoFactorChallenge.isOpen}
        onClose={() => setTwoFactorChallenge((prev) => ({ ...prev, isOpen: false }))}
        userId={twoFactorChallenge.userId}
        userName={twoFactorChallenge.userName}
        onSuccess={handle2FASuccess}
      />
    </>
  );
};
