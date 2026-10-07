import React from 'react';
import type { Priority, TaskStatus } from '../../types';

interface BadgeProps {
  status?: TaskStatus;
  priority?: Priority;
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  priority,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = size === 'sm' ? 'text-3xs px-2 py-0.5' : 'text-2xs px-2.5 py-1';

  if (status) {
    switch (status) {
      case 'done':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${sizeClasses} ${className}`}
          >
            Done
          </span>
        );
      case 'snoozed':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 ${sizeClasses} ${className}`}
          >
            Snoozed
          </span>
        );
      case 'cancelled':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-gray-100 text-gray-600 border border-gray-200 ${sizeClasses} ${className}`}
          >
            Cancelled
          </span>
        );
      case 'pending':
      default:
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 ${sizeClasses} ${className}`}
          >
            To Do
          </span>
        );
    }
  }

  if (priority) {
    switch (priority) {
      case 'high':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-red-50 text-red-700 border border-red-200/80 ${sizeClasses} ${className}`}
          >
            High
          </span>
        );
      case 'med':
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200/80 ${sizeClasses} ${className}`}
          >
            Med
          </span>
        );
      case 'low':
      default:
        return (
          <span
            className={`inline-flex items-center font-bold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 ${sizeClasses} ${className}`}
          >
            Low
          </span>
        );
    }
  }

  return null;
};
