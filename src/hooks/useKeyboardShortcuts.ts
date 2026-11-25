import { useEffect, useRef } from 'react';

interface ShortcutHandlers {
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeekForward: () => void;
  onSeekBackward: () => void;
  onToggleMute: () => void;
  onFocusSearch?: () => void;
  onCloseOverlay?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const current = handlersRef.current;
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'Escape') {
        current.onCloseOverlay?.();
        return;
      }

      if (isEditing) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        current.onFocusSearch?.();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        current.onTogglePlay();
      } else if (e.key === 'ArrowRight' && (e.metaKey || e.ctrlKey || e.shiftKey)) {
        e.preventDefault();
        current.onNext();
      } else if (e.key === 'ArrowLeft' && (e.metaKey || e.ctrlKey || e.shiftKey)) {
        e.preventDefault();
        current.onPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        current.onSeekForward();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        current.onSeekBackward();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        current.onToggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
