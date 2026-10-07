import React from 'react';
import { Mic } from 'lucide-react';
import { Button } from '../ui/Button';

interface VoiceButtonProps {
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

export const VoiceButton: React.FC<VoiceButtonProps> = ({
  onClick,
  variant = 'outline',
  size = 'md',
  className = '',
  label,
}) => {
  return (
    <Button
      onClick={onClick}
      variant={variant}
      size={size}
      className={`relative group ${className}`}
      icon={<Mic size={size === 'sm' ? 14 : size === 'lg' ? 20 : 16} className="text-indigo-600 group-hover:scale-110 transition-transform" />}
      aria-label="Speak with TaskMind"
    >
      {label && <span>{label}</span>}
    </Button>
  );
};
