import React from 'react';
import { cn } from '../../lib/utils';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  subtle?: boolean;
  interactive?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  elevated = false,
  subtle = false,
  interactive = false,
  ...props
}) => {
  return (
    <div
      className={cn(
        'neo-card-radius transition-all duration-200',
        elevated
          ? 'liquid-glass-elevated'
          : subtle
            ? 'liquid-glass-subtle'
            : 'liquid-glass',
        interactive &&
          'hover:-translate-y-0.5 hover:bg-white/80 dark:hover:bg-white/10 active:scale-[0.99] cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
