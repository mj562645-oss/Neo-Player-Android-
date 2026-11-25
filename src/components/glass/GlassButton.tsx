import React from 'react';
import { cn } from '../../lib/utils';

interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'glass' | 'accent' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  className,
  variant = 'glass',
  size = 'md',
  ...props
}) => {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--neo-accent)] active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none cursor-pointer',
        variant === 'accent' &&
          'bg-[var(--neo-accent)] text-white hover:brightness-110 shadow-md neo-btn-radius',
        variant === 'glass' &&
          'liquid-glass text-[#111216] dark:text-[#F5F5F7] hover:bg-white/85 dark:hover:bg-white/12 neo-btn-radius',
        variant === 'ghost' &&
          'text-[#52525B] dark:text-[#AEAEB2] hover:bg-black/6 dark:hover:bg-white/10 hover:text-[#111216] dark:hover:text-white neo-btn-radius',
        size === 'sm' && 'min-h-[38px] px-3.5 py-1.5 text-xs',
        size === 'md' && 'min-h-[44px] px-4 py-2 text-sm',
        size === 'lg' && 'min-h-[48px] px-6 py-2.5 text-sm font-semibold',
        size === 'icon' && 'min-h-[44px] min-w-[44px] p-0 rounded-full',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};
