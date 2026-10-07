import React from 'react';
import { Search, Download, AlertTriangle, Plus, Mic, HelpCircle, LogIn } from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  title?: string;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  isOverloaded?: boolean;
  overloadHours?: number;
  canInstallPWA?: boolean;
  onInstallPWA?: () => void;
  onOpenNewTaskModal?: () => void;
  onOpenVoiceModal?: () => void;
  onOpenTour?: () => void;
  onOpenLoginModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title = 'TaskMind',
  searchQuery = '',
  onSearchChange,
  searchInputRef,
  isOverloaded = false,
  overloadHours = 0,
  canInstallPWA = false,
  onInstallPWA,
  onOpenNewTaskModal,
  onOpenVoiceModal,
  onOpenTour,
  onOpenLoginModal,
}) => {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      {/* Brand / Title / Search */}
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        {/* Mobile Brand Logo */}
        <div className="flex items-center gap-2 lg:hidden shrink-0">
          <img
            src={logoImg}
            alt="TaskMind Logo"
            className="w-8 h-8 object-contain rounded-lg border border-indigo-100 bg-white"
          />
        </div>

        <h1 className="text-lg font-bold text-gray-900 truncate hidden sm:block">
          {title}
        </h1>

        {onSearchChange && (
          <div className="relative max-w-md w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search tasks... (Press '/' to focus)"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-gray-50/80 hover:bg-gray-100/70 focus:bg-white text-gray-900 border border-gray-200 rounded-xl pl-9.5 pr-8 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors min-h-[40px]"
            />
            <kbd className="hidden md:inline-block absolute right-3 top-1/2 -translate-y-1/2 text-3xs font-mono bg-white border border-gray-200 text-gray-400 px-1.5 py-0.5 rounded shadow-2xs">
              /
            </kbd>
          </div>
        )}
      </div>

      {/* Action Chips & Buttons */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Feature Tour Trigger Button */}
        {onOpenTour && (
          <Button
            onClick={onOpenTour}
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex border-gray-200 text-gray-700 bg-gray-50/50 hover:bg-gray-100/70"
            icon={<HelpCircle size={14} className="text-indigo-600" />}
            title="Feature Tour Walkthrough"
          >
            <span className="hidden md:inline">Tour</span>
          </Button>
        )}

        {/* Voice Trigger Button */}
        {onOpenVoiceModal && (
          <Button
            onClick={onOpenVoiceModal}
            variant="outline"
            size="sm"
            className="border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60 shadow-2xs"
            icon={<Mic size={15} className="text-indigo-600" />}
          >
            <span className="hidden sm:inline">Voice AI</span>
          </Button>
        )}

        {/* Account Switcher Button */}
        {onOpenLoginModal && (
          <Button
            onClick={onOpenLoginModal}
            variant="outline"
            size="sm"
            className="border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-1.5"
            title="Sign in or switch account"
          >
            <LogIn size={14} className="text-gray-500" />
            <span className="hidden md:inline text-xs font-semibold text-gray-800 truncate max-w-[100px]">
              {user?.name || 'Guest'}
            </span>
          </Button>
        )}

        {/* Overload Alert Chip */}
        {isOverloaded && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium animate-pulse">
            <AlertTriangle size={14} className="text-amber-600" />
            <span>Heavy Workload ({overloadHours}h)</span>
          </div>
        )}

        {/* PWA Install Button */}
        {canInstallPWA && onInstallPWA && (
          <Button
            onClick={onInstallPWA}
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100/60"
            icon={<Download size={14} />}
          >
            Install App
          </Button>
        )}

        {/* Mobile New Task trigger */}
        {onOpenNewTaskModal && (
          <Button
            onClick={onOpenNewTaskModal}
            variant="primary"
            size="sm"
            className="lg:hidden shadow-xs"
            icon={<Plus size={16} />}
          >
            Add
          </Button>
        )}
      </div>
    </header>
  );
};
