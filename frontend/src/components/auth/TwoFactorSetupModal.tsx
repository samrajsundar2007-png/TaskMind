import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Key,
  Copy,
  Check,
  Download,
  AlertTriangle,
  X,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import * as authService from '../../services/auth';
import type { TwoFactorSetupResponse } from '../../types';

interface TwoFactorSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  onSuccess: () => void;
}

export const TwoFactorSetupModal: React.FC<TwoFactorSetupModalProps> = ({
  isOpen,
  onClose,
  userId,
  onSuccess,
}) => {
  const [step, setStep] = useState<'scan' | 'backup'>('scan');
  const [setupData, setSetupData] = useState<TwoFactorSetupResponse | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setStep('scan');
      setVerifyCode('');
      setErrorMsg(null);
      setBackupCodes([]);
      setIsLoading(true);

      authService
        .setup2FA()
        .then((data) => {
          setSetupData(data);
        })
        .catch((err) => {
          setErrorMsg(err?.response?.data?.detail || 'Failed to initialize 2FA setup.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopySecret = () => {
    if (setupData?.secret) {
      navigator.clipboard.writeText(setupData.secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleVerifyAndEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim() || verifyCode.length < 6) {
      setErrorMsg('Please enter a 6-digit code from Google Authenticator.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await authService.enable2FA(userId, verifyCode.trim());
      if (res.success) {
        setBackupCodes(res.backup_codes);
        setStep('backup');
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || 'Invalid verification code. Please check your time sync.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleCopyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 2000);
  };

  const handleDownloadBackupCodes = () => {
    const text = `TaskMind AI - Two-Factor Authentication Emergency Backup Codes\nGenerated: ${new Date().toISOString()}\n\nKeep these single-use recovery codes in a safe place:\n\n${backupCodes
      .map((c, i) => `${i + 1}. ${c}`)
      .join('\n')}\n\nEach code can only be used once if you lose access to Google Authenticator.`;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `taskmind-2fa-backup-codes.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xl max-w-lg w-full overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 leading-none">
                {step === 'scan' ? 'Enable Google Authenticator' : 'Emergency Backup Codes'}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {step === 'scan' ? 'Two-Factor Authentication (TOTP)' : 'Keep these recovery codes safe'}
              </p>
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
        <div className="p-6">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500 font-medium">Generating secure TOTP secret key...</p>
            </div>
          ) : step === 'scan' ? (
            <div className="space-y-5">
              {/* Step 1: QR Code & Key */}
              <div className="text-xs text-gray-600 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-gray-900">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xs">
                    1
                  </span>
                  <span>Scan this QR code with Google Authenticator or Authy</span>
                </div>

                {setupData?.qr_code_base64 && (
                  <div className="flex flex-col items-center justify-center p-4 bg-white border border-gray-200 rounded-2xl shadow-2xs">
                    <img
                      src={setupData.qr_code_base64}
                      alt="Google Authenticator QR Code"
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                  </div>
                )}

                {/* Secret Key Manual Entry */}
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="truncate">
                    <div className="text-3xs font-bold text-gray-400 uppercase tracking-wider">Manual Secret Key</div>
                    <code className="text-xs font-mono font-bold text-indigo-700 select-all">
                      {setupData?.secret}
                    </code>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopySecret}
                    icon={copiedKey ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  >
                    {copiedKey ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              </div>

              {/* Step 2: Verification Input */}
              <form onSubmit={handleVerifyAndEnable} className="space-y-4 pt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 font-semibold text-gray-900 text-xs">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-2xs">
                    2
                  </span>
                  <span>Enter the 6-digit verification code from your app</span>
                </div>

                <Input
                  label="6-Digit Verification Code"
                  type="text"
                  maxLength={6}
                  placeholder="e.g. 123456"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
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

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" size="md" onClick={onClose}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isVerifying}
                    disabled={verifyCode.length < 6}
                    icon={<Sparkles size={16} />}
                  >
                    Enable 2FA Protection
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* Step 2: Backup Codes Screen */
            <div className="space-y-5">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <span>
                  <strong>2FA Enabled!</strong> Save these emergency backup recovery codes now.
                </span>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
                <p className="text-xs text-gray-600">
                  If you ever lose your phone or authenticator app, each code below can be used <strong>once</strong> to log in.
                </p>

                <div className="grid grid-cols-2 gap-2 font-mono text-xs font-bold text-gray-800 bg-white p-3 rounded-xl border border-gray-200">
                  {backupCodes.map((code, idx) => (
                    <div key={idx} className="p-1 text-center bg-gray-50 rounded border border-gray-100">
                      {code}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyBackupCodes}
                  className="flex-1"
                  icon={copiedBackup ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                >
                  {copiedBackup ? 'Copied Codes' : 'Copy All Codes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadBackupCodes}
                  className="flex-1"
                  icon={<Download size={14} />}
                >
                  Download .txt
                </Button>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end">
                <Button variant="primary" size="md" onClick={onClose}>
                  Done & Back to Settings
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
