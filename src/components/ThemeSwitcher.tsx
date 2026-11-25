import React from 'react';
import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from '../app/ThemeContext';
import { cn } from '../lib/utils';
import type { ThemePreference } from '../types/music';

const OPTIONS: { id: ThemePreference; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Laptop },
];

export const ThemeSwitcher: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { settings, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Theme preference"
      className="inline-flex items-center p-1 rounded-2xl bg-black/[0.05] dark:bg-white/[0.08] border border-black/6 dark:border-white/10"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = settings.theme === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => void setTheme(opt.id)}
            className={cn(
              'flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer',
              compact ? 'min-h-[36px] px-2.5 text-xs' : 'min-h-[38px] px-3.5 text-xs',
              active
                ? 'bg-white dark:bg-[#2C2D36] text-[#111216] dark:text-white shadow-sm'
                : 'text-[#6E6E73] dark:text-[#98989D] hover:text-[#111216] dark:hover:text-white'
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
