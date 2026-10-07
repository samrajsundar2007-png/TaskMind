import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileTabs } from './MobileTabs';
import { TaskCreateModal } from '../tasks/TaskCreateModal';
import { VoiceModal } from '../voice/VoiceModal';
import { OnboardingTour } from '../onboarding/OnboardingTour';
import { LoginModal } from '../auth/LoginModal';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { useAuth } from '../../context/AuthContext';
import * as taskService from '../../services/tasks';
import * as smartService from '../../services/smart';

export interface LayoutContextType {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  openNewTaskModal: () => void;
  openVoiceModal: () => void;
  openTour: () => void;
  openLoginModal: () => void;
}

export const AppLayout: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Auto-launch tour for first-time users
  useEffect(() => {
    if (user && user.has_completed_onboarding === false) {
      const tourShownLocally = localStorage.getItem('taskmind_tour_completed');
      if (!tourShownLocally) {
        setIsTourOpen(true);
      }
    }
  }, [user]);


  const { isInstallable, promptInstall } = usePWAInstall();

  // Queries for header/sidebar badges & status
  const { data: summary } = useQuery({
    queryKey: ['taskSummary', user?.id],
    queryFn: () => taskService.getTaskSummary(user?.id),
    refetchInterval: 30000,
  });

  const { data: workload } = useQuery({
    queryKey: ['workload', user?.id],
    queryFn: () => smartService.getWorkloadAnalysis(undefined, user?.id),
    refetchInterval: 60000,
  });

  // Global Keyboard Shortcuts (N = new task, / = focus search)
  useKeyboardShortcuts({
    onNewTask: () => setIsNewTaskModalOpen(true),
    onFocusSearch: () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    },
  });

  // Determine Page Title
  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':
      case '/tasks':
        return 'Tasks & Assistant';
      case '/chat':
        return 'AI Chat Assistant';
      case '/calendar':
        return 'Calendar Schedule';
      case '/stats':
        return 'Productivity & Analytics';
      case '/settings':
        return 'Settings & Preferences';
      default:
        return 'TaskMind';
    }
  };

  const isOverloaded = workload?.is_overloaded ?? false;
  const overloadHours = workload?.total_estimated_hours ?? 0;
  const pendingCount = summary?.pending ?? 0;

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden antialiased">
      {/* Laptop / Desktop Sticky Sidebar */}
      <Sidebar
        onOpenNewTaskModal={() => setIsNewTaskModalOpen(true)}
        pendingCount={pendingCount}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden bg-gray-50/40">
        <Header
          title={getPageTitle()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchInputRef={searchInputRef}
          isOverloaded={isOverloaded}
          overloadHours={overloadHours}
          canInstallPWA={isInstallable}
          onInstallPWA={promptInstall}
          onOpenNewTaskModal={() => setIsNewTaskModalOpen(true)}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          onOpenTour={() => setIsTourOpen(true)}
          onOpenLoginModal={() => setIsLoginModalOpen(true)}
        />

        {/* Scrollable View Container */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet
              context={{
                searchQuery,
                setSearchQuery,
                openNewTaskModal: () => setIsNewTaskModalOpen(true),
                openVoiceModal: () => setIsVoiceModalOpen(true),
                openTour: () => setIsTourOpen(true),
                openLoginModal: () => setIsLoginModalOpen(true),
              }}
            />
          </div>
        </main>

        {/* Mobile Bottom Navigation & Action FAB */}
        <MobileTabs
          onOpenNewTaskModal={() => setIsNewTaskModalOpen(true)}
          onOpenVoiceModal={() => setIsVoiceModalOpen(true)}
          pendingCount={pendingCount}
        />
      </div>

      {/* Quick Add Task Modal */}
      <TaskCreateModal
        isOpen={isNewTaskModalOpen}
        onClose={() => setIsNewTaskModalOpen(false)}
      />

      {/* Interactive Voice Assistant Modal */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />

      {/* Feature Onboarding Walkthrough Tour */}
      <OnboardingTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        userId={user?.id}
      />

      {/* Account Login / Switch Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </div>
  );
};

