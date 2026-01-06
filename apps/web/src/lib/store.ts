import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Theme store for dark mode
interface ThemeState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'flowvault-theme',
    }
  )
);

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface Organization {
  id: string;
  name: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  organizations: Organization[];
  currentOrgId: string | null;

  setAuth: (token: string, user: User, organizations: Organization[]) => void;
  setOrganizations: (organizations: Organization[]) => void;
  setCurrentOrg: (orgId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      organizations: [],
      currentOrgId: null,

      setAuth: (token, user, organizations) => {
        set({
          token,
          user,
          organizations,
          currentOrgId: organizations[0]?.id || null,
        });
      },

      setOrganizations: (organizations) => {
        set((state) => ({
          organizations,
          currentOrgId:
            state.currentOrgId && organizations.find((o) => o.id === state.currentOrgId)
              ? state.currentOrgId
              : organizations[0]?.id || null,
        }));
      },

      setCurrentOrg: (orgId) => {
        set({ currentOrgId: orgId });
      },

      logout: () => {
        set({
          token: null,
          user: null,
          organizations: [],
          currentOrgId: null,
        });
      },
    }),
    {
      name: 'flowvault-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        organizations: state.organizations,
        currentOrgId: state.currentOrgId,
      }),
    }
  )
);

// Toast state
interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'destructive';
}

interface ToastState {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
    // Auto remove after 5 seconds
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 5000);
  },
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

