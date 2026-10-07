import React from 'react';
import type { TaskStatus, Priority } from '../../types';

interface TaskFilterBarProps {
  selectedStatus: TaskStatus | 'all';
  onStatusChange: (status: TaskStatus | 'all') => void;
  selectedPriority: Priority | 'all';
  onPriorityChange: (priority: Priority | 'all') => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  categories: string[];
}

export const TaskFilterBar: React.FC<TaskFilterBarProps> = ({
  selectedStatus,
  onStatusChange,
  selectedPriority,
  onPriorityChange,
  selectedCategory,
  onCategoryChange,
  categories,
}) => {
  const statusTabs: { id: TaskStatus | 'all'; label: string }[] = [
    { id: 'pending', label: 'To Do' },
    { id: 'all', label: 'All' },
    { id: 'snoozed', label: 'Snoozed' },
    { id: 'done', label: 'Completed' },
  ];

  const priorities: { id: Priority | 'all'; label: string }[] = [
    { id: 'all', label: 'All Priorities' },
    { id: 'high', label: '🔴 High Priority' },
    { id: 'med', label: '🟡 Medium' },
    { id: 'low', label: '🟢 Low' },
  ];

  return (
    <div className="space-y-3 select-none">
      {/* Status Tabs + Priority Dropdown */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200/80">
          {statusTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onStatusChange(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 min-h-[36px] cursor-pointer ${
                selectedStatus === tab.id
                  ? 'bg-white text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Priority Filter Select */}
        <div className="relative">
          <select
            value={selectedPriority}
            onChange={(e) => onPriorityChange(e.target.value as Priority | 'all')}
            className="bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded-xl px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 hover:border-gray-300 transition-colors min-h-[40px] cursor-pointer"
          >
            {priorities.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => onCategoryChange('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 cursor-pointer ${
                selectedCategory.toLowerCase() === cat.toLowerCase()
                  ? 'bg-indigo-600 text-white font-semibold shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
