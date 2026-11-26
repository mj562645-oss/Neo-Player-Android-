import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface NavDestination<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

interface GlassNavigationProps<T extends string> {
  items: NavDestination<T>[];
  activeId: T;
  onSelect: (id: T) => void;
  headerSlot?: React.ReactNode;
  footerSlot?: React.ReactNode;
  mobileBottomSlot?: React.ReactNode;
}

export function GlassNavigation<T extends string>({
  items,
  activeId,
  onSelect,
  headerSlot,
  footerSlot,
}: GlassNavigationProps<T>) {
  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 p-4 pr-0">
        <div className="liquid-glass neo-card-radius flex flex-col h-full p-4">
          {headerSlot && <div className="mb-6 px-2">{headerSlot}</div>}

          <nav aria-label="Primary navigation" className="flex-1 flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={cn(
                    'neo-nav-item flex items-center gap-3 px-3.5 min-h-[44px] neo-btn-radius text-sm font-medium transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer text-left',
                    active
                      ? 'neo-nav-item-active bg-[var(--neo-accent-soft)] text-[var(--neo-accent)]'
                      : 'text-[#48484A] dark:text-[#AEAEB2] hover:bg-black/5 dark:hover:bg-white/7 hover:text-[#111216] dark:hover:text-white'
                  )}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={active ? 2.3 : 1.9} />
                  <span className="flex-1">{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="text-[11px] font-mono-tabular font-semibold px-1.5 py-0.5 rounded-md bg-[var(--neo-accent)] text-white">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          {footerSlot && <div className="mt-4 pt-4 border-t border-black/8 dark:border-white/10">{footerSlot}</div>}
        </div>
      </aside>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 liquid-glass-elevated border-x-0 border-b-0 rounded-t-[var(--neo-radius-card)] pb-safe"
      >
        <div className="grid grid-cols-5 items-center h-[60px] px-2">
          {items.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  'relative flex flex-col items-center justify-center min-h-[44px] rounded-2xl transition-colors cursor-pointer',
                  active
                    ? 'text-[var(--neo-accent)]'
                    : 'text-[#6E6E73] dark:text-[#98989D]'
                )}
              >
                <div className={cn('relative flex items-center justify-center transition-all', active && 'neo-mobile-nav-pill')}>
                  <Icon className="w-[21px] h-[21px]" strokeWidth={active ? 2.3 : 1.8} />
                  {item.badge && item.badge > 0 ? (
                    <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-[var(--neo-accent)] text-white text-[9px] font-mono-tabular font-bold flex items-center justify-center">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
