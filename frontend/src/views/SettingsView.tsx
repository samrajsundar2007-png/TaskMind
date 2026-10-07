import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Globe,
  Send,
  Check,
  Copy,
  ShieldCheck,
  ShieldOff,
  Save,
  Volume2,
  Mic,
  Sparkles,
  HelpCircle,
  LogIn,
  Key,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as authService from '../services/auth';
import * as voiceService from '../services/voice';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import type { VoiceOption } from '../types';
import { TwoFactorSetupModal } from '../components/auth/TwoFactorSetupModal';
import { TwoFactorDisableModal } from '../components/auth/TwoFactorDisableModal';
import { LoginModal } from '../components/auth/LoginModal';
import { OnboardingTour } from '../components/onboarding/OnboardingTour';

export const SettingsView: React.FC = () => {
  const { user, refreshUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'UTC');
  const [selectedVoice, setSelectedVoice] = useState<string>(
    () => localStorage.getItem('taskmind_voice') || 'en-US-JennyNeural'
  );
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPlayingSample, setIsPlayingSample] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Modals state
  const [is2FASetupOpen, setIs2FASetupOpen] = useState(false);
  const [is2FADisableOpen, setIs2FADisableOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setTimezone(user.timezone || 'UTC');
    }
  }, [user]);

  useEffect(() => {
    voiceService
      .getVoices()
      .then((res) => {
        setVoices(res);
      })
      .catch((err) => {
        console.warn('Could not fetch voices list:', err);
      });
  }, []);

  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSaving(true);
    try {
      localStorage.setItem('taskmind_voice', selectedVoice);
      await authService.updateUser(user.id, {
        name: name.trim(),
        timezone,
      });
      await refreshUser();
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to update settings:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestVoice = async () => {
    setIsPlayingSample(true);
    try {
      const audioBlob = await voiceService.synthesizeSpeech(
        'Hello! I am TaskMind, your AI task agent. Your reminders will be delivered on time.',
        selectedVoice
      );
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audio.onended = () => {
        setIsPlayingSample(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setIsPlayingSample(false);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch (err) {
      console.error('Failed to play voice sample:', err);
      setIsPlayingSample(false);
    }
  };

  const telegramStartCommand = `/start`;

  const copyTelegramCommand = () => {
    navigator.clipboard.writeText(telegramStartCommand);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Account Switcher & Overview Header */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg">
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">
              {user?.name || 'Guest User'}
            </h2>
            <p className="text-2xs text-gray-500 mt-0.5 flex items-center gap-2">
              <span>Account ID: #{user?.id || 1}</span>
              <span>•</span>
              <span className={user?.is_totp_enabled ? 'text-emerald-600 font-semibold' : 'text-gray-400'}>
                {user?.is_totp_enabled ? '2FA Protected' : 'Standard Auth'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsLoginOpen(true)}
            icon={<LogIn size={14} />}
          >
            Switch Account
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsTourOpen(true)}
            className="border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/70"
            icon={<HelpCircle size={14} className="text-indigo-600" />}
          >
            Replay Tour
          </Button>
        </div>
      </div>

      {/* Profile & Scheduling */}
      <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-2xs">
        <h2 className="text-lg font-bold text-gray-900">User Settings & Preferences</h2>
        <p className="text-xs text-gray-500 mt-1">
          Manage your profile, scheduling timezone, and neural voice synthesis.
        </p>

        <form onSubmit={handleSave} className="space-y-4 mt-6">
          <Input
            label="Full Name / Display Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            icon={<UserIcon size={16} />}
            required
          />

          <div>
            <label className="text-xs font-semibold text-gray-700 select-none block mb-1.5">
              Scheduling Timezone
            </label>
            <div className="relative flex items-center">
              <div className="absolute left-3.5 text-gray-400 pointer-events-none">
                <Globe size={16} />
              </div>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-white text-gray-900 border border-gray-200 rounded-xl pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-gray-300 transition-colors min-h-[44px]"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-2xs text-gray-400 mt-1">
              All dates in chat and voice commands are interpreted relative to this timezone.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={<Save size={16} />}
              isLoading={isSaving}
            >
              Save Preferences
            </Button>
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 animate-in fade-in">
                <Check size={14} />
                <span>Saved successfully!</span>
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Security & Google Authenticator 2FA Card */}
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl ${user?.is_totp_enabled ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'} border flex items-center justify-center`}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Google Authenticator (2FA)</h3>
              <p className="text-2xs text-gray-500 font-medium">Time-based one-time passwords (TOTP) & single-use backup recovery codes</p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-2xs font-bold ${
              user?.is_totp_enabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-gray-100 text-gray-600 border border-gray-200'
            }`}
          >
            {user?.is_totp_enabled ? '2FA Enabled' : '2FA Disabled'}
          </span>
        </div>

        <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 text-xs text-gray-700 space-y-3">
          <p className="leading-relaxed text-gray-600">
            Protect your tasks and schedule with Google Authenticator or Authy. When enabled, signing in requires a 6-digit verification code from your authenticator app or an emergency recovery code.
          </p>

          <div className="pt-1 flex items-center gap-3">
            {user?.is_totp_enabled ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIs2FADisableOpen(true)}
                className="border-red-200 text-red-700 bg-red-50/50 hover:bg-red-100"
                icon={<ShieldOff size={14} />}
              >
                Disable 2FA Protection
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setIs2FASetupOpen(true)}
                icon={<Key size={14} />}
              >
                Setup Google Authenticator
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Voice & Speech Synthesis Card */}
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
              <Mic size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Neural Voice Assistant</h3>
              <p className="text-2xs text-gray-500 font-medium">Configure Edge TTS voice for spoken replies and audio briefings</p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-2xs font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
            <Sparkles size={12} />
            <span>Edge Neural</span>
          </span>
        </div>

        <div className="space-y-3 pt-2">
          <div>
            <label className="text-xs font-semibold text-gray-700 select-none block mb-1.5">
              Selected Assistant Voice
            </label>
            <div className="flex items-center gap-3">
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="flex-1 bg-white text-gray-900 border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-gray-300 transition-colors min-h-[44px]"
              >
                {voices.length > 0 ? (
                  voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.gender})
                    </option>
                  ))
                ) : (
                  <>
                    <option value="en-US-JennyNeural">Jenny (US English, Female)</option>
                    <option value="en-US-GuyNeural">Guy (US English, Male)</option>
                    <option value="en-US-AriaNeural">Aria (US English, Female)</option>
                    <option value="en-GB-SoniaNeural">Sonia (UK English, Female)</option>
                    <option value="en-IN-NeerjaNeural">Neerja (Indian English, Female)</option>
                  </>
                )}
              </select>

              <Button
                type="button"
                onClick={handleTestVoice}
                variant="outline"
                size="md"
                className="border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-100"
                icon={<Volume2 size={16} />}
                isLoading={isPlayingSample}
              >
                Test Voice
              </Button>
            </div>
            <p className="text-2xs text-gray-400 mt-1">
              Used when chatting via voice and listening to daily reminders.
            </p>
          </div>
        </div>
      </Card>

      {/* Telegram Bot Notification Channel Card */}
      <Card className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Send size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Telegram Bot Reminders</h3>
              <p className="text-2xs text-gray-500 font-medium">Receive interactive inline notifications on your phone</p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-2xs font-bold ${
              user?.telegram_chat_id
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {user?.telegram_chat_id ? 'Connected' : 'Not Linked'}
          </span>
        </div>

        <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 text-xs text-gray-700 space-y-2.5">
          <p className="font-semibold text-gray-900">How to connect your Telegram account:</p>
          <ol className="list-decimal pl-4 space-y-1.5 text-gray-600">
            <li>Open Telegram and search for your configured TaskMind bot.</li>
            <li>Send the command <code className="bg-white border px-1.5 py-0.5 rounded font-mono font-bold text-indigo-700">/start</code> to the bot.</li>
            <li>Your account will be instantly linked to receive reminders with <span className="font-semibold text-gray-800">Done</span>, <span className="font-semibold text-gray-800">Snooze 1h</span>, and <span className="font-semibold text-gray-800">Tomorrow</span> buttons.</li>
          </ol>

          <div className="pt-2 flex items-center gap-2">
            <Button
              onClick={copyTelegramCommand}
              variant="outline"
              size="sm"
              icon={isCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            >
              {isCopied ? 'Copied /start' : 'Copy /start Command'}
            </Button>
          </div>
        </div>
      </Card>

      {/* Modals */}
      {user && (
        <>
          <TwoFactorSetupModal
            isOpen={is2FASetupOpen}
            onClose={() => setIs2FASetupOpen(false)}
            userId={user.id}
            onSuccess={async () => {
              await refreshUser();
            }}
          />

          <TwoFactorDisableModal
            isOpen={is2FADisableOpen}
            onClose={() => setIs2FADisableOpen(false)}
            userId={user.id}
            onSuccess={async () => {
              await refreshUser();
            }}
          />
        </>
      )}

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />

      <OnboardingTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        userId={user?.id}
      />
    </div>
  );
};
