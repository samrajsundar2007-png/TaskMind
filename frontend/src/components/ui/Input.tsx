import React, { type InputHTMLAttributes, type ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
  rightElement?: ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  rightElement,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-gray-700 select-none block"
        >
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {icon && (
          <div className="absolute left-3.5 text-gray-400 pointer-events-none flex items-center justify-center">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={`w-full bg-white text-gray-900 border rounded-xl px-3.5 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors min-h-[44px] ${
            icon ? 'pl-10' : ''
          } ${rightElement ? 'pr-10' : ''} ${
            error
              ? 'border-red-300 focus:ring-red-500 focus:border-red-500 bg-red-50/20'
              : 'border-gray-200 hover:border-gray-300'
          } ${className}`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3.5 flex items-center justify-center text-gray-400">
            {rightElement}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-red-600 font-medium mt-1">{error}</p>}
    </div>
  );
};
