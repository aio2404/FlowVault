'use client';

import { useEffect, useLayoutEffect } from 'react';
import { useThemeStore } from '@/lib/store';

// Use layout effect on client to prevent flash
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useThemeStore();

  // Set initial dark class before first paint
  useIsomorphicLayoutEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  // Also set on mount immediately
  useEffect(() => {
    // Force dark mode on first load if no preference saved
    const stored = localStorage.getItem('flowvault-theme');
    if (!stored) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  return <>{children}</>;
}
