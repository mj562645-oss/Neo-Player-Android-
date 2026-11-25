import React from 'react';
import { cn } from '../../lib/utils';

interface GlassPlayerProps {
  children: React.ReactNode;
  className?: string;
}

export const GlassPlayer: React.FC<GlassPlayerProps> = ({ children, className }) => {
  return (
    <div
      className={cn(
        'liquid-glass-elevated rounded-3xl overflow-hidden',
        className
      )}
    >
      {children}
    </div>
  );
};
