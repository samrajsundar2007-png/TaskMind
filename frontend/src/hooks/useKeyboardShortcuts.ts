import { useEffect } from 'react';

interface ShortcutHandlers {
  onNewTask?: () => void;
  onFocusSearch?: () => void;
  onFocusChat?: () => void;
}

export const useKeyboardShortcuts = ({
  onNewTask,
  onFocusSearch,
  onFocusChat,
}: ShortcutHandlers) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing inside an input, textarea, or contentEditable element
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onNewTask?.();
      } else if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onFocusSearch?.() || onFocusChat?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNewTask, onFocusSearch, onFocusChat]);
};
