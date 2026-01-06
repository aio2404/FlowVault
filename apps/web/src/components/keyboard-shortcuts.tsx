'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Keyboard } from 'lucide-react';

const shortcuts = [
  { key: 'g + d', description: 'Go to Dashboard', path: '/app' },
  { key: 'g + m', description: 'Go to Monitoring', path: '/app/monitoring' },
  { key: 'g + i', description: 'Go to Instances', path: '/app/instances' },
  { key: 'g + w', description: 'Go to Workflows', path: '/app/workflows' },
  { key: 'g + s', description: 'Go to Settings', path: '/app/settings' },
  { key: '?', description: 'Show shortcuts help', action: 'help' },
  { key: 'Esc', description: 'Close dialogs', action: 'escape' },
];

export function KeyboardShortcuts() {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Handle escape
      if (key === 'escape') {
        setShowHelp(false);
        setPendingKey(null);
        return;
      }

      // Handle ? for help
      if (key === '?' || (e.shiftKey && key === '/')) {
        e.preventDefault();
        setShowHelp((prev) => !prev);
        return;
      }

      // Handle 'g' prefix for navigation
      if (key === 'g' && !pendingKey) {
        setPendingKey('g');
        // Clear pending key after 1 second
        timeout = setTimeout(() => setPendingKey(null), 1000);
        return;
      }

      // Handle second key after 'g'
      if (pendingKey === 'g') {
        e.preventDefault();
        setPendingKey(null);

        switch (key) {
          case 'd':
            router.push('/app');
            break;
          case 'm':
            router.push('/app/monitoring');
            break;
          case 'i':
            router.push('/app/instances');
            break;
          case 'w':
            router.push('/app/workflows');
            break;
          case 's':
            router.push('/app/settings');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeout) clearTimeout(timeout);
    };
  }, [router, pendingKey]);

  return (
    <>
      {/* Pending key indicator */}
      {pendingKey && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-3 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in z-50">
          <Keyboard className="w-4 h-4" />
          <span className="font-mono text-sm">g + ...</span>
        </div>
      )}

      {/* Help dialog */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="w-5 h-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription>
              Use these shortcuts to navigate quickly
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted"
              >
                <span className="text-sm">{shortcut.description}</span>
                <kbd className="px-2 py-1 bg-muted rounded border text-xs font-mono">
                  {shortcut.key}
                </kbd>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Press <kbd className="px-1.5 py-0.5 bg-muted rounded border text-xs font-mono">?</kbd> to toggle this help
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

