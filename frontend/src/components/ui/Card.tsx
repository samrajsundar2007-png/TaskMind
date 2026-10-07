import React, { type HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverEffect = false,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-gray-200/80 p-5 shadow-2xs ${
        hoverEffect
          ? 'hover:border-gray-300 hover:shadow-xs transition-all duration-150'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
