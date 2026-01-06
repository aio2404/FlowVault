'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { KeyboardShortcuts } from '@/components/keyboard-shortcuts';
import { useAuthStore } from '@/lib/store';
import { authApi, ApiError } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user, setAuth, logout, organizations } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // Wait for zustand to hydrate from localStorage
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Don't check auth until hydration is complete
    if (!hydrated) return;

    async function checkAuth() {
      if (!token) {
        router.push('/auth/login');
        return;
      }

      try {
        const me = await authApi.getMe(token);
        setAuth(token, me.user, me.organizations);

        if (me.organizations.length === 0) {
          router.push('/app/onboarding');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Only logout on 401 unauthorized, not on network errors
        if (error instanceof ApiError && error.statusCode === 401) {
          logout();
          router.push('/auth/login');
        }
        // For other errors, keep the user logged in with cached data
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [hydrated, token, setAuth, logout, router]);

  // Show loading while hydrating or checking auth
  if (!hydrated || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </main>
      <KeyboardShortcuts />
    </div>
  );
}

