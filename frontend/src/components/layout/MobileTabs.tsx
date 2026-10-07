import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  MessageSquare,
  CheckSquare,
  Calendar,
  BarChart3,
  Plus,
  Mic,
} from 'lucide-react';

interface MobileTabsProps {
  onOpenNewTaskModal: () => void;
  onOpenVoiceModal?: () => void;
  pendingCount?: number;
}

export const MobileTabs: React.FC<MobileTabsProps> = ({
  onOpenNewTaskModal,
  onOpenVoiceModal,
  pendingCount = 0,
}) => {
  const tabs = [
    { to: '/chat', label: 'Chat', icon: MessageSquare },
    { to: '/', label: 'Tasks', icon: CheckSquare, badge: pendingCount > 0 ? pendingCount : undefined },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
    { to: '/stats', label: 'Stats', icon: BarChart3 },
  ];

  return (
    <>
      {/* Floating Action Buttons for Mobile (Voice & Add) */}
      <div className="lg:hidden fixed right-4 bottom-20 z-40 flex flex-col gap-2.5">
        {onOpenVoiceModal && (
          <button
            onClick={onOpenVoiceModal}
            className="w-12 h-12 rounded-full bg-white text-indigo-600 border border-indigo-200 shadow-md flex items-center justify-center hover:bg-indigo-50 active:scale-95 transition-all min-h-[44px] min-w-[44px] cursor-pointer"
            aria-label="Voice conversation"
          >
            <Mic size={20} />
          </button>
        )}
        <button
          onClick={onOpenNewTaskModal}
          className="w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-300 flex items-center justify-center hover:bg-indigo-700 active:scale-95 transition-all min-h-[44px] min-w-[44px] cursor-pointer"
          aria-label="Add new task"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-gray-200 px-2 py-1.5 flex items-center justify-around shadow-sm select-none safe-area-pb">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-150 min-h-[48px] min-w-[64px] relative ${
                isActive
                  ? 'text-indigo-600 font-semibold'
                  : 'text-gray-500 hover:text-gray-900 font-medium'
              }`
            }
          >
            <div className="relative">
              <tab.icon size={20} />
              {tab.badge !== undefined && (
                <span className="absolute -top-1.5 -right-2 text-3xs font-bold px-1.5 py-0.2 rounded-full bg-indigo-600 text-white">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className="text-2xs mt-1">{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
};
