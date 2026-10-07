import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  CheckSquare,
  MessageSquare,
  Calendar,
  BarChart3,
  Settings,
  Plus,
  Zap,
} from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  onOpenNewTaskModal: () => void;
  pendingCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  onOpenNewTaskModal,
  pendingCount = 0,
}) => {
  const { user } = useAuth();

  const navItems = [
    { to: '/', label: 'Tasks', icon: CheckSquare, badge: pendingCount > 0 ? pendingCount : undefined },
    { to: '/chat', label: 'AI Chat', icon: MessageSquare },
    { to: '/calendar', label: 'Calendar', icon: Calendar },
    { to: '/stats', label: 'Stats & Review', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header with App Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <img
          src={logoImg}
          alt="TaskMind Logo"
          className="w-10 h-10 object-contain rounded-xl shadow-2xs border border-indigo-100 bg-white"
        />
        <div>
          <h1 className="text-base font-bold text-gray-900 tracking-tight flex items-center gap-1.5">
            TaskMind
            <span className="text-3xs font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">AI</span>
          </h1>
          <p className="text-3xs text-gray-500 font-medium">Smart Task Agent</p>
        </div>
      </div>

      {/* Quick Add Button */}
      <div className="p-4">
        <Button
          onClick={onOpenNewTaskModal}
          variant="primary"
          className="w-full justify-between shadow-sm bg-indigo-600 hover:bg-indigo-700"
          icon={<Plus size={18} />}
        >
          <span>New Task</span>
          <kbd className="text-2xs bg-indigo-700 text-indigo-100 px-1.5 py-0.5 rounded font-mono">N</kbd>
        </Button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 min-h-[44px] ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-100/80 hover:text-gray-900'
              }`
            }
          >
            <div className="flex items-center gap-3">
              <item.icon size={18} className="shrink-0" />
              <span>{item.label}</span>
            </div>
            {item.badge !== undefined && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700 shrink-0">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'TM'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">{user?.name || 'TaskMind User'}</p>
              <p className="text-2xs text-gray-500 truncate">{user?.timezone || 'UTC'}</p>
            </div>
          </div>
          <NavLink to="/settings" className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-200/50">
            <Zap size={15} />
          </NavLink>
        </div>
      </div>
    </aside>
  );
};
